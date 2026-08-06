/**
 * Reading through a typo: "one plsu two" is an addition, and refusing it on a
 * transposed pair of letters helps nobody.
 *
 * The correction is deliberately narrow. It only ever replaces a word the
 * reader does not know with one it does, it only looks as far as the length of
 * the word allows, and it refuses to choose between two words it is equally
 * near. A silent wrong guess in an expression is worse than an error naming
 * the word, because the answer that comes back is still a number.
 *
 * This lives in core rather than in the one package that first needed it
 * because there is no second-best implementation of a distance: two of them
 * drift, and the one that drifts is always the one nobody is looking at. Core
 * is the only package every other package already depends on, so putting it
 * here adds no edge to the dependency graph.
 */

/**
 * Not every slip is as likely as every other, so they do not cost the same.
 * A letter left out is the commonest of them — "si" for "sin" — and has to
 * beat a letter typed wrong, which would otherwise tie with it and be refused
 * as ambiguous. The differences are small enough that the number of edits
 * still decides first: two of the cheapest slips cost more than one of the
 * dearest.
 */
const MISSING_LETTER = 1;
const SWAPPED_LETTERS = 1.01;
const EXTRA_LETTER = 1.02;
const WRONG_LETTER = 1.03;

/**
 * How many edits a word of this length may be from the one that was meant. A
 * single letter is left alone entirely — every one of them is a symbol — and
 * past that one edit is allowed, or two once a word is long enough that two
 * edits still leave most of it standing.
 */
function tolerance(length: number): number {
  if (length <= 1) return 0;
  if (length <= 4) return 1;
  return 2;
}

/**
 * Half an edit of headroom over a whole number of edits: the weights above put
 * one slip a little over 1, and this is what keeps that from reading as two.
 * Anything that counts edits and then caps has to add it.
 */
export const EDIT_HEADROOM = 0.5;

/** Below this two costs are the same slip counted twice, not two candidates. */
const SAME = 1e-9;

/**
 * The one word in `vocabulary` closest to `word`, or null when nothing is
 * close enough — or when two are equally close, which is a guess wearing a
 * correction's clothes.
 */
export function nearestWord(word: string, vocabulary: Iterable<string>): string | null {
  const edits = tolerance(word.length);
  if (edits === 0) return null;
  const limit = edits + EDIT_HEADROOM;

  let best: string | null = null;
  let bestDistance = limit;
  let tied = false;

  for (const candidate of vocabulary) {
    const distance = editDistance(word, candidate, bestDistance);
    if (distance > bestDistance) continue;
    if (best !== null && Math.abs(distance - bestDistance) < SAME) {
      tied = true;
      continue;
    }
    best = candidate;
    bestDistance = distance;
    tied = false;
  }

  return tied ? null : best;
}

/**
 * Optimal string alignment distance, with the weights above: a letter left
 * out, one typed twice over, one typed wrong, and two typed the wrong way
 * round — which plain Levenshtein charges as two slips when it is plainly one.
 * "plsu" for "plus" is the commonest typo there is.
 *
 * `a` is what was typed and `b` is the candidate, and the two directions are
 * not the same price: a letter in `b` that `a` lacks was left out, a letter in
 * `a` that `b` lacks was typed by mistake.
 *
 * Gives up as soon as the cost passes `cap` and answers `cap + 1`, since the
 * caller only cares which candidate is nearest, not how far the rest are. A
 * caller that genuinely wants the whole distance leaves `cap` off and pays for
 * the whole table.
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
        // Skipping a letter of what was typed: it did not belong there.
        (previous[j] as number) + EXTRA_LETTER,
        // Skipping a letter of the candidate: it was left out.
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
