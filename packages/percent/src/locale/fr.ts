import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * French words for the percent unit — the same one unit `en`, `uk`, `es` and
 * `it` name, and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a French engine and
 * the micro path (`parsePercent`) cannot drift from it. The French spellings are
 * appended on top.
 *
 * **What French writes is "pour cent", and it cannot be an alias.** Two words,
 * and a word token ends at a space, so no lookup can ever reach the pair — that
 * much this kind shares with `uk`'s "градус Цельсія", `es`'s "por ciento" and
 * `it`'s "per cento". Where French lands between those cases is worth stating,
 * because it is neither: "pour" is *not* a French keyword — `fr.ts` spells
 * `times` "fois"/"multiplié" and `by` "par", so nothing claims it — but "cent"
 * *is* a declared scale in `fr-cardinals.ts` (100). So the phrase does not
 * multiply the way Italian's does, and it does not parse either: the numeral
 * fold reads "cent" as 100 and leaves "pour" standing as a word the grammar has
 * no production for. `fr.test.ts` pins the failure as a live assertion so the
 * shape of it is on the record rather than rediscovered.
 *
 * The four French spellings that *are* one token are all listed:
 *
 *   "pourcent"      the univerbated spelling. Prescriptive usage still writes
 *                   the two-word "pour cent", but the fused form is ordinary in
 *                   running text and is the only single token that says the unit
 *                   outright, which makes it the one spelling that can be read.
 *   "pourcents"     its plural. French pluralizes a fused noun in -s, and it is
 *                   declared beside the singular even though `fr.ts`'s suffix
 *                   stripper does recover it — that costs `weight: -2`, and a
 *                   word this file knows about should not arrive penalised.
 *   "pourcentage"   the noun ("le pourcentage"), masculine, and the word a
 *                   conversion target is typed with: "5 / 50 en pourcentage".
 *   "pourcentages"  its plural, declared for the same reason "pourcents" is.
 *
 * No accent-free variant is declared beside any of them, and unlike the Spanish
 * file that is not a decision but an observation: not one of these four words
 * carries an accent. French writes "pour cent" and "pourcentage" with bare
 * vowels throughout.
 *
 * **No `forms`, exactly as `en`, `uk`, `es` and `it` carry none, and for `en`'s
 * reason.** French has an ordinary noun here and would owe only two rows, so
 * this is not the `uk` case where eight keys had to be invented — it is still the
 * case that the written form of this unit is the symbol. "20 %" is what a French
 * result line looks like, and a `forms` table would make every percentage
 * anywhere in a French engine's output read as a word. Reading "20 pourcent"
 * still works, and answers "20 %".
 *
 * That space in "20 %" is French and not a formatting accident: `fr.ts`
 * overrides `renderQuantity` to set one space before every label, symbol
 * included, where the default sets a symbol tight against the number. It is the
 * space every French style guide puts before "%", and it is the reason this
 * kind's output differs from its Italian sibling's by a byte.
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in
 * every language that uses it, and a unit that forgot its symbol would fall
 * through to the unit key rather than fail.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/fr` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "percent",
  units: {
    "%": {
      aliases: [...alias("%"), "pourcent", "pourcents", "pourcentage", "pourcentages"],
      symbol: "%",
    },
  },
});
