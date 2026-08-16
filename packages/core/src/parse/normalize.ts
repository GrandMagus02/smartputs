import type { Span } from "../types";

export type EditReason =
  | "nfkc"
  | "zero-width"
  | "dash"
  | "degree"
  | "whitespace"
  | "trim";

/**
 * One replacement the normalizer made. `at` indexes the **source**; `length` is
 * how many characters the replacement occupies in the normalized text. A
 * deletion has `length: 0`.
 */
export interface Edit {
  readonly at: Span;
  readonly length: number;
  readonly reason: EditReason;
}

export interface NormalizedInput {
  /** Exactly what the caller passed. */
  readonly source: string;
  /** What every later stage reads. */
  readonly text: string;
  readonly edits: readonly Edit[];
  readonly empty: boolean;
  /**
   * Translate a span in `text` back to a span in `source`.
   *
   * Prototype-bound: this reads `this.offsets` and `this.nfkcShifted`, so
   * `const { mapSpan } = normalized; mapSpan(s)` throws once detached from
   * its receiver. Call it as `normalized.mapSpan(s)`, or if you must pass it
   * on, wrap it — `(span) => normalized.mapSpan(span)` — the way
   * `program.ts`'s `Parser.run` does.
   */
  mapSpan(span: Span): Span;
}

export interface NormalizerOptions {
  /**
   * Also gates zero-width stripping: there is no separate flag for it even
   * though `EditReason` has a dedicated `"zero-width"` value. `normalize("30​deg",
   * { nfkc: false }).text` keeps the ZWSP.
   */
  nfkc?: boolean;
  dashes?: boolean;
  degree?: boolean;
  whitespace?: boolean;
  /**
   * Silently depends on `whitespace`: the trim branches live inside the
   * pending-whitespace flush, so with `whitespace: false` nothing is ever
   * pending and `trim` has no effect —
   * `normalize("  30deg  ", { whitespace: false }).text` is `"  30deg  "`.
   */
  trim?: boolean;
  /**
   * Ran after the built-in passes, on the already-normalized text. The seam
   * fuzzy unit repair ("30d" -> "30deg") lands in later, alongside the validate
   * path's `resolve`. Its edits are appended to `edits`, and it must not change
   * `text` — a repair that rewrites the string is a second normalizer, not a
   * hook.
   *
   * `Edit.at` is documented as indexing the source, but this hook receives
   * `text` (the already-normalized string) and naturally produces
   * `text`-relative spans — which is what the built-in test for this hook
   * does. Unsettled for now; to be resolved when the fuzzy-repair seam lands.
   */
  repair?: (text: string, ctx: { source: string }) => readonly Edit[];
}

const ZERO_WIDTH = /(​|‌|‍|﻿)/;
const DASH = /[−‒–—―]/;
const WHITESPACE = /\s/;

interface NormalizedInputInit {
  readonly source: string;
  readonly text: string;
  readonly edits: readonly Edit[];
  /** `offsets[i]` is the SOURCE index that `text[i]` came from, plus one
   * trailing entry for the end position. When NFKC's effect was derivable
   * per code point, this is already composed through that map; see
   * `preToSource` in `normalize()`. */
  readonly offsets: readonly number[];
  /** Length of the source string, used as `mapSpan`'s end-of-range fallback. */
  readonly preLength: number;
  /** True only when NFKC composed multiple source code points together
   * (e.g. "e" + combining acute -> "é"), the one case with no per-character
   * correspondence back to the source. A same-length or length-changing fold
   * that stays one-code-point-in-one-code-point-out (NBSP, "①" → "1", "½" →
   * "1⁄2"...) does NOT set this — `offsets` carries an exact map instead. */
  readonly nfkcShifted: boolean;
}

/**
 * `mapSpan` lives on the prototype rather than as a per-call closure so that
 * two normalizations of the same input are structurally equal: a closure
 * captured fresh on every call is never `===` to another one, and nothing
 * comparing two `NormalizedInput`s field by field could tell "different
 * function, same behavior" from "actually different."
 */
class NormalizedInputImpl implements NormalizedInput {
  readonly source: string;
  readonly text: string;
  readonly edits: readonly Edit[];
  readonly empty: boolean;
  private readonly offsets: readonly number[];
  private readonly preLength: number;
  private readonly nfkcShifted: boolean;

