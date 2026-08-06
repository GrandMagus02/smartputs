/**
 * How near a typed phrase is to a holiday's name, and how near a holiday's date
 * is to now. Two numbers, kept apart because `findHoliday` ranks on them
 * lexicographically rather than on their difference.
 *
 * The edit distance below is a copy of `@smartput/core`'s, not an import of it,
 * for two separate reasons. The first is the dependency graph: this package
 * ships with no `@smartput` edge at all, the same way `@smartput/city` and
 * `@smartput/timezone` do, and one type-free helper is not worth the edge. The
 * second is that core's door onto it is `nearestWord`, which *refuses* a tie —
 * exactly right when a wrong guess silently changes an arithmetic answer, and
 * exactly wrong here, where the caller wants a ranked list and two equally near
 * names are two candidates rather than an error.
 */

/**
 * Not every slip is as likely as every other, so they do not cost the same — a
 * letter left out is the commonest of them. The weights are core's, unchanged,
 * so that "chrismas" and "cristmas" (one dropped letter each) land on the same
 * score and both beat a wrong letter.
 */
const MISSING_LETTER = 1;
const SWAPPED_LETTERS = 1.01;
const EXTRA_LETTER = 1.02;
const WRONG_LETTER = 1.03;

/** Half an edit of headroom, because the weights above put one slip a little over 1. */
const EDIT_HEADROOM = 0.5;

/** How far from the word that was meant a word of this length may be. */
function tolerance(length: number): number {
  if (length <= 1) return 0;
  if (length <= 4) return 1;
  return 2;
}

/**
 * Optimal string alignment distance with the weights above. `a` is what was
 * typed, `b` the candidate, and the two directions are not the same price.
 * Gives up at `cap` and answers `cap + 1`.
 */
export function editDistance(
  a: string,
  b: string,
  cap = Number.POSITIVE_INFINITY,
): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let twoBack: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i * MISSING_LETTER);
  let current: number[] = [];

  for (let i = 1; i <= a.length; i += 1) {
    current = [i * EXTRA_LETTER];
    let least = current[0] as number;
    for (let j = 1; j <= b.length; j += 1) {
      const same = a[i - 1] === b[j - 1];
      let cost = Math.min(
        (previous[j] as number) + EXTRA_LETTER,
        (current[j - 1] as number) + MISSING_LETTER,
        (previous[j - 1] as number) + (same ? 0 : WRONG_LETTER),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cost = Math.min(cost, (twoBack[j - 2] as number) + SWAPPED_LETTERS);
      }
      current.push(cost);
      least = Math.min(least, cost);
    }
    if (least > cap) return cap + 1;
    twoBack = previous;
    previous = current;
  }

  return previous[b.length] as number;
}

/**
 * Contractions people write that no amount of edit distance reaches: "xmas" is
 * five edits from "christmas", and widening the tolerance far enough to cover
 * it would make every four-letter word match every other one.
 *
 * Deliberately tiny. This is a list of things that are *written* short, not a
 * synonym dictionary — "turkey day" is a nickname for Thanksgiving and does not
 * belong here, because a nickname table has no natural edge and would end up
 * being the feature.
 */
const CONTRACTIONS: Record<string, string> = { xmas: "christmas" };

/**
 * Words, lower-cased, apostrophes closed up rather than split on: "New Year's
 * Day" is three words and "year" then "s" would put a meaningless one-letter
 * token in the middle of the average.
 */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token !== "");
}

/** Only from this length does a prefix say anything: "d" prefixes half the vocabulary. */
const MIN_PREFIX = 3;

const EXACT = 1;
const PREFIX = 0.9;

/**
 * A typo starts just under a prefix match and falls with the weighted number of
 * slips: one dropped letter is 0.8, two is 0.65. The floor matters — a
 * single-token query that only matches through a typo has to stay above the
 * default `minScore` of 0.6, or "chrismas" would be refused as a guess.
 */
const NEAR_BASE = 0.95;
const NEAR_PER_EDIT = 0.15;

