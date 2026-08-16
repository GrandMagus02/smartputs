import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * English words for the power units.
 *
 * The kind next door names no language at all: it is ratios, unit ids and the
 * magnitude bands `typical` records. This file is the only place in the package
 * an English word appears.
 *
 * It names `power` by **id string** rather than by importing the kind, which is
 * what lets a translation ship from someone who is not the kind's author and
 * lets `@smartput/power/locale/uk` be imported without linking the ratio table.
 * `composeLocale` is where the two halves meet.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parsePower`) and the engine path agree by
 * construction. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that forgot
 * its symbol would move a byte rather than fail.
 *
 * `forms` keys are whatever the composed language's `selectForm` returns. For
 * English that is `Intl.PluralRules`' categories, `one` and `other`.
 */
export default defineVocabulary({
  locale: "en",
  kind: "power",
  units: {
    w: { aliases: alias("w"), symbol: "w", forms: { one: "watt", other: "watts" } },
    kw: {
      aliases: alias("kw"),
      symbol: "kw",
      forms: { one: "kilowatt", other: "kilowatts" },
    },
    mw: {
      aliases: alias("mw"),
      symbol: "mw",
      forms: { one: "megawatt", other: "megawatts" },
    },
    gw: {
      aliases: alias("gw"),
      symbol: "gw",
      forms: { one: "gigawatt", other: "gigawatts" },
    },
    hp: {
      aliases: alias("hp"),
      symbol: "hp",
      // "horsepower" is its own plural. Both plural rules spell it the same
      // rather than `other` being dropped: an absent `other` would fall back
      // to the symbol, so "2 hp" would read "2 hp" while "1 hp" read
      // "1 horsepower" — the same value formatted two different ways.
      forms: { one: "horsepower", other: "horsepower" },
    },
  },
  cues: { engine: 3, motor: 3, output: 2, draws: 2, rated: 2 },
});
