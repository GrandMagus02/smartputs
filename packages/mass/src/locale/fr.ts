import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * French words for the mass units — the same six units `en`, `uk` and `es` next
 * door name, and the same per-unit answer: all six are nouns a French speaker
 * writes out, so all six carry `forms`.
 *
 * **Two `forms` keys, and the boundary between them is not English's.**
 * `french.selectForm` returns `one` or `other`, but French puts the singular on
 * everything below two: 0 is `one` ("zéro gramme"), 1 is `one`, and *every*
 * fraction under two is `one` as well — "1,5 kilogramme", where English writes
 * "1.5 kilograms". A table ported from `en.ts` by copying the two column
 * headings is wrong on exactly those rows and wrong nowhere else, which is why
 * `fr.test.ts` asserts 0 and 1,5 by hand rather than trusting the shape. `other`
 * starts at 2 and also covers the count-free conversion target (ruling R5),
 * which is right for French on its own terms: "1 kg en grammes" names the
 * target in the plural.
 *
 * Gender is real here and splits the kind down the middle — `milligramme`,
 * `gramme` and `kilogramme` are masculine, `tonne`, `once` and `livre`
 * feminine — but it belongs to the *noun* and never to the slot, so it selects
 * nothing and must not be a key (rule 6). What gender would change is the
 * numeral in front ("une livre", "une tonne"), and `fr-cardinals.ts` already
 * carries `une` as a reading key for that reason; a `NumeralSpeller` is handed
 * a magnitude and no unit at all, so agreement there is out of reach rather
 * than half-solved here.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a French engine and
 * the micro path (`parseMass`) cannot drift from it. That map's `kilo`/`kilos`
 * arrive for free and are exactly what a French speaker says out loud ("deux
 * kilos de farine"), so the clipping needs no French entry of its own — and
 * `tonne`/`tonnes` arrive for free too, because English borrowed the word from
 * French and neither language has changed a letter of it.
 *
 * Every French spelling is appended in both numbers, because every string this
 * file *prints* has to be a string it reads and a printed plural recovered only
 * by the language's penalised suffix stripper is a reading this vocabulary
 * should not be leaving to a guess. Every plural here is the plain `-s` French
 * adds to a vowel- or consonant-final noun, and none of them moves an accent —
 * no unit noun in this kind carries one at all, unlike `@smartput/angle`'s
 * "degré" or `@smartput/volume`'s nothing-in-particular.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what French itself prints on a scale or a label ("500 g", "1,2 t"), and the
 * spelled singular noun on the two imperial ones. French has no abbreviation of
 * its own for an ounce or a pound: `oz` and `lb` do appear, but as the English
 * abbreviations they are, and `units.ts` already registers both as aliases, so
 * *reading* them costs this file nothing while *printing* "8 oz" at a reader
 * who typed "onces" would be answering in another language. `uk` and `es` reach
 * the same two symbols by the same reasoning (R8 wants an explicit symbol,
 * never an invented one).
 *
 * Note for whoever writes `@smartput/rate/locale/fr`: `livre` is also the
 * French name of the pound *sterling*, so the two vocabularies will claim the
 * same surface for different kinds. That is the ordinary cross-kind ambiguity
 * the solver ranks — "2 livres" is a mass and "2 livres en euros" is money —
 * and not something either file should avoid by inventing a word nobody says.
 *
 * Like `en`, `uk` and `es`, this file names `mass` by **id string** and never
 * imports the kind, which is what lets `@smartput/mass/locale/fr` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "mass",
  units: {
    // Two `m`s and two `m`s: French writes "milligramme" with the doubled
    // consonant English dropped when it borrowed the word back as "milligram".
    mg: {
      aliases: [...alias("mg"), "milligramme", "milligrammes"],
      symbol: "mg",
      forms: { one: "milligramme", other: "milligrammes" },
    },
    g: {
      aliases: [...alias("g"), "gramme", "grammes"],
      symbol: "g",
      forms: { one: "gramme", other: "grammes" },
    },
    kg: {
      // `kilo`/`kilos` come from `units.ts` and are the everyday French word,
      // not a concession to English: "deux kilos" is what is said at a market.
      aliases: [...alias("kg"), "kilogramme", "kilogrammes"],
      symbol: "kg",
      forms: { one: "kilogramme", other: "kilogrammes" },
    },
    // The one unit whose French spelling is already in `units.ts`: English
    // spells the metric tonne the French way, so both numbers arrive from
    // `aliasesFor` and this entry adds no alias of its own. The `forms` rows are
    // what make the French printer say them.
    t: {
      aliases: [...alias("t")],
      symbol: "t",
      forms: { one: "tonne", other: "tonnes" },
    },
    // "once", not "onze" — the ounce, feminine, and a homograph of the English
    // adverb that no vocabulary in this repo claims.
    oz: {
      aliases: [...alias("oz"), "once", "onces"],
      symbol: "once",
      forms: { one: "once", other: "onces" },
    },
    lb: {
      aliases: [...alias("lb"), "livre", "livres"],
      symbol: "livre",
      forms: { one: "livre", other: "livres" },
    },
  },
});
