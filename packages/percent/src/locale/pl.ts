import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Polish words for the percent unit — the same one unit `en` next door names,
 * and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Polish engine and
 * the micro path (`parsePercent`) cannot drift from it. The Polish spellings are
 * appended on top, in every inflected form a reader is likely to type — a
 * vocabulary is what the language's suffix stripper falls back *from*, not a
 * stem list, and the stripper is penalised (`weight: -2`) precisely so that an
 * exact entry here outranks anything it guesses.
 *
 * **One word family, where Ukrainian has two.** Ukrainian carries both
 * "відсоток" (the native coinage its standard prefers) and "процент" (the Latin
 * loan); Polish only ever had the loan, so "procent" is the word and there is no
 * second family to list. Nothing native was dropped — there is nothing to drop.
 *
 * The paradigm is masculine hard, with two cells a translator porting `ru` gets
 * wrong because Polish and Russian disagree about them:
 *
 *   - **The genitive plural is a bare "procent"**, not "procentów". "5 procent",
 *     "20 procent", "sto procent" — Polish gives this noun the zero ending an
 *     ordinary masculine never takes, so the 5+/0/teens row is spelled exactly
 *     like the nominative singular. Russian's is "процентов" and Ukrainian's
 *     "процентів", both with an ending, and both would be the obvious thing to
 *     write here. "procentów" is listed all the same, because it is what people
 *     type for the *interest* sense ("odsetki od procentów") and a reader is not
 *     thinking about which sense they meant.
 *   - **The locative singular alternates t→c**: "w jednym procencie", not
 *     "procentie". No suffix rule can reach that from the stem — `polish.ts`'s
 *     stripper takes "ie" off and leaves "procenc", which is in no index — so
 *     the form has to be listed or it is unreadable.
 *
 * The locative *plural* "procentach" is the form the `in` keyword governs ("w
 * procentach"), which is how a conversion target gets typed, and the other two
 * prepositions this language declares under `in` govern two more cases: "na
 * procenty" is accusative and "do procent" genitive. All three are listed,
 * because recognition is many-to-one — a target reachable through only one
 * preposition stops resolving when the user picks a different word, which is not
 * a choice they are making about percentages.
 *
 * **No `forms`, exactly as `en`, `uk` and `ru` carry none.** Polish genuinely
 * declines "procent" — a sentence writes "w pięciu procentach" — so the absence
 * here is not the `m²` case, where nobody spells the unit out at all. It is
 * `en`'s own reason: the written form of this unit is the symbol. "20%" is what
 * a percentage looks like in a result line in every one of these languages, and
 * a `forms` table would make every percentage anywhere in a Polish engine's
 * output read as a word. Recipe rule: where the `en` unit decided against word
 * forms, this file does not invent them. Reading "20 procent" still works, and
 * answers "20%".
 *
 * `symbol` is explicit all the same (ruling R8): "%" is written the same in
 * Polish, and the renderer's no-symbol branch joins number and unit *without* a
 * space, so a unit that forgot its symbol would move a byte rather than fail.
 *
 * **A Polish engine therefore prints "20 %", spaced, and not "20%".** That is
 * `polish.renderQuantity`, not this file: the language overrides the default
 * template so that a symbol is set off from its number by a space, which is
 * PN-EN ISO 80000 — the same standard that puts the space in "5 kg" puts one
 * before the percent sign. It is a language-wide typographic rule and the wrong
 * thing to work around from a vocabulary, which has no say in the separator at
 * all; the alternative would have been giving this unit a `symbol` of " %" and
 * lying to `Printer`. Ordinary Polish web copy does write "20%" tight, so the
 * output is the standard's spelling rather than the commonest one, and
 * `pl.test.ts` pins it rather than leaving it to be discovered. Both spellings
 * read back — "2 %" and "2%" reach the same value, because `lex` ends the digit
 * run at the space either way.
 *
 * Like `en`, this file names `percent` by id string and never imports the kind,
 * which is what lets `@smartput/percent/locale/pl` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pl",
  kind: "percent",
  units: {
    "%": {
      aliases: [
        ...alias("%"),
        // The singular: nominative/accusative, the two genitives Polish writing
        // uses ("procentu" is the standard one, "procenta" the variant the
        // interest sense and the fractional row — "1,5 procenta" — both take),
        // dative, instrumental, and the t→c locative.
        "procent",
        "procentu",
        "procenta",
        "procentowi",
        "procentem",
        "procencie",
        // The plural. "procent" above is also the genitive plural — the bare-stem
        // row — so it is not repeated here; "procentów" is the ending-bearing
        // variant, listed for reading only.
        "procenty",
        "procentów",
        "procentom",
        "procentach",
        "procentami",
        // "proc." is the abbreviation Polish newspapers set percentages in, and
        // it is listed without its full stop because `lex` ends a word token at
        // the period — the dot never reaches an analyzer, so an alias carrying
        // one could not be matched.
        "proc",
      ],
      symbol: "%",
    },
  },
});