/**
 * How near one typed word is to one word of a holiday's name, in `[0, 1]`.
 * Exact beats prefix beats a bounded typo, which is the order the plan asks for
 * and also the order of how much each one tells you.
 */
export function tokenScore(typed: string, candidate: string): number {
  if (typed === candidate) return EXACT;
  if (typed.length >= MIN_PREFIX && candidate.startsWith(typed)) return PREFIX;
  if (candidate.length >= MIN_PREFIX && typed.startsWith(candidate)) return PREFIX;

  const limit = tolerance(typed.length) + EDIT_HEADROOM;
  if (limit <= EDIT_HEADROOM) return 0;
  const distance = editDistance(typed, candidate, limit);
  if (distance > limit) return 0;
  return Math.max(0, NEAR_BASE - NEAR_PER_EDIT * distance);
}

/**
 * The typed half weighs twice the name half.
 *
 * Both halves have to be there. Typed-coverage alone ("is every word I typed in
 * this name?") scores "christmas" identically against "Christmas Day" and
 * against "Christmas Day (substitute day)", which is how the substitute entries
 * end up outranking the real ones. Name-coverage alone ("is every word of this
 * name something I typed?") punishes the normal case of typing less than the
 * full name. Two-to-one keeps a partial phrase strong while letting the extra
 * words in a longer name break a tie against it — which is the whole of the
 * substitute-day demotion, with no rule mentioning substitutes.
 */
const TYPED_WEIGHT = 2;

/**
 * How near a typed phrase is to a holiday's name, in `[0, 1]`.
 *
 * Token-based rather than whole-string, so "xmas day" reaches "Christmas Day"
 * and word order does not have to be right.
 */
export function nameScore(typed: string, candidate: string): number {
  const typedTokens = tokens(typed).map((token) => CONTRACTIONS[token] ?? token);
  const candidateTokens = tokens(candidate);
  if (typedTokens.length === 0 || candidateTokens.length === 0) return 0;

  const best = (from: string[], to: string[], flip: boolean): number => {
    let total = 0;
    for (const a of from) {
      let top = 0;
      // `tokenScore` is directional — its first argument is what was typed —
      // so which side is iterated does not decide which side is "typed".
      for (const b of to) top = Math.max(top, flip ? tokenScore(b, a) : tokenScore(a, b));
      total += top;
    }
    return total / from.length;
  };

  const typedCoverage = best(typedTokens, candidateTokens, false);
  const nameCoverage = best(candidateTokens, typedTokens, true);
  return (TYPED_WEIGHT * typedCoverage + nameCoverage) / (TYPED_WEIGHT + 1);
}

/**
 * The most proximity may ever cost. Small on purpose: it is a tiebreak, and the
 * lexicographic comparator in `find.ts` is what guarantees it never outvotes a
 * name, but the cap keeps `score` itself readable as "a name match, slightly
 * discounted for being far off".
 */
export const PROXIMITY_MAX = 0.05;

const MS_PER_DAY = 86_400_000;

/**
 * The widest gap the three-year candidate window can produce: `now` on the last
 * day of its year is ~730 days from the first day of the year before, and two
 * leap years plus a day of slack rounds that to 733.
 *
 * The divisor is a constant rather than the range of the candidates actually
 * found, because a penalty computed against the set would change when the set
 * changed — the same holiday would score differently depending on what else
 * matched, and `score` would stop being comparable between queries.
 */
const WINDOW_DAYS = 733;

/**
 * Strictly monotonic in `|start - now|` over the whole window, into
 * `[0, PROXIMITY_MAX]`. Linear, with no clamp, no bucket and no flat region for
 * distant dates — a nameless query ranks on this term alone, so two candidates
 * 200 and 300 days out have to come apart, and anything that saturated would
 * tie them.
 */
export function proximityPenalty(start: number, now: number): number {
  return (PROXIMITY_MAX * Math.abs(start - now)) / (WINDOW_DAYS * MS_PER_DAY);
}
