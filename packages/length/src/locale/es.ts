import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en` and `uk` next door make, kept here for `uk`'s
 * reason rather than `en`'s.
 *
 * Spanish's own conversion keywords are `en` and `a` (`@smartput/core/locale/es`),
 * so nothing about a Spanish lexer would shadow an `in` alias — it would be
 * perfectly reachable in an es-only engine. It stays out anyway, because
 * `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
 * without consulting a locale: a Spanish vocabulary registering `in` would put
 * it back in front of `@smartput/datetime`'s accept-gate for any engine
 * speaking both languages, and "in 3 days" would read as an all-units phrase
 * again. A Spanish reader types `pulgada`, so the omission costs this
 * vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Spanish words for the length units — the same eight units `en` and `uk` name,
 * and the same answer to "does this unit have words at all?": all eight do.
 * Spanish writes a length out as readily as English does.
 *
 * **Two `forms` keys, not eight.** `spanish.selectForm` returns a bare CLDR
 * plural category, `one` for a count of exactly 1 and `other` for everything
 * else — including 0, a fraction and a *missing* count (ruling R5), and
 * including the multiples of a million CLDR files under `many`, which the
 * language folds into `other` because this engine never prints compact
 * notation. So the table below is English's two-row shape and not Ukrainian's
 * grid: Spanish inflects a unit noun for number and for nothing else. Gender is
 * real ("una pulgada", "un metro") but it is a property of the *noun*, not of
 * the slot, so it needs no key here — an axis that is never selected on is an
 * axis that must not be declared (rule 6).
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Spanish engine and
 * the micro path (`parseLength`) cannot drift from it. The Spanish spellings
 * are appended — singular and plural both, because every string this file
 * *prints* has to be a string it reads and a printed plural recovered only by
 * the language's penalised suffix stripper is a reading this vocabulary should
 * not be leaving to a guess.
 *
 * Beside each accented spelling sits its accent-free twin (`kilometro` next to
 * `kilómetro`). That is not redundancy: NFKC folding leaves a precomposed `ó`
 * as `ó` rather than decomposing and stripping it, so the two are different
 * strings to the alias index, and `es.ts` declares "mas" beside "más" in its
 * own keyword table for exactly this reason. The stripper cannot rescue them
 * either — it removes a suffix, and what changes here is a letter in the stem.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Spanish itself writes ("5 km", never "5 kilóm."), and the spelled
 * singular noun on the four imperial ones. Spanish has no abbreviation of its
 * own for an inch, a foot, a yard or a mile: where a short form appears at all
 * it is the English one, which `units.ts` already registers as an alias, so
 * claiming it as the *Spanish* symbol would buy nothing and would print `36in`
 * at a reader who wrote `pulgadas`. Ukrainian makes the same call for all four
 * of them (R8 wants an explicit symbol, never an invented one).
 *
 * Like `en` and `uk`, this file names `length` by **id string** and never
 * imports the kind, which is what lets `@smartput/length/locale/es` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "es",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "milímetro", "milímetros", "milimetro", "milimetros"],
      symbol: "mm",
      forms: { one: "milímetro", other: "milímetros" },
    },
    cm: {
      aliases: [...alias("cm"), "centímetro", "centímetros", "centimetro", "centimetros"],
      symbol: "cm",
      forms: { one: "centímetro", other: "centímetros" },
    },
    // The one unit whose Spanish word carries no accent at all, so there is no
    // twin to declare: `metro` is stressed on the first syllable and Spanish
    // writes no acute on a paroxytone ending in a vowel.
    m: {
      aliases: [...alias("m"), "metro", "metros"],
      symbol: "m",
      forms: { one: "metro", other: "metros" },
    },
    km: {
      aliases: [...alias("km"), "kilómetro", "kilómetros", "kilometro", "kilometros"],
      symbol: "km",
      forms: { one: "kilómetro", other: "kilómetros" },
    },
    // `pulgada` is feminine ("una pulgada", "dos pulgadas") and `pie`, `yarda`
    // and `milla` split two ways again — none of which the two-row table can or
    // should record. What it does record is the plural, and Spanish builds it
    // two ways: `-s` after a vowel (pulgada → pulgadas) and `-es` after a
    // consonant (pie → pies is the vowel rule applied to a monosyllable, but
    // `quintal → quintales` is the shape the language's stripper carries "es"
    // for). Both endings are declared, so neither depends on the stripper.
    in: {
      aliases: [...alias("in"), "pulgada", "pulgadas"],
      symbol: "pulgada",
      forms: { one: "pulgada", other: "pulgadas" },
    },
    ft: {
      aliases: [...alias("ft"), "pie", "pies"],
      symbol: "pie",
      forms: { one: "pie", other: "pies" },
    },
    yd: {
      aliases: [...alias("yd"), "yarda", "yardas"],
      symbol: "yarda",
      forms: { one: "yarda", other: "yardas" },
    },
    mi: {
      aliases: [...alias("mi"), "milla", "millas"],
      symbol: "milla",
      forms: { one: "milla", other: "millas" },
    },
  },
});
