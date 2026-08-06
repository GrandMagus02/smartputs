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
  /** Translate a span in `text` back to a span in `source`. */
  mapSpan(span: Span): Span;
}

export interface NormalizerOptions {
  nfkc?: boolean;
  dashes?: boolean;
  degree?: boolean;
  whitespace?: boolean;
  trim?: boolean;
  /**
   * Ran after the built-in passes, on the already-normalized text. The seam
   * fuzzy unit repair ("30d" -> "30deg") lands in later, alongside the validate
   * path's `resolve`. Its edits are appended to `edits`, and it must not change
   * `text` — a repair that rewrites the string is a second normalizer, not a
   * hook.
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
  /** `offsets[i]` is the index in the NFKC-folded string that `text[i]` came
   * from, plus one trailing entry for the end position. */
  readonly offsets: readonly number[];
  /** Length of the NFKC-folded string, used as `mapSpan`'s end-of-range fallback. */
  readonly preLength: number;
  /** True once NFKC changed the string's length, at which point offsets no
   * longer correspond to source positions. */
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
    // After an NFKC length change there is no character-level correspondence to
    // the source, so the honest answer is the whole source rather than an
    // offset that happens to be plausible.
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

  // NFKC can change length, so it runs first and its own edit is recorded
  // against the whole string rather than per character — a per-character map
  // through a compatibility decomposition is not derivable from the output.
  const pre = doNfkc ? input.normalize("NFKC") : input;
  const edits: Edit[] = [];
  if (pre !== input) {
    edits.push({
      at: { start: 0, end: input.length },
      length: pre.length,
      reason: "nfkc",
    });
  }

  // `offsets[i]` is the index in `pre` that `text[i]` came from, plus one
  // trailing entry for the end position. This is what makes mapSpan exact
  // rather than approximate.
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
        // Leading run: dropped entirely.
        edits.push({ at: { start: 0, end: i }, length: 0, reason: "trim" });
      } else {
        offsets.push(i - 1);
        text += " ";
      }
    }

    if (doDashes && DASH.test(ch)) {
      edits.push({ at: { start: i, end: i + 1 }, length: 1, reason: "dash" });
      offsets.push(i);
      text += "-";
      continue;
    }

    offsets.push(i);
    text += ch;
  }

  if (pendingWhitespace) {
    if (doTrim) {
      edits.push({ at: { start: wsStart, end: pre.length }, length: 0, reason: "trim" });
    } else {
      offsets.push(pre.length - 1);
      text += " ";
    }
  }

  // One past the last character, so a span whose `end` is `text.length` maps.
  // A trailing run that trim just dropped is not part of the mapped content,
  // so the boundary is where that run started, not `pre.length`.
  offsets.push(pendingWhitespace && doTrim ? wsStart : pre.length);

  const nfkcShifted = pre !== input;
  const repaired = opts.repair?.(text, { source: input }) ?? [];
  edits.push(...repaired);

  return new NormalizedInputImpl({
    source: input,
    text,
    edits: Object.freeze([...edits]) as readonly Edit[],
    offsets,
    preLength: pre.length,
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
