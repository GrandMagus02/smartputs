import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Italian words for the typographic units — the same six `en`, `uk` and `es`
 * next door name, with the same answer to "does this unit have words at all?":
 * all six do.
 *
 * **Two `forms` keys, not eight and not three.** `italian.selectForm` returns
 * `one` for an integer count of exactly 1 and `other` for everything else — 0, a
 * fraction, and a missing count (ruling R5). `Intl.PluralRules("it")` declares a
 * third category, `many`, which CLDR gives to exact millions because Italian
 * says "un milione **di** pixel"; the language folds it into `other` once,
 * centrally, because this engine prints "1.000.000 pixel" and the word there is
 * the ordinary plural. Italian nouns do not decline, so "in punti" is the same
 * word as "72 punti", and there is no second axis to key on the way Ukrainian
 * keys on case (rule 6).
 *
 * The Latin aliases are **reused** rather than retyped, via `aliasesFor` over
 * the one alias map in `units.ts`, so `72 pt` keeps working in an Italian engine
 * and the micro path (`parseMeasure`) cannot drift from it. The Italian
 * spellings are appended, singular and plural both, because every string this
 * file *prints* has to be a string it reads, and Italian **substitutes** the
 * final vowel to make a plural instead of adding to it — so `it.ts` can only
 * fold one backwards through a substitution table at `weight: -2`, and a word
 * this file chose to print should not depend on a guess.
 *
 * Three of the six need a note, and each is a different inflectional class:
 *
 *   `pollice` → `pollici` is the third declension, `-e → -i`. Italian's word for
 *   an inch is also its word for a thumb, which is the same metaphor English
 *   stopped saying out loud.
 *
 *   `pica` → `piche` is the feminine velar class: the `h` is written to keep the
 *   `c` hard in front of the plural `-e`, exactly as `amica` → `amiche`. It is
 *   the mirror of the `chi → co` row `it.ts` carries for the masculine velars
 *   (`franchi` → `franco`), and that language folds it back with a `che → ca`
 *   row of its own — one class, described once in each direction, rather than
 *   the masculine half alone. Both spellings are declared here all the same,
 *   because the fold costs `weight: -2` and rule 5 wants a printed word listed
 *   outright rather than reached through a penalised guess.
 *
 *   `pixel` is **invariant**: "due pixel", never "due pixeli". It is a loanword
 *   ending in a consonant, so it has no final vowel to substitute — the class
 *   `it.ts` names with `watt`, `bar` and `joule`, and the reason that language's
 *   fold table has no row for it. Both `forms` rows therefore hold the same
 *   string, which is the language's actual answer rather than a row left
 *   unfinished. Spanish needs `píxel`/`píxeles` and an accent that moves;
 *   Italian needs neither, and inventing a plural to make the table look varied
 *   would be printing a word nobody types.
 *
 * The three typographic symbols stay Latin — `pt`, `pc`, `px` are what an
 * Italian designer writes in a stylesheet, and inventing `pnt` would be a word
 * this file made up rather than one anybody types. `mm` and `cm` are the
 * international abbreviations Italian itself prints. The inch gets its noun,
 * because Italian has no abbreviation of its own for it and the short form that
 * appears is the English `in` — which is *also* Italian's own conversion keyword
 * (`@smartput/core/locale/it` claims "in" and "a"), so `lex` would emit a
 * keyword token for it and no alias index could claim it anyway. That is the
 * same choice `@smartput/length/locale/it` makes for the same unit, and every
 * symbol here is also an alias, which is what `assertLocaleContract` checks: a
 * printed string the engine cannot read back is the failure.
 *
 * Like `en`, `uk` and `es`, this file names `measure` by **id string** and never
 * imports the kind. `composeLocale` is where the two halves meet — and, as
 * there, a caller has to ask for this vocabulary by name: `measure` is outside
 * `BUILTIN_KINDS` because its `mm`/`cm` aliases collide with `length`, so it is
 * absent from `@smartput/kinds/locale/it` for exactly the reason the kind is
 * absent from the roster.
 */
export default defineVocabulary({
  locale: "it",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "pollice", "pollici"],
      symbol: "pollice",
      forms: { one: "pollice", other: "pollici" },
    },
    mm: {
      aliases: [...alias("mm"), "millimetro", "millimetri"],
      symbol: "mm",
      forms: { one: "millimetro", other: "millimetri" },
    },
    cm: {
      aliases: [...alias("cm"), "centimetro", "centimetri"],
      symbol: "cm",
      forms: { one: "centimetro", other: "centimetri" },
    },
    pt: {
      aliases: [...alias("pt"), "punto", "punti"],
      symbol: "pt",
      forms: { one: "punto", other: "punti" },
    },
    // `pica` itself arrives from `units.ts` — the borrowing is spelled the same
    // in both languages — so only the Italian plural is new here.
    pc: {
      aliases: [...alias("pc"), "piche"],
      symbol: "pc",
      forms: { one: "pica", other: "piche" },
    },
    px: {
      aliases: [...alias("px")],
      symbol: "px",
      forms: { one: "pixel", other: "pixel" },
    },
  },
});
