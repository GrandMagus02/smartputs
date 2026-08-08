import type { AnalyzedForm, Language, WordPosition } from "../types";
import { identity } from "./helpers";

/**
 * One language's analyzers, folded into a single memoized lookup.
 *
 * `position` is optional and the whole of what Task 19 added: a caller that
 * has the segmented run — the lexer, through the resolver — passes it, and an
 * analyzer that cares about neighbours (a prefix stripper, a compound
 * splitter) reads it off `ctx`. A caller that has only a word passes nothing
 * and gets the degenerate run `[surface]` at index 0, which is what every
 * analyzer written before this saw and could not tell apart.
 *
 * The memo key follows the same split, because the two callers want different
 * things from it. With no position the key is the bare surface, so the common
 * path — one word, asked about once per input, per language — keeps exactly
 * one entry per distinct word, which is what it had before. With a position
 * the key is the index and the whole run (`"1 square metres"`), because the
 * answer is now a function of all three: the same word at a different index,
 * or at the same index in a different run, is a different question and must
 * not read a neighbour's cached answer. Keying on the surface alone would do
 * exactly that, and the failure would be invisible — a correct answer for the
 * first "metres" the engine ever saw, silently reused for every later one.
 *
 * The run determines the surface (`words[index] === surface`, guaranteed by
 * the lexer that builds it), so the surface is not part of the position key;
 * it would be a constant added to every entry.
 *
 * The cache is a closure variable, so each language's chain has its own and
 * two languages analyzing the same word never collide (`createResolver` holds
 * one chain per installed locale).
 */
export function createAnalyzerChain(
  language: Language,
): (surface: string, position?: WordPosition) => AnalyzedForm[] {
  const chain = [...(language.analyze ?? [identity()])];
  const locale = language.id;
  const cache = new Map<string, AnalyzedForm[]>();

  return (surface, position) => {
    const key =
      position === undefined ? surface : `${position.index} ${position.words.join(" ")}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const ctx =
      position === undefined
        ? { locale, words: [surface], index: 0 }
        : { locale, words: position.words, index: position.index };

    const best = new Map<string, AnalyzedForm>();
    for (const analyzer of chain) {
      for (const produced of analyzer(surface, ctx)) {
        const weight = produced.weight ?? 0;
        const existing = best.get(produced.form);
        if (existing === undefined || weight > (existing.weight ?? 0)) {
          best.set(produced.form, { ...produced, weight });
        }
      }
    }

    const forms = [...best.values()].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    cache.set(key, forms);
    return forms;
  };
}
