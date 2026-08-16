import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Dutch words for the percent unit — the same one unit `en` next door names, and
 * the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Dutch engine and
 * the micro path (`parsePercent`) cannot drift from it. The Dutch spellings are
 * appended on top.
 *
 * **The Dutch paradigm, and which cells are here.** *Procent* is a neuter noun —
 * *het procent* — and like every Dutch measure noun it stays in the **singular**
 * after a numeral: "20 procent", never "20 procenten". That is the same rule that
 * gives "tien meter" and "drie jaar", and it is stated in
 * `@smartput/core/locale/nl`'s own doc comment as the thing Dutch brings that
 * neither German nor English does. The plural *procenten* is the free noun — "de
 * procenten tellen op" — and it is listed all the same, because the aliases are
 * the *input* surface and a reader who writes it must be understood; nothing
 * about listing it is a claim about how output is spelled.
 *
 * **`procenten` earns its line, where German's `Prozente` would not have.**
 * `de.ts` next door can leave inflected cells out because German's stripper takes
 * `-e`/`-en`/`-n`/`-s` off and lands back on the listed word. Dutch's stripper
 * deliberately does **not** strip `en` — `nl.ts` explains why at length: Dutch's
 * main plural shortens an open syllable (*jaar* → *jaren*) or doubles a consonant
 * (*ton* → *tonnen*), so stripping `en` yields a stem that is not the singular in
 * exactly the cases it would be needed for. *Procenten* happens to be one of the
 * well-behaved ones, but the rule is off for the language, so the plural is a
 * word this vocabulary declares rather than a word it hopes for. This is the
 * general shape of a Dutch vocabulary: more plurals written out than a German one
 * needs, and that is a consequence of a language-level decision rather than of
 * anything about percentages.
 *
 * `percent` is not listed and is not missing either: it is already in the Latin
 * alias map, and it is *also* an ordinary Dutch spelling of the same word (both
 * "procent" and "percent" are current). An alias indexed twice is a duplicate
 * candidate at every keystroke, so the reuse above already carries it.
 *
 * **"Procentpunt" is deliberately not claimed.** A percentage point is a
 * different quantity from a percentage — a rate moving from 2 % to 3 % rises by
 * one point and by fifty percent — so claiming the word here would answer a
 * different question than the one asked. It is a compound Dutch would happily
 * split (`COMPOUND_HEADS` in `@smartput/core/locale/nl` is morphology and lives
 * in the language, and "procent" is not one of its heads, precisely so that this
 * does not happen by accident).
 *
 * **No `forms`, exactly as `en`, `uk` and `de` carry none.** Dutch has a real
 * plural for this noun, so the absence is not "the language has no word". It is
 * `en`'s own reason: the written form of this unit is the symbol. What Dutch adds
 * is that `dutch.renderQuantity` sets a symbol off from its number with a space,
 * following SI as `de.ts` does — so "20 %" is what comes out, and the one thing a
 * `forms` table could have bought here (a spelled-out unit that looks like Dutch)
 * the language has already bought, in a notation a Dutch reader reads without
 * blinking. Recipe rule: where the `en` unit decided against word forms, this file
 * does not invent them. Reading "20 procent" still works, and answers "20 %".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in every
 * language here, and the renderer's no-symbol branch would fall through to the
 * unit key rather than fail.
 *
 * Like `en`, this file names `percent` by id string and never imports the kind,
 * which is what lets `@smartput/percent/locale/nl` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // Singular — and the form that stands after every numeral, because a
        // Dutch measure noun does not pluralise there.
        "procent",
        // The free plural, "de procenten". Listed rather than left to the
        // stripper, which does not take `en` off in this language.
        "procenten",
      ],
      symbol: "%",
    },
  },
});
