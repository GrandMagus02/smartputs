import { aliasesFor, defineVocabulary } from "@smartput/core";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Italian words for the area units — the same five units `en`, `uk` and `es`
 * next door name, and the same per-unit decision about whether a unit has words
 * at all.
 *
 * **Two `forms` keys, not eight and not three.** `italian.selectForm` returns
 * `one` for an integer count of exactly 1 and `other` for everything else — 0, a
 * fraction, and a missing count (ruling R5). `Intl.PluralRules("it")` declares a
 * third category, `many`, which CLDR gives to exact millions because Italian
 * says "un milione **di** ettari"; the language folds it into `other` once,
 * centrally, because this engine never prints a compact million. Italian nouns
 * inflect for number and for nothing else here — they do not decline, so "in
 * ettari" is the same word as "5 ettari" — which is why this is English's
 * two-row shape rather than Ukrainian's grid.
 *
 * Gender is worth one line, because Italian and Spanish disagree about it and
 * neither disagreement reaches the table: `ettaro` is **masculine** in Italian
 * (`un ettaro`, `due ettari`) where Spanish's `hectárea` is feminine, and `acro`
 * is masculine in both. Gender lives on the noun, selects nothing, and must not
 * be a key (rule 6); what it changes is the article and the numeral in front,
 * which no `forms` key can reach.
 *
 * **`m²`, `cm²` and `km²` carry no `forms`, exactly as `en`, `uk` and `es` carry
 * none, and get no Italian alias either.** Their Italian names are "metro
 * quadrato", "centimetro quadrato", "chilometro quadrato" — *two words each*,
 * and `lex` builds a word token out of a run of letters, so a space ends it and
 * no single analyzer is ever handed the phrase. A two-word alias could not be
 * reached by the index that would have to hold it, and a two-word `form` would
 * be text the printer emits and the parser refuses. Italian has no one-word
 * colloquial name to fall back on the way Ukrainian has "кубометр" for volume,
 * so the superscript symbols are the whole of what these three read and print —
 * which is what an Italian reader writes anyway: nobody types "due metri
 * quadrati" into a calculator.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in an Italian engine and
 * the micro path (`parseArea`) cannot drift from it. The Italian spellings are
 * appended, singular and plural both, because every string this file *prints*
 * has to be a string it reads — and Italian **substitutes** the final vowel to
 * make a plural rather than adding to it, so `it.ts` can only fold `ettari` back
 * to `ettaro` through a substitution table at `weight: -2`. Both nouns take the
 * plain masculine `-o → -i` (`it.ts`'s `i → o` row), the most ordinary class the
 * language has; declaring them anyway is what keeps a printed word off that
 * penalised path. Neither carries an accent, so unlike `es` neither needs an
 * accent-free twin.
 *
 * `symbol` is `ha`, which is what Italian itself writes, and the bare noun for
 * `acro`, which Italian does not abbreviate — the same split `en`, `uk` and `es`
 * make, and the choice R8 asks for: an explicit symbol on every unit, never an
 * invented one.
 *
 * Like `en`, `uk` and `es`, this file names `area` by **id string** and never
 * imports the kind, which is what lets `@smartput/area/locale/it` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "it",
  kind: "area",
  units: {
    m2: { aliases: [...alias("m2")], symbol: "m²" },
    cm2: { aliases: [...alias("cm2")], symbol: "cm²" },
    km2: { aliases: [...alias("km2")], symbol: "km²" },
    hectare: {
      aliases: [...alias("hectare"), "ettaro", "ettari"],
      symbol: "ha",
      forms: { one: "ettaro", other: "ettari" },
    },
    // The English `acre`/`acres` arrive from `units.ts` and stay readable; the
    // Italian noun is `acro`, one letter and a whole inflectional class away
    // from them, so both spellings of both languages are listed and the Italian
    // one is printed.
    acre: {
      aliases: [...alias("acre"), "acro", "acri"],
      symbol: "acro",
      forms: { one: "acro", other: "acri" },
    },
  },
});