  constructor(init: NormalizedInputInit) {
    this.source = init.source;
    this.text = init.text;
    this.edits = init.edits;
    this.empty = init.text.length === 0;
    this.offsets = init.offsets;
    this.preLength = init.preLength;
    this.nfkcShifted = init.nfkcShifted;
    Object.freeze(this);
  }

  mapSpan(span: Span): Span {
    // `nfkcShifted` is true only when NFKC composed multiple source code
    // points into one output (see its doc comment) — the one case with no
    // character-level correspondence to the source, so the honest answer is
    // the whole source rather than an offset that happens to be plausible.
    // Every other NFKC fold, including ones that change length, is exact:
    // `offsets` already carries the composed source positions.
    if (this.nfkcShifted) return { start: 0, end: this.source.length };
    const start = this.offsets[span.start] ?? 0;
    const endExclusive = this.offsets[span.end] ?? this.preLength;
    return { start, end: endExclusive };
  }
}

/**
 * Character-by-character rather than a chain of `.replace()` calls, because a
 * chain cannot say where it edited. That is not a stylistic preference: `lex()`
 * runs on `text` and produces spans against it, `Result.spans` hands them back
 * as if they indexed `source`, and on `main` three of four probed inputs slice
 * the wrong substring. A pass that records its edits cannot have that bug.
 */
