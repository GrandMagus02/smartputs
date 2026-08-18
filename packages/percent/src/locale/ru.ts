import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Russian words for the percent unit — the same one unit `en` next door names,
 * and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so `20 pct` keeps working in a Russian engine and
 * the micro path (`parsePercent`) cannot drift from it. The Cyrillic spellings
 * are appended on top, in every inflected form a reader is likely to type — a
 * vocabulary is what the language's suffix stripper falls back *from*, not a
 * stem list, and the stripper is penalised (`weight: -2`) precisely so that an
 * exact entry here outranks anything it guesses.
 *
 * **One word family, where Ukrainian has two.** Ukrainian carries both
 * "відсоток" (the native coinage the standard prefers) and "процент" (the Latin
 * loan); Russian only ever had the loan, so "процент" is the word and there is
 * no second family to list. Nothing native was dropped — there is nothing to
 * drop. The word is masculine hard and declines the ordinary way, and the four
 * rows CLDR's categories would select between are listed for reading even though
 * none of them is printed:
 *
 *   1 процент      nominative singular
 *   2 процента     genitive singular — the 2/3/4 row
 *   5 процентов    genitive plural
 *   1,5 процента   genitive singular again, the fractional row
 *
 * That last coincidence is a real fact about Russian and not a shortcut: the
 * 2/3/4 row and the fractional row are the same word, where Ukrainian's are two
 * different words ("2 відсотки" against "1,5 відсотка"). It matters here only
 * for the reading side, but it is the trap a translator porting `uk` walks into
 * on every unit in this phase, so it is written down where a translator will be.
 *
 * The stripper is not a substitute for the list. Its `minStem: 3` still leaves
 * every one of these recoverable ("процентах" → "процент"), but a printed or
 * typed form recovered only through the penalised path is a form this vocabulary
 * is guessing at rather than declaring, and the exact entry is what makes the
 * reading win outright.
 *
 * **No `forms`, exactly as `en` and `uk` carry none.** Russian genuinely
 * declines "процент" — a sentence writes "в пяти процентах" — so the absence
 * here is not the `м²` case, where nobody spells the unit out at all. It is
 * `en`'s own reason: the written form of this unit is the symbol. "20%" is what
 * a percentage looks like in a result line in every one of the three languages,
 * and a `forms` table would make every percentage anywhere in a Russian engine's
 * output read as a word. Recipe rule: where the `en` unit decided against word
 * forms, this file does not invent them. Reading "20 процентов" still works, and
 * answers "20%".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in both
 * scripts, and the renderer's no-symbol branch joins number and unit *without* a
 * space, so a unit that forgot its symbol would move a byte rather than fail.
 *
 * Like `en`, this file names `percent` by id string and never imports the kind,
 * which is what lets `@smartput/percent/locale/ru` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // The full singular paradigm — nominative, genitive, dative,
        // instrumental, prepositional — and then the plural. "процентах" is the
        // form the `in` keyword governs ("в процентах"), which is how a
        // conversion target gets typed, and "процентов" is the 5+/0/teens row a
        // reader types most often of all.
        "процент",
        "процента",
        "проценту",
        "процентом",
        "проценте",
        "проценты",
        "процентов",
        "процентам",
        "процентах",
        "процентами",
        // "проц." is the abbreviation Russian technical writing uses, and it is
        // listed without its full stop because `lex` ends a word token at the
        // period — the dot never reaches an analyzer, so an alias carrying one
        // could not be matched.
        "проц",
      ],
      symbol: "%",
      tight: true,
    },
  },
});
