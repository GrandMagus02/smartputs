import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Ukrainian words for the percent unit — the same one unit `en` next door names,
 * and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so `20 pct` keeps working in a Ukrainian engine
 * and the micro path (`parsePercent`) cannot drift from it. The Cyrillic
 * spellings are appended on top, in every inflected form a reader is likely to
 * type — a vocabulary is what the language's suffix stripper falls back *from*,
 * not a stem list, and the stripper is penalised (`weight: -2`) precisely so
 * that an exact entry here outranks anything it guesses. Its `minStem: 3` also
 * means "відсотку" only ever reduces to the non-word "відсотк", so the dative
 * and locative singulars earn their lines rather than being covered for free.
 *
 * **Two synonym families, not one.** "відсоток" is the Ukrainian word and what
 * the standard prefers; "процент" is the Latin loan, still ordinary in speech
 * and in older textbooks. Both are listed in full because both get typed, and
 * neither may be missing on the read side — the aliases are the *input* surface
 * and nothing about them is a claim about how output is spelled.
 *
 * **No `forms`, exactly as `en` carries none.** Ukrainian genuinely declines
 * "відсоток" — a sentence writes "у п'яти відсотках" — so the absence here is
 * not the `м²` case, where nobody spells the unit out at all. It is `en`'s own
 * reason: the written form of this unit is the symbol. "20%" is what a
 * percentage looks like in a result line in either language, and a `forms` table
 * would make every percentage anywhere in a Ukrainian engine's output read as a
 * word. Recipe rule: where the `en` unit decided against word forms, this file
 * does not invent them. Reading "20 відсотків" still works, and answers "20%".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in both
 * scripts, and the renderer's no-symbol branch joins number and unit *without* a
 * space, so a unit that forgot its symbol would move a byte rather than fail.
 *
 * Like `en`, this file names `percent` by id string and never imports the kind,
 * which is what lets `@smartput/percent/locale/uk` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // відсоток: nominative, genitive, dative, nominative plural, genitive
        // plural, dative plural, locative plural, instrumental singular,
        // instrumental plural. The locative plural "відсотках" is the form the
        // `in` keyword governs ("у відсотках"), which is how a conversion
        // target gets typed.
        "відсоток",
        "відсотка",
        "відсотку",
        "відсотки",
        "відсотків",
        "відсоткам",
        "відсотках",
        "відсотком",
        "відсотками",
        // процент: the same nine cells of the same paradigm for the loan word.
        "процент",
        "процента",
        "проценту",
        "проценти",
        "процентів",
        "процентам",
        "процентах",
        "процентом",
        "процентами",
      ],
      symbol: "%",
    },
  },
});
