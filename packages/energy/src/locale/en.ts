import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * English words for the energy units.
 *
 * The kind next door names no language at all: it is ratios, unit ids, the
 * magnitude bands `typical` records and the four power/duration/energy
 * signatures. This file is the only place in the package an English word
 * appears.
 *
 * It names `energy` by **id string** rather than by importing the kind, which
 * is what lets a translation ship from someone who is not the kind's author
 * and lets `@smartput/energy/locale/uk` be imported without linking the ratio
 * table. `composeLocale` is where the two halves meet.
 *
 * `aliases` derives from `units.ts` rather than being written out a second
 * time, so the micro path (`parseEnergy`) and the engine path agree by
 * construction. `symbol` is explicit on every unit (ruling R8): the renderer's
 * no-symbol branch joins number and unit without a space, so a unit that
 * forgot its symbol would move a byte rather than fail.
 *
 * `forms` keys are whatever the composed language's `selectForm` returns. For
 * English that is `Intl.PluralRules`' categories, `one` and `other`.
 */
export default defineVocabulary({
  locale: "en",
  kind: "energy",
  units: {
    j: { aliases: alias("j"), symbol: "j", forms: { one: "joule", other: "joules" } },
    kj: {
      aliases: alias("kj"),
      symbol: "kj",
      forms: { one: "kilojoule", other: "kilojoules" },
    },
    mj: {
      aliases: alias("mj"),
      symbol: "mj",
      forms: { one: "megajoule", other: "megajoules" },
    },
    // wh, kwh and mwh carry no `forms`: their written-out forms are compounds
    // ("watt hours") that the parser rejects, and a form that does not parse
    // back is a dead end for completion. Absent `forms` keeps the formatter on
    // the symbol. Same call `speed` makes for "metres per second".
    wh: { aliases: alias("wh"), symbol: "wh" },
    kwh: { aliases: alias("kwh"), symbol: "kwh" },
    mwh: { aliases: alias("mwh"), symbol: "mwh" },
    cal: {
      aliases: alias("cal"),
      symbol: "cal",
      forms: { one: "calorie", other: "calories" },
    },
    kcal: {
      aliases: alias("kcal"),
      symbol: "kcal",
      forms: { one: "kilocalorie", other: "kilocalories" },
    },
    btu: {
      aliases: alias("btu"),
      symbol: "btu",
      forms: { one: "btu", other: "btus" },
    },
  },
});
