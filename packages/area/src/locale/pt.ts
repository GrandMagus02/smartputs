import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Portuguese words for the area units — Brazilian under the bare `pt` tag,
 * this project's ruling and also what the platform does (`Intl.NumberFormat("pt")`
 * resolves to "." for groups and "," for the decimal). Neither of the two nouns
 * below is spelled differently in Portugal, so there is no second orthography to
 * declare here the way `@smartput/core/locale/pt-cardinals` has to.
 *
 * **Two `forms` keys, not eight.** `portuguese.selectForm` returns a bare CLDR
 * plural category, and folds CLDR's third Portuguese category — `many`, for the
 * whole multiples of a million — into `other`, because `many` is a fact about
 * the *numeral* ("1 milhão") rather than about the noun after it. Portuguese
 * inflects a unit noun for number and for nothing else: it has no case, so a
 * conversion target ("em hectares") is spelled exactly like a bare quantity and
 * the slot axis Ukrainian and German need selects nothing here (rule 6). Gender
 * is real — `o hectare` masculine, `o acre` masculine too, so this kind happens
 * not to split — but it belongs to the noun and never to the slot.
 *
 * Two rows an English-trained eye will read as wrong and which are the language:
 * **0 selects `one`** (CLDR's Portuguese rule is `i = 0..1`, so "0 hectare"),
 * and **1,5 selects `one`** as well — "1,5 hectare", the exact opposite of
 * English's "1.5 hectares". Both are pinned in `pt.test.ts` beside this file.
 *
 * **`m²`, `cm²` and `km²` carry no `forms`, exactly as `en`, `uk` and `es` carry
 * none, and get no Portuguese alias either.** Their Portuguese names are "metro
 * quadrado", "centímetro quadrado", "quilômetro quadrado" — *two words each*,
 * and `lex` builds a word token out of a run of letters, so a space ends it and
 * no single analyzer is ever handed the phrase. A two-word alias could not be
 * reached by the index that would have to hold it, and a two-word `form` would
 * be text the printer emits and the parser refuses (`assertLocaleContract` says
 * so in as many words). The superscript symbols are the whole of what these
 * three read and print, which is what a Portuguese reader writes anyway.
 *
 * **The two nouns that do have words need no new alias at all**, which is worth
 * saying out loud rather than leaving as an empty-looking entry: Portuguese
 * borrowed both units under the spellings English already uses and pluralises
 * both with the same `-s`, so `units.ts`'s `hectare`/`hectares`/`ha` and
 * `acre`/`acres` are already the Portuguese words. What this file adds is the
 * `forms` rows that make the *printer* say them — Spanish next door had to spell
 * out `hectárea` because its borrowing took an accent and a different ending,
 * and this file not having to is a fact about Portuguese, not an omission.
 *
 * The Latin aliases are **reused** rather than retyped for that reason and the
 * usual one: `aliasesFor` reads the one alias map in `units.ts`, so "2 ha" keeps
 * working in a Portuguese engine and the micro path (`parseArea`) cannot drift
 * from it.
 *
 * `symbol` is `ha`, which is what Portuguese itself writes on a land title, and
 * the bare noun for `acre`, which Portuguese does not abbreviate — the same
 * split `en`, `uk` and `es` make, and the choice R8 asks for: an explicit symbol
 * on every unit, never an invented one.
 *
 * Like the others, this file names `area` by **id string** and never imports the
 * kind, which is what lets `@smartput/area/locale/pt` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "pt",
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
