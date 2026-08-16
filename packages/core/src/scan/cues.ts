import type { CueEntry, Registry } from "../kind/registry";
import type { Token } from "../parse/lex";
import type { NormalizedInput } from "../parse/normalize";
import type { KindId } from "../types";

/**
 * The most any number of cue words may move one kind at one mark.
 *
 * The magnitude is set by the softmax in `solve/solver.ts`, exactly as
 * `TYPO_PENALTY`'s is. A score difference of 4 is 0.982 against 0.018: decisive
 * enough to pass `ambiguityEpsilon` (0.05) several times over, and short of
 * claiming the loser does not exist. The figures this design started from — 25,
 * on the scale `CONTEXT_BONUS` uses — put the loser at 1e-11, which is a
 * certainty that "there is an `in` four words away" has not earned.
 *
 * Clamping rather than trusting the tables is what makes the scale enforceable.
 * A vocabulary author who writes `{ in: 25 }` gets saturation, not a silently
 * overconfident engine and no error.
 *
 * Per kind, not per mark: `duration` saturating does not stop `length`
 * collecting its own from a cue on the other side, and the two then cancel —
 * the right answer for a sentence that argues both ways.
 */
export const CUE_CEILING = 4;

export interface CueHit {
  /** The word as written, not folded. */
  readonly word: string;
  /** Caller-relative, so a UI can underline it. */
  readonly start: number;
  readonly end: number;
  readonly kind: KindId;
  readonly weight: number;
}

/**
 * Characters that end a cue's reach. `lex` skips every one of them silently, so
 * they exist nowhere in the token stream and can only be seen in the source
 * text *between* two tokens' spans — which is what `broken` reads.
 *
 * A decimal point is unaffected: `5.5` is a single number token, so its dot is
 * never between two tokens. An abbreviation ("e.g.") ends a window early, which
 * is the accepted failure: a short window loses a bias, while a long one
 * imports an unrelated sentence's words as evidence.
 */
const BREAK = /[.!?;\n]/;

/**
 * The surface of a token that could be a cue, or `undefined` for one that never
 * is.
 *
 * The `keyword` branch is the load-bearing one. `in`, `to` and `as` are folded
 * by `lex` into a `Keyword` *key*, and the key is not the word that was typed —
 * a `keyword` token has no `text` field at all. Slicing the normalized source is
 * the only way back to the surface, and without it `in` is unreachable as a cue,
 * which is most of what this feature was asked for.
 */
function cueSurface(token: Token, text: string): string | undefined {
  if (token.type === "word") return token.text;
  if (token.type === "keyword") return text.slice(token.start, token.end);
  return undefined;
}

/** True when the source between two adjacent tokens ends a sentence. */
function broken(tokens: readonly Token[], a: number, b: number, text: string): boolean {
  const left = tokens[a];
  const right = tokens[b];
  if (left === undefined || right === undefined) return false;
  return BREAK.test(text.slice(left.end, right.start));
}

export interface CollectCuesArgs {
  readonly tokens: readonly Token[];
  /** Index of the mark's first token. */
  readonly from: number;
  /** Index one past the mark's last token. */
  readonly to: number;
  readonly input: NormalizedInput;
  readonly registry: Registry;
  /** Tokens of any type to look at in each direction. */
  readonly window: number;
  /**
   * The engine's format locale id, needed to case-fold a candidate cue's
   * surface the same way `registry.cueIndex`'s keys were folded when the
   * registry was built (`registry.ts`'s `word.toLocaleLowerCase(localeId)`).
   * An ordinary `.toLowerCase()` disagrees with that fold for `tr`/`az`/`lt`
   * words containing `i`/`I` — `scan.ts`'s `endsOperand` documents the exact
   * mismatch — and getting it wrong here has the same shape of consequence:
   * a cue that is genuinely in the table stops being found for the one
   * locale whose fold it needed.
   */
  readonly locale: string;
  /**
   * Caller's `ScanScope.locales`, forwarded so a cue from a language the
   * caller excluded does not vote. Mirrors `solve/solver.ts`'s `inScope`,
   * which already applies this same list to every OTHER reading a mark can
   * take — leaving cues out of it meant `scan(text, { locales: ["en"] })`
   * still counted another installed language's cue table, even though that
   * language's own READINGS were hard-filtered from the solver in the very
   * next statement.
   */
  readonly locales?: readonly string[];
}

