import { aliasesFor, defineVocabulary } from "@smartput/core";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Spanish words for the volume units — the same five units `en` and `uk` next
 * door name, and the same per-unit decision about whether a unit has words at
 * all.
 *
 * **Two `forms` keys, not eight.** `spanish.selectForm` returns a bare CLDR
 * plural category: `one` for a count of exactly 1, `other` for everything else —
 * 0, a fraction, a missing count (ruling R5), and the multiples of a million
 * CLDR would file under `many`, which the language folds in because this engine
 * never prints compact notation. Spanish inflects a unit noun for number and
 * nothing else, so this is the two-row English shape rather than Ukrainian's
 * grid. Gender (masculine `litro`, feminine `pinta`) is a property of the noun
 * and selects nothing, so it is not a key here (rule 6).
 *
 * **`m3` carries no `forms`, exactly as `en` and `uk` carry none**, and in
 * Spanish the reason is sharper than in either: the name is "metro cúbico",
 * *two* words. `lex` builds a word token out of a run of letters, so a space
 * ends it and no single analyzer is ever handed the phrase — a two-word alias
 * could never be reached by the index that would have to hold it, and a
 * two-word `form` would be text the printer emits and the parser refuses.
 * Spanish has no one-word colloquial name to fall back on either, the way
 * Ukrainian has "кубометр", so `m3` reads and prints through `m³` alone.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Spanish engine and
 * the micro path (`parseVolume`) cannot drift from it. The Spanish spellings
 * are appended, singular and plural both, because every string this file
 * *prints* has to be a string it reads.
 *
 * `galón` is the one entry that needs more than a plural rule. Its plural moves
 * the written accent — `galón` → `galones`, because the stress stays on the
 * same syllable and Spanish only writes the acute where the general rule would
 * put the stress elsewhere — so the language's suffix stripper cannot get from
 * one to the other: stripping "es" from "galones" yields "galon", which is a
 * third string again. All three are declared. `es.ts` makes the same move in
 * its own keyword table ("mas" beside "más"), for the same reason: NFKC folding
 * leaves a precomposed `ó` as `ó` and never strips it.
 *
 * `symbol` is the international abbreviation where Spanish itself abbreviates
 * (`l`, `ml`, `m³`) and the spelled singular noun where it does not. `gal` is
 * the English clipping riding in from `units.ts` — it stays an alias, so it
 * reads — but printing "3gal" at a reader who typed "galones" would be
 * answering in another language, and `pinta` has no abbreviation in any
 * register. R8 wants an explicit symbol on every unit, never an invented one.
 *
 * Like `en` and `uk`, this file names `volume` by **id string** and never
 * imports the kind, which is what lets `@smartput/volume/locale/es` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "es",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "litro", "litros"],
      symbol: "l",
      forms: { one: "litro", other: "litros" },
    },
    // One `l` in the prefix, unlike English's "millilitre": Spanish borrowed it
    // as `mili-` and doubles no consonant.
    ml: {
      aliases: [...alias("ml"), "mililitro", "mililitros"],
      symbol: "ml",
      forms: { one: "mililitro", other: "mililitros" },
    },
    m3: { aliases: [...alias("m3")], symbol: "m³" },
    gal: {
      aliases: [...alias("gal"), "galón", "galones", "galon"],
      symbol: "galón",
      forms: { one: "galón", other: "galones" },
    },
    pint: {
      aliases: [...alias("pint"), "pinta", "pintas"],
      symbol: "pinta",
      forms: { one: "pinta", other: "pintas" },
    },
  },
});
