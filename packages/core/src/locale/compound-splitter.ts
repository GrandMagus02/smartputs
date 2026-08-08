import type { AnalyzedForm, Analyzer } from "../types";

/**
 * The Germanic compound, read by its head.
 *
 * German, Dutch and the Scandinavian languages write a compound as one word,
 * so `Zentimeter`, `Kubikmeter` and `Bandmeter` are single tokens the lexer
 * cannot cut and no vocabulary can list — there is no closed set of them to
 * list. The one thing that *is* fixed is where the meaning sits: a Germanic
 * compound is right-headed, so its last element says what the word is a kind
 * of and everything before it modifies. `Bandmeter` is a metre; `Meterband` is
 * a band. So this emits the **last** part, and only the last part.
 *
 * It emits it at a penalty, because a split is a guess about morphology that
 * an alias is not. The penalty is what makes the helper safe to install
 * alongside a vocabulary that already lists the common compounds: `Kilometer`
 * both *is* an alias (weight 0) and *contains* `meter` (weight -3), and the
 * resolver keeps the kilometre. Give the split a boost instead and every
 * prefixed length word in the language quietly answers in the base unit, with
 * every unit test still green — so the sign here is load-bearing, and
 * `compound-splitter.test.ts` measures it through a real engine rather than
 * asserting it about the analyzer.
 *
 * **Case.** The analyzer receives the surface exactly as typed: `pratt` passes
 * the lexer's `word.text` to `resolve`, which folds only the form that comes
 * back out (`candidates.ts`, `fold(analyzed.form)`) before consulting the
 * alias index. German capitalises every noun, so a case-sensitive match would
 * claim nothing a German ever wrote, and a vocabulary written `["Meter"]`
 * would claim nothing either. Both sides are therefore folded here — the
 * vocabulary once at construction, the surface once per call — and the form
 * emitted is the folded slice, so the emitted string is a substring of the
 * string that was matched even for a fold that changes length (Turkish `İ`).
 *
 * The fold is `toLowerCase`, not `toLocaleLowerCase(ctx.locale)`, for the same
 * measured reason `createResolver`'s own `fold` gives: only Turkish, Azeri,
 * Lithuanian and Greek tailor case at all, none of them is a compounding
 * language of the kind this helper is for, and installing one is the trigger
 * to revisit — not a reason to fold the whole vocabulary again on every word.
 *
 * **What it deliberately does not check.** The head. `zenti-` and `kubik-` are
 * bound morphemes and combining forms that no vocabulary would list as words,
 * so requiring the head to be known would refuse the very compounds the helper
 * exists for. `minPart` is what stands in for that check, on both parts at
 * once: a head shorter than `minPart` is not a morpheme, and a word that
 * merely *ends* in a short vocabulary entry is not a compound of it. Both
 * bounds are at least 1 regardless of `minPart`, which is what keeps the whole
 * surface from splitting into itself plus nothing — a bare vocabulary word is
 * not a compound, and `identity()` already offers it at weight 0.
 *
 * Every split satisfying both guards is offered, longest tail first. Two
 * readings of one word is the ordinary case for a vocabulary that lists both a
 * base and a derived unit (`Quadratzentimeter` ends in `zentimeter` and in
 * `meter`), and choosing between them needs the alias index and the weight
 * layers, which the resolver has and this does not.
 *
 * Holds nothing between calls: the folded vocabulary is built once at
 * construction and never written to again, and the per-call scan writes only
 * to its own output. Caching is `createAnalyzerChain`'s job.
 */
export function compoundSplitter(opts: {
  /**
   * The known forms to split against — the words that may appear as a
   * compound's head. An array or a `Set`; folded once, here.
   */
  vocabulary: Iterable<string>;
  /** The shortest either part may be. Guards the head and the tail alike. */
  minPart: number;
  /**
   * Strictly worse than `suffixStripper`'s -2, and deliberately: stripping an
   * ending keeps the word, splitting a compound throws a whole morpheme away.
   */
  weight?: number;
}): Analyzer {
  const weight = opts.weight ?? -3;
  const vocabulary = new Set<string>();
  for (const word of opts.vocabulary) vocabulary.add(word.toLowerCase());
  // Never 0: see the doc comment on why a bare vocabulary word is not a
  // compound of itself.
  const shortest = Math.max(1, opts.minPart);

  return (surface) => {
    const folded = surface.toLowerCase();
    const out: AnalyzedForm[] = [];
    // `cut` is the head's length, so it ascends from the shortest allowed head
    // to the longest one that still leaves a legal tail — which walks the
    // tails from longest to shortest.
    for (let cut = shortest; cut <= folded.length - shortest; cut++) {
      const tail = folded.slice(cut);
      if (vocabulary.has(tail)) out.push({ form: tail, weight });
    }
    return out;
  };
}
