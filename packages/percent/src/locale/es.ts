import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Spanish words for the percent unit — the same one unit `en` and `uk` name, and
 * the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Spanish engine and
 * the micro path (`parsePercent`) cannot drift from it. The Spanish spellings
 * are appended on top.
 *
 * **What Spanish writes is "por ciento", and it cannot be an alias.** Two words,
 * and a word token ends at a space, so no lookup can ever reach the pair — that
 * much this kind shares with `uk`'s "градус Цельсія". What it does *not* share
 * is what happens to the fragments: "por" is `spanish.keywords.times` and
 * "ciento" is a declared cardinal (100), so "20 por ciento" does not fail to
 * parse, it parses as arithmetic and answers 2000. That is a genuine collision
 * between a unit phrase and an operator word, it is not resolvable inside a
 * vocabulary — `por` earns its keyword slot on "3 por 4", which is far commoner
 * — and `es.test.ts` pins the wrong answer as a live assertion so the trade is
 * on the record rather than rediscovered.
 *
 * The three Spanish words that *are* one token are all listed:
 *
 *   "porciento"   the univerbated spelling, ordinary across Latin America and
 *                 the only single-token way to say the unit outright.
 *   "porcentaje"  the noun ("el porcentaje"), and the word a conversion target
 *                 is typed with: "5 / 50 en porcentaje".
 *   "porcentajes" its plural, listed rather than left to the suffix stripper —
 *                 the stripper would recover it (dropping "s" leaves the alias),
 *                 but at `weight: -2`, and a word this file knows about should
 *                 not arrive penalised.
 *
 * **No `forms`, exactly as `en` and `uk` carry none, and for `en`'s reason.**
 * Spanish has an ordinary noun here and would owe only two rows, so this is not
 * the `uk` case where eight keys had to be invented — it is still the case that
 * the written form of this unit is the symbol. "20%" is what a percentage looks
 * like in a result line in Spanish print, and a `forms` table would make every
 * percentage anywhere in a Spanish engine's output read as a word. Reading "20
 * porciento" still works, and answers "20%".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in
 * every language that uses it, and the renderer's no-symbol branch joins number
 * and unit *without* a space, so a unit that forgot its symbol would move a byte
 * rather than fail.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/es` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "es",
  kind: "percent",
  units: {
    "%": {
      aliases: [...alias("%"), "porciento", "porcentaje", "porcentajes"],
      symbol: "%",
      tight: true,
    },
  },
});
