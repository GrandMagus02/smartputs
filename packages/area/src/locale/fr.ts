import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * French words for the area units — the same five units `en`, `uk` and `es`
 * next door name, and the same per-unit answer to "does this unit have words at
 * all?".
 *
 * **Two `forms` keys, and the boundary between them is not English's.**
 * `french.selectForm` returns `one` or `other`, but French puts the singular on
 * everything below two: 0 is `one` ("zéro hectare"), 1 is `one`, and every
 * fraction under two is `one` as well — "1,5 hectare", where English writes
 * "1.5 hectares". `other` starts at 2 and also covers the count-free conversion
 * target (ruling R5), which is what French grammar wants anyway: "1 acre en
 * hectares" names the target in the plural. `hectare` is masculine and `acre`
 * feminine, which changes the article and the numeral in front of them and
 * nothing about the noun itself, so gender is not a key here (rule 6) — and
 * neither is CLDR's third French category, which `fr.ts` folds into `other`
 * because it governs a compact scale word and never the noun beside it.
 *
 * **`m²`, `cm²` and `km²` carry no `forms`, exactly as `en`, `uk` and `es`
 * carry none, and get no French alias either.** Their French names are "mètre
 * carré", "centimètre carré", "kilomètre carré" — *two words each*, and `lex`
 * builds a word token out of a run of letters, so a space ends it and no single
 * analyzer is ever handed the phrase. A two-word alias could not be reached by
 * the index that would have to hold it, and a two-word `form` would be text the
 * printer emits and the parser refuses — `assertLocaleContract` says so in as
 * many words. The superscript symbols are therefore the whole of what these
 * three read and print, which is what a French reader writes anyway: nobody
 * types "deux mètres carrés" into a calculator. This is the same limit
 * `phrase-analyzer.ts` documents and the same one that keeps "degré Celsius"
 * out of `@smartput/temperature`'s French vocabulary.
 *
 * **The two named units need no French alias either, and that is a fact about
 * the words rather than an omission.** `hectare` and `acre` are French nouns
 * English borrowed without changing a letter, and both take the plain `-s`
 * plural in both languages, so `aliasesFor` over `units.ts` already puts all
 * four spellings in the index. What this file adds is the `forms` rows that
 * make the French printer *say* them and the `symbol` on every unit that R8
 * asks for; a second copy of "hectare" in `aliases` would be one word claimed
 * twice, which the test next door checks for.
 *
 * `symbol` is `ha`, which is what French itself writes on a land registry, and
 * the bare noun for `acre`, which French does not abbreviate — the same split
 * `en`, `uk` and `es` make, and the choice R8 asks for: an explicit symbol on
 * every unit, never an invented one.
 *
 * Like `en`, `uk` and `es`, this file names `area` by **id string** and never
 * imports the kind, which is what lets `@smartput/area/locale/fr` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "area",
  units: {
    m2: { aliases: [...alias("m2")], symbol: "m²" },
    cm2: { aliases: [...alias("cm2")], symbol: "cm²" },
    km2: { aliases: [...alias("km2")], symbol: "km²" },
    hectare: {
      aliases: [...alias("hectare")],
      symbol: "ha",
      forms: { one: "hectare", other: "hectares" },
    },
    acre: {
      aliases: [...alias("acre")],
      symbol: "acre",
      forms: { one: "acre", other: "acres" },
    },
  },
});
