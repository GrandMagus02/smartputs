import type { Analyzer } from "../types";

/**
 * Multi-word units: `"square metres"` → `m2`, `"nautical miles"` → `nmi`.
 *
 * The one helper built on the run of neighbours `AnalyzeCtx` carries. An
 * analyzer is called once per word, so a phrase has to be recognised from one
 * of its words with the others merely visible — and the word it is recognised
 * from is the **last** one. That is where the reading belongs: "square" alone
 * is a shape, "square metres" is an area, and the word the writer's unit sits
 * on is "metres". So each phrase is matched *backwards* from `ctx.index`, and
 * the longest phrase ending at this word wins.
 *
 * The longest, and only the longest. A table holding both `"metres"` and
 * `"square metres"` names two different units, and offering both would leave
 * the solver choosing between a length and an area on nothing but candidate
 * order — a decision made here, where the two extra words of evidence are, is
 * a decision and not a coin toss. Two phrases of equal length cannot both
 * match the same window, so the winner is unique.
 *
 * @param table Space-joined phrases to the form each one reads as. Keys are
 * matched against the run word by word, exactly as written and without case
 * folding — `tableAnalyzer` behaves the same way, and the fold that does
 * happen is applied later, by the resolver, to the *form* this returns. A
 * one-word key is a phrase of length one and is claimed as such, which makes
 * that case `tableAnalyzer` with the weight pointing the other way.
 *
 * @param weight The boost a match carries, **positive by default**, which is
 * the one place this helper deliberately does not copy its siblings.
 * `suffixStripper` and `tableAnalyzer` pay a penalty because they hand back a
 * *less* exact reading of the one word they were given. A phrase is the
 * opposite: it read two words where `identity` read one, and it has to outrank
 * the bare word's own reading or `"square metres"` resolves to metres and the
 * table never does anything. `+1` is the smallest boost that clears
 * `identity`'s 0 where the two kinds' priors are equal (they are, for every
 * built-in kind but `temperature`); a phrase competing against a kind with a
 * stronger prior should be given a bigger one.
 *
 * **What this cannot do on its own.** The reading arrives, and `pratt` cannot
 * yet spend it: it reads one word per quantity, so `"10 square metres"` fails
 * on "square" — nobody's alias, and no phrase ends there — before "metres" is
 * ever resolved. A multi-word quantity needs the parser to consume several
 * words; see `phrase-analyzer.test.ts`, which pins that limit. What does work
 * today is a phrase whose earlier words another fold absorbs, the numeral fold
 * above all: runs are recorded before the folds run, so `"twenty two kg"`
 * reaches this analyzer as three words and its reading survives to the answer.
 */
export function phraseAnalyzer(table: Record<string, string>, weight = 1): Analyzer {
  /**
   * Indexed by the phrase's last word, because that is the word this analyzer
   * will be asked about: every surface that ends no phrase — which is nearly
   * every word of nearly every input — costs one failed map lookup and
   * nothing else, however large the table is.
   *
   * Longest first within each bucket, so the first match is the winner and
   * there is no second pass. `sort` is stable, so a table listing two phrases
   * of one length is read in the order it was written.
   */
  const byLastWord = new Map<string, { words: string[]; form: string }[]>();
  for (const [phrase, form] of Object.entries(table)) {
    // Stray whitespace in a key is folded away rather than turned into a word
    // no run can hold: "square  metres" is plainly the phrase its author
    // meant, and an unfiltered split would leave it matchable only by a run
    // with an empty word in the middle — that is, never, and silently. A key
    // with no words at all then drops out on its own, having no last word to
    // be indexed under.
    const words = phrase.split(" ").filter((w) => w.length > 0);
    const last = words[words.length - 1];
    if (last === undefined) continue;
    const bucket = byLastWord.get(last);
    if (bucket === undefined) byLastWord.set(last, [{ words, form }]);
    else bucket.push({ words, form });
  }
  for (const bucket of byLastWord.values())
    bucket.sort((a, b) => b.words.length - a.words.length);

  return (surface, ctx) => {
    for (const phrase of byLastWord.get(surface) ?? []) {
      const start = ctx.index - phrase.words.length + 1;
      // The phrase reaches back further than the writer wrote. The comparison
      // below would refuse it too — a negative index reads `undefined`, which
      // is no word — but that is a property of reading the *phrase's* words
      // rather than a window sliced out of the run, and it is the kind of
      // property a later rewrite silently loses. Said out loud, it costs a
      // line and stops being an accident.
      if (start < 0) continue;
      if (phrase.words.every((w, i) => ctx.words[start + i] === w))
        return [{ form: phrase.form, weight }];
    }
    return [];
  };
}
