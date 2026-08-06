import type { UnitTable } from "@smartput/shared";

export type EnergyUnit =
  | "j"
  | "kj"
  | "mj"
  | "wh"
  | "kwh"
  | "mwh"
  | "cal"
  | "kcal"
  | "btu";

/**
 * Canonical joule. Every ratio here is exact in decimal, so there is nothing
 * for a decimal string to round and nothing for a `units.test.ts` to re-derive
 * -- unlike `speed`, where `kph` and `knot` are repeating and a hand-typed
 * truncation shipped wrong. The watt-hour family is a whole number of seconds
 * times a whole number of watts (3600, 3.6e6, 3.6e9); the thermochemical
 * calorie is defined as exactly 4.184 J and `kcal` as exactly 1000 of those;
 * and the IT BTU is defined as exactly 1.05505585262 kJ. Definitions, not
 * measurements -- none of them is an approximation this file is rounding.
 *
 * Ruling -- `mj` is megajoule and `mwh` is megawatt-hour. Millijoule and
 * milliwatt-hour are dropped rather than spelled differently: aliases fold to
 * lowercase before indexing, so `MJ` and `mJ` are the same key and one of the
 * two prefixes has to lose. Energy at human scale is billed in MJ and MWh, so
 * the milli- forms are the ones that go. Same call `power` makes for `mw`.
 *
 * Ruling -- no `Calorie` alias for `kcal`. The food Calorie is 1000 cal, but it
 * case-folds onto `calorie`, which this table already binds to `cal`. A silent
 * factor-of-1000 collision is worse than an absent alias, so the food unit is
 * reachable only as `kcal`.
 */
export const ENERGY_UNITS: UnitTable<EnergyUnit> = {
  canonical: "j",
  ratio: {
    j: "1",
    kj: "1000",
    mj: "1000000",
    wh: "3600",
    kwh: "3600000",
    mwh: "3600000000",
    cal: "4.184",
    kcal: "4184",
    btu: "1055.05585262",
  },
  alias: {
    j: "j",
    joule: "j",
    joules: "j",
    kj: "kj",
    kilojoule: "kj",
    kilojoules: "kj",
    mj: "mj",
    megajoule: "mj",
    megajoules: "mj",
    // The watt-hour family carries symbol aliases only. Its written-out form is
    // a compound ("watt hour"), and a unit word is letters plus trailing digits
    // (`parse/lex.ts`), so the spelling people actually type cannot lex as one
    // token. `watthour` would lex but nobody writes it.
    wh: "wh",
    kwh: "kwh",
    mwh: "mwh",
    cal: "cal",
    calorie: "cal",
    calories: "cal",
    kcal: "kcal",
    kilocalorie: "kcal",
    kilocalories: "kcal",
    btu: "btu",
    btus: "btu",
  },
};
