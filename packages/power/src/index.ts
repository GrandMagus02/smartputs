import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { POWER_UNITS, type PowerUnit } from "./units";

export type { PowerUnit } from "./units";
export { POWER_UNITS } from "./units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Canonical watt. No `ops` block: a plain ratio kind already gets `in`, `+`,
 * `-`, number scaling and percent from `generateRatioOps`, and the one bridge
 * power takes part in — power x duration = energy — is declared by
 * `@smartput/energy`, the derived kind. Declaring it on both sides would be
 * two kinds claiming one signature, which `createEngine` rejects outright
 * (`KindConflictError`), so the derived kind owns it and this one stays plain.
 */
export const power = defineKind({
  id: "power",
  value: {
    mode: "ratio",
    canonical: POWER_UNITS.canonical,
    units: decimalRatios(POWER_UNITS),
  },
  lexicon: {
    w: {
      aliases: alias("w"),
      symbol: "w",
      display: { one: "watt", other: "watts" },
      typical: [1, 1000],
    },
    kw: {
      aliases: alias("kw"),
      symbol: "kw",
      display: { one: "kilowatt", other: "kilowatts" },
      typical: [1, 1000],
    },
    mw: {
      aliases: alias("mw"),
      symbol: "mw",
      display: { one: "megawatt", other: "megawatts" },
      typical: [1, 1000],
    },
    gw: {
      aliases: alias("gw"),
      symbol: "gw",
      display: { one: "gigawatt", other: "gigawatts" },
      typical: [0.1, 100],
    },
    hp: {
      aliases: alias("hp"),
      symbol: "hp",
      // "horsepower" is its own plural. Both plural rules spell it the same
      // rather than `other` being dropped: an absent `other` would fall back
      // to the symbol, so "2 hp" would read "2hp" while "1 hp" read
      // "1 horsepower" — the same value formatted two different ways.
      display: { one: "horsepower", other: "horsepower" },
      typical: [1, 1000],
    },
  },
});
