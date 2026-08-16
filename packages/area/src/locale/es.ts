import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Spanish words for the area units — the same five units `en` and `uk` next
 * door name, and the same per-unit decision about whether a unit has words at
 * all.
 *
 * **Two `forms` keys, not eight.** `spanish.selectForm` returns a bare CLDR
 * plural category: `one` for a count of exactly 1, `other` for everything else —
 * 0, a fraction, a missing count (ruling R5), and the multiples of a million
 * CLDR files under `many`, which the language folds in because this engine
 * never prints compact notation. Spanish inflects a unit noun for number and
 * nothing else, so this is the two-row English shape. `hectárea` is feminine
 * and `acre` masculine, which changes the article and the numeral in front of
 * them and nothing about the noun itself, so gender is not a key here (rule 6).
 *
 * **`m²`, `cm²` and `km²` carry no `forms`, exactly as `en` and `uk` carry
 * none, and get no Spanish alias either.** Their Spanish names are "metro
 * cuadrado", "centímetro cuadrado", "kilómetro cuadrado" — *two words each*,
 * and `lex` builds a word token out of a run of letters, so a space ends it and
 * no single analyzer is ever handed the phrase. A two-word alias could not be
 * reached by the index that would have to hold it, and a two-word `form` would
 * be text the printer emits and the parser refuses. The superscript symbols are
 * therefore the whole of what these three read and print, which is what a
 * Spanish reader writes anyway: nobody types "dos metros cuadrados" into a
 * calculator.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Spanish engine and
 * the micro path (`parseArea`) cannot drift from it. `hectárea` is appended in
 * both numbers and, beside each, its accent-free twin — NFKC folding leaves a
 * precomposed `á` as `á` rather than stripping it, so `hectarea` is a different
 * string to the index and is declared rather than hoped for; `es.ts` declares
 * "mas" beside "más" in its own keyword table for the same reason. `acre` has
 * no accent and needs no twin.
 *
 * `symbol` is `ha`, which is what Spanish itself writes, and the bare noun for
 * `acre`, which Spanish does not abbreviate — the same split `en` makes, and
 * the choice R8 asks for: an explicit symbol on every unit, never an invented
 * one.
 *
 * Like `en` and `uk`, this file names `area` by **id string** and never imports
 * the kind, which is what lets `@smartput/area/locale/es` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "es",
  kind: "area",
  units: {
    m2: { aliases: [...alias("m2")], symbol: "m²" },
    cm2: { aliases: [...alias("cm2")], symbol: "cm²" },
    km2: { aliases: [...alias("km2")], symbol: "km²" },
    hectare: {
      aliases: [...alias("hectare"), "hectárea", "hectáreas", "hectarea", "hectareas"],
      symbol: "ha",
      forms: { one: "hectárea", other: "hectáreas" },
    },
    // Spelled identically to the English word and pluralised identically too,
    // which is a coincidence of the borrowing and not a reason to skip the
    // entry: `units.ts` maps "acre"/"acres" to this unit for the English
    // vocabulary, and the `forms` rows below are what make the Spanish printer
    // say them.
    acre: {
      aliases: [...alias("acre")],
      symbol: "acre",
      forms: { one: "acre", other: "acres" },
    },
  },
});
