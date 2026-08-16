import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Spanish words for the mass units — the same six units `en` and `uk` next door
 * name, and the same per-unit decision: all six are nouns a Spanish speaker
 * writes out, so all six carry `forms`.
 *
 * **Two `forms` keys, not eight.** `spanish.selectForm` returns a bare CLDR
 * plural category — `one` for a count of exactly 1, `other` for everything else,
 * a fraction and a missing count (ruling R5) included, and the multiples of a
 * million CLDR files under `many` folded in because this engine never prints
 * compact notation. Spanish inflects a unit noun for number and for nothing
 * else, so the two-row English shape is the whole of it. Gender is real and
 * splits this kind down the middle — `gramo`, `kilogramo` and `miligramo` are
 * masculine, `tonelada`, `onza` and `libra` feminine — but it belongs to the
 * *noun*, never to the slot, so it selects nothing and is not a key (rule 6).
 * What gender would change is the numeral in front ("una libra", "doscientas
 * libras"), and `NumeralSpeller` is handed a magnitude and no unit at all, so
 * `es.ts` already names that as out of reach rather than half-solving it here.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Spanish engine and
 * the micro path (`parseMass`) cannot drift from it. That map's `kilo`/`kilos`
 * arrive for free and are exactly what a Spanish speaker says out loud, so the
 * clipping needs no Spanish entry of its own.
 *
 * The Spanish spellings are appended, singular and plural both, because every
 * string this file *prints* has to be a string it reads and a printed plural
 * recovered only by the language's penalised suffix stripper is a reading this
 * vocabulary should not be leaving to a guess. Every plural here is the plain
 * `-s` of a vowel-final noun, so none of them moves an accent — the failure
 * mode `@smartput/volume`'s `galón`/`galones` has and this kind does not.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Spanish itself prints on a scale or a label ("500 g", "1,2 t"), and the
 * spelled singular noun on the two imperial ones. `oz` and `lb` do appear in
 * Spanish, but as the English abbreviations they are — `units.ts` already
 * registers both as aliases, so reading them costs this file nothing, while
 * *printing* "8oz" at a reader who typed "onzas" would be answering in another
 * language. Ukrainian reaches the same two symbols by the same reasoning
 * (R8 wants an explicit symbol, never an invented one).
 *
 * Like `en` and `uk`, this file names `mass` by **id string** and never imports
 * the kind, which is what lets `@smartput/mass/locale/es` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "es",
  kind: "mass",
  units: {
    // One `l`, unlike English's "milligram": Spanish borrowed the prefix as
    // `mili-` and doubles no consonant here.
    mg: {
      aliases: [...alias("mg"), "miligramo", "miligramos"],
      symbol: "mg",
      forms: { one: "miligramo", other: "miligramos" },
    },
    g: {
      aliases: [...alias("g"), "gramo", "gramos"],
      symbol: "g",
      forms: { one: "gramo", other: "gramos" },
    },
    kg: {
      // `kilo`/`kilos` come from `units.ts` and are the everyday Spanish word,
      // not a concession to English: "dos kilos de harina" is what is said.
      aliases: [...alias("kg"), "kilogramo", "kilogramos"],
      symbol: "kg",
      forms: { one: "kilogramo", other: "kilogramos" },
    },
    t: {
      aliases: [...alias("t"), "tonelada", "toneladas"],
      symbol: "t",
      forms: { one: "tonelada", other: "toneladas" },
    },
    oz: {
      aliases: [...alias("oz"), "onza", "onzas"],
      symbol: "onza",
      forms: { one: "onza", other: "onzas" },
    },
    lb: {
      aliases: [...alias("lb"), "libra", "libras"],
      symbol: "libra",
      forms: { one: "libra", other: "libras" },
    },
  },
});