/**
 * Every cue near `[from, to)`, and what they sum to per kind.
 *
 * Tokens *inside* the mark are never offered, and that exclusion is not
 * tidiness — it is what tells the two `in`s apart without a grammar rule. In
 * "5 km in miles" the `in` is the convert node and sits inside the mark, so it
 * does not vote; in "be in time in 5m" it sits outside, so it does. Backoff has
 * already decided which, and this reads the answer off the mark's extent rather
 * than re-deriving it.
 */
export function collectCues(args: CollectCuesArgs): {
  hits: CueHit[];
  weights: Record<KindId, number>;
} {
  const { tokens, from, to, input, registry, window, locale, locales } = args;
  const text = input.text;
  const hits: CueHit[] = [];

  const visit = (index: number): void => {
    const token = tokens[index];
    if (token === undefined) return;
    const surface = cueSurface(token, text);
    if (surface === undefined) return;
    const entries: readonly CueEntry[] =
      registry.cueIndex.get(surface.toLocaleLowerCase(locale)) ?? [];
    // One token, one vote per kind. `buildRegistry` legitimately keeps two
    // `CueEntry`s for one (word, kind) when two installed languages both
    // claim it — `en` and a stub locale both listing `in: 1` for `duration`,
    // say — because that genuinely is two languages' worth of evidence.
    // But a mark's score sums one weight per kind per cue *token*, not per
    // language that happened to agree, so pushing a `CueHit` for each entry
    // would double the vote and, in a UI walking `mark.cues`, double-underline
    // one word. Kept to one hit per kind by taking the first entry this
    // token reaches — `registry.cueIndex`'s own deterministic order (kind
    // id, then locale id, both sorted at build time), not iteration order.
    const seenKinds = new Set<KindId>();
    for (const entry of entries) {
      // `locales` narrows the same way `solve/solver.ts`'s `inScope` narrows
      // every other reading: a cue from a language the caller did not ask to
      // read casts no vote. No `"*"` case to mirror here the way `inScope`
      // carries one for `AliasEntry` — `composeLocale` refuses a vocabulary
      // whose `locale` differs from its language's own id (`LocaleMismatchError`),
      // so every `CueEntry.locale` names a real installed language and there
      // is no language-neutral entry a list could wrongly exclude.
      if (locales !== undefined && !locales.includes(entry.locale)) continue;
      if (seenKinds.has(entry.kind)) continue;
      seenKinds.add(entry.kind);
      // Token spans are normalized-relative; every span that reaches a caller
      // is not.
      const span = input.mapSpan({ start: token.start, end: token.end });
      hits.push({
        word: surface,
        start: span.start,
        end: span.end,
        kind: entry.kind,
        weight: entry.weight,
      });
    }
  };

  // Leftward from the token before the mark, nearest first. The break check
  // runs before the visit so a cue on the far side of a full stop is never
  // read, and `break` rather than `continue` because a sentence boundary ends
  // the reach rather than skipping one word of it.
  for (let i = from - 1, n = 0; i >= 0 && n < window; i -= 1, n += 1) {
    if (broken(tokens, i, i + 1, text)) break;
    visit(i);
  }
  for (let i = to, n = 0; i < tokens.length && n < window; i += 1, n += 1) {
    if (broken(tokens, i - 1, i, text)) break;
    visit(i);
  }

  const weights: Record<KindId, number> = {};
  for (const hit of hits) {
    weights[hit.kind] = (weights[hit.kind] ?? 0) + hit.weight;
  }
  for (const kind of Object.keys(weights)) {
    const summed = weights[kind] ?? 0;
    weights[kind] = Math.max(-CUE_CEILING, Math.min(CUE_CEILING, summed));
  }

  return { hits, weights };
}
