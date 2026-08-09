import type { AnalyzedForm, Analyzer } from "../types";

/**
 * `suffixStripper`'s mirror image, for the languages that inflect at the other
 * end of the word — Bantu noun classes, the Georgian and Nahuatl verb, any
 * morphology where the marker arrives before the stem rather than after it.
 * Everything about the shape is deliberately identical to its sibling in
 * `helpers.ts`, so a reader who knows one recognises the other on sight: the
 * `minStem` floor, the never-empty stem, the negative default weight, the
 * longest-marker-first ordering, and the fact that *every* matching marker is
 * offered rather than only the best one — the analyzer proposes, the alias
 * index and the solver dispose.
 *
 * The penalty (`-2` unless the caller says otherwise) is what keeps a stripped
 * reading below an exact one. It is additive with the rest of a candidate's
 * score (`parse/candidates.ts` sums it into `weight`), so a word that is both
 * one unit's own alias and another unit's alias wearing a prefix resolves to
 * the exact reading, with the stripped one still on the table behind it for
 * the solver to reach for if context rules the first one out.
 *
 * **Two ends of one word are not stripped together, and that is the chain's
 * doing, not a rule invented here.** `createAnalyzerChain` runs every analyzer
 * in `Language.analyze` over the *original* surface and pools their results;
 * no analyzer ever sees another's output. So a language declaring both this
 * and `suffixStripper` gets `kimita → mita` and `mitani → mita`, but
 * `kimitani` reaches neither end's stem and reads as nothing. Left that way on
 * purpose. Both strippers are lossy guesses over a fixed marker list, and
 * composing them squares the guess while the flat `weight` has no way to say
 * "twice as speculative" — a chain that composed would quietly hand the solver
 * a doubly-stripped stem scored exactly like a singly-stripped one. A language
 * that genuinely needs both ends off one word is asking for real morphology
 * and should supply its own `Analyzer` (or spell the combinations out in one
 * stripper's list), which is a decision its author makes with its paradigms in
 * front of them rather than one this helper makes for every language at once.
 *
 * **Matching is on the surface exactly as typed.** The chain is handed the raw
 * word — `parse/candidates.ts` folds the *form* an analyzer returns, on its
 * way into the alias index, not the surface on its way in — so `"Kimita"` does
 * not match the prefix `"ki"`. This is the same as `suffixStripper` and it
 * bites harder here, because a prefix sits precisely where sentence-initial
 * capitalisation lands and a suffix never does. Folding inside the helper was
 * the obvious alternative and was left out: the case fold is locale-tailored
 * (`toLocaleLowerCase`) and this engine makes that choice in exactly two
 * places, both of which document the measurement behind it, so a leaf helper
 * quietly folding under a third rule is how those two stop agreeing. A
 * language that expects capitalised input lists both casings — `["ki", "Ki"]`
 * — which costs one array entry and stays a pure string operation.
 *
 * Holds nothing between calls: the sorted copy is fixed at construction, and
 * every call builds its own array. The module does no work at import beyond
 * declaring this function, so a consumer who never installs a language that
 * uses it never pays for it.
 */
export function prefixStripper(opts: {
  prefixes: string[];
  minStem: number;
  weight?: number;
}): Analyzer {
  const weight = opts.weight ?? -2;
  // Longest prefix first, so "kiwa" is tried before "ki".
  const prefixes = [...opts.prefixes].sort((a, b) => b.length - a.length);

  return (surface) => {
    const out: AnalyzedForm[] = [];
    for (const prefix of prefixes) {
      if (!surface.startsWith(prefix)) continue;
      const stem = surface.slice(prefix.length);
      if (stem.length === 0 || stem.length < opts.minStem) continue;
      out.push({ form: stem, weight });
    }
    return out;
  };
}