export function normalize(input: string, opts: NormalizerOptions = {}): NormalizedInput {
  const doNfkc = opts.nfkc !== false;
  const doDashes = opts.dashes !== false;
  const doDegree = opts.degree !== false;
  const doWhitespace = opts.whitespace !== false;
  const doTrim = opts.trim !== false;

  // NFKC can change length, so it runs first. Its edit is still recorded
  // against the whole string rather than per character, but the offset map
  // it produces is per code point whenever that is derivable — see
  // `preToSource` below.
  const inputNfkc = doNfkc ? input.normalize("NFKC") : input;

  // `preToSource[i]` is the source index the character at `pre[i]` came
  // from, when defined. `undefined` means `pre === input`: NFKC changed
  // nothing, so indices into `pre` already are source indices, and the
  // per-code-point work below never runs — the fast, overwhelmingly common
  // path.
  let preToSource: readonly number[] | undefined;
  let pre: string;
  let nfkcShifted: boolean;

  if (inputNfkc === input) {
    pre = input;
    nfkcShifted = false;
  } else {
    // NFKC changed something. Folding each code point independently and
    // concatenating the results is, for the cases that matter in practice
    // (NBSP, ½, ℃, circled digits, fullwidth digits, ligatures, ™...),
    // identical to folding the whole string at once — which gives an exact
    // per-code-point offset map: `parts[j]`'s output characters all came
    // from source code point `j`. It differs only when NFKC composes
    // adjacent code points together (e.g. "e" + combining acute -> "é"),
    // and composition across code points genuinely has no per-character
    // correspondence back to the source, so that case keeps today's
    // whole-source fallback exactly.
    const codePoints = [...input];
    const parts = codePoints.map((cp) => cp.normalize("NFKC"));
    const perCp = parts.join("");
    if (perCp === inputNfkc) {
      const map: number[] = [];
      let srcIdx = 0;
      for (let j = 0; j < codePoints.length; j += 1) {
        const cp = codePoints[j] as string;
        const folded = parts[j] as string;
        for (let k = 0; k < folded.length; k += 1) map.push(srcIdx);
        // A surrogate pair is one code point but two UTF-16 units, so the
        // source index has to advance by the code point's own `.length`,
        // not by one.
        srcIdx += cp.length;
      }
      map.push(input.length); // one past the end, for the trailing offset entry.
      pre = perCp;
      preToSource = map;
      nfkcShifted = false;
    } else {
      pre = inputNfkc;
      nfkcShifted = true;
    }
  }

  /** Composes an index into `pre` through `preToSource`, when there is one. */
  const toSource = (i: number): number =>
    preToSource === undefined ? i : (preToSource[i] ?? input.length);

  const edits: Edit[] = [];
  if (pre !== input) {
    edits.push({
      at: { start: 0, end: input.length },
      length: pre.length,
      reason: "nfkc",
    });
  }

  // `offsets[i]` is the source index that `text[i]` came from (composed
  // through `preToSource` when NFKC's effect was per-code-point derivable),
  // plus one trailing entry for the end position. This is what makes mapSpan
  // exact rather than approximate.
  let text = "";
  const offsets: number[] = [];
  let pendingWhitespace = false;
  // Index of the first character of the whitespace run currently pending,
  // valid only while `pendingWhitespace` is true. A trailing run that gets
  // trimmed away needs this: the "one past the end" offset must point at
  // where that run started in `pre`, not at `pre.length`, or mapSpan would
  // claim the trimmed characters as part of the mapped content.
  let wsStart = -1;

  for (let i = 0; i < pre.length; i += 1) {
    const ch = pre[i] as string;

    if (doNfkc && ZERO_WIDTH.test(ch)) {
      edits.push({ at: { start: i, end: i + 1 }, length: 0, reason: "zero-width" });
      continue;
    }
    if (doDegree && ch === "°") {
      edits.push({ at: { start: i, end: i + 1 }, length: 0, reason: "degree" });
      continue;
    }
    if (doWhitespace && WHITESPACE.test(ch)) {
      // A run collapses to one space, emitted lazily so a trailing run
      // disappears without a second pass.
      if (!pendingWhitespace) {
        pendingWhitespace = true;
        wsStart = i;
      } else {
        edits.push({ at: { start: i, end: i + 1 }, length: 0, reason: "whitespace" });
      }
      continue;
    }

    if (pendingWhitespace) {
      pendingWhitespace = false;
      if (text.length === 0 && doTrim) {
        // Leading run: dropped entirely. `wsStart`, not 0 — a zero-width or
        // degree character before the run already reported its own position
        // under its own reason, and re-covering it here would report the
        // same source position twice under two reasons.
        edits.push({ at: { start: wsStart, end: i }, length: 0, reason: "trim" });
      } else {
        offsets.push(toSource(i - 1));
        text += " ";
      }
    }

    if (doDashes && DASH.test(ch)) {
      edits.push({ at: { start: i, end: i + 1 }, length: 1, reason: "dash" });
      offsets.push(toSource(i));
      text += "-";
      continue;
    }

    offsets.push(toSource(i));
    text += ch;
  }

  if (pendingWhitespace) {
    if (doTrim) {
      edits.push({ at: { start: wsStart, end: pre.length }, length: 0, reason: "trim" });
    } else {
      offsets.push(toSource(pre.length - 1));
      text += " ";
    }
  }

  // One past the last character, so a span whose `end` is `text.length` maps.
  // A trailing run that trim just dropped is not part of the mapped content,
  // so the boundary is where that run started, not `pre.length`.
  offsets.push(toSource(pendingWhitespace && doTrim ? wsStart : pre.length));

  const repaired = opts.repair?.(text, { source: input }) ?? [];
  edits.push(...repaired);

  return new NormalizedInputImpl({
    source: input,
    text,
    // `Object.freeze` alone froze the array but not each `Edit` object (nor
    // its nested `at` span) inside it — the last unclosed thread of the
    // freeze contract the whole-branch review found: every other stage's
    // output deep-freezes. Frozen by hand, two levels, rather than by
    // importing the shared `deepFreeze` (`../freeze`): that helper pulls in
    // `decimal.js` for a `Decimal` guard `Edit` has no use for — every field
    // reachable from one is a plain number or string — so importing it here
    // would trade a correctness fix for a many-KB regression on the one
    // subpath with no other reason to load a big-number library at all.
    // Nothing reads `edits` mutably (they are recorded once, never
    // revised), so freezing them cannot change a result.
    edits: Object.freeze(
      edits.map((e) => Object.freeze({ ...e, at: Object.freeze({ ...e.at }) })),
    ) as readonly Edit[],
    offsets,
    preLength: input.length,
    nfkcShifted,
  });
}

/**
 * The configured form. Holds options once so a caller normalizing a thousand
 * keystrokes does not restate them, and is frozen so it cannot acquire state
 * between runs.
 */
export class Normalizer {
  private readonly opts: NormalizerOptions;

  constructor(cfg: NormalizerOptions = {}) {
    // A copy, not the caller's object: freezing `this` only stops `this.opts`
    // being reassigned, and the caller could otherwise mutate the object they
    // passed in after construction, changing `run()`'s behavior without
    // reconstructing the instance.
    this.opts = Object.freeze({ ...cfg });
    Object.freeze(this);
  }

  run(input: string): NormalizedInput {
    return normalize(input, this.opts);
  }
}
