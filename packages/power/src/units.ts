import type { UnitTable } from "@smartput/shared";

export type PowerUnit = "w" | "kw" | "mw" | "gw" | "hp";

/**
 * Canonical watt. The SI prefixes are exact powers of 1000, so there is
 * nothing for a decimal string to round.
 *
 * `mw` is the megawatt, and the milliwatt is deliberately absent. Aliases fold
 * to lowercase (`alias` keys are matched case-insensitively), so `mW` and `MW`
 * are one key in the index and cannot both be spelled — the two would collide
 * silently and the loser would depend on table order. Given one of them, a
 * launcher asks about megawatts, not milliwatts, so megawatt wins outright and
 * milliwatt has no spelling here at all. A caller who needs milliwatts writes
 * `0.001 w`, which is exact.
 *
 * `hp` is mechanical horsepower, defined as 550 ft·lbf/s. Every factor in that
 * definition is an exact decimal by definition (ft = 0.3048 m, lb =
 * 0.45359237 kg, g0 = 9.80665 m/s²), so the product terminates at 17
 * significant digits and the string below is exact rather than rounded.
 *
 * Two shorter spellings were rejected, both restatements rather than
 * derivations — the same class of mistake as speed's knot ratio (see
 * `speed/units.ts`). 76.0402249 kgf·m/s × 9.80665 looks like the definition
 * but is not: 76.0402249 is the intermediate (550 ft·lbf = 76.0402249068 kg·m)
 * already rounded to nine decimals, and that rounding costs the product its
 * 10th significant digit. And 745.6998715822702 is this string round-tripped
 * through a double, one digit short. `units.test.ts` re-derives the value from
 * 550 ft·lbf/s and measures both near-misses, so neither can quietly come back.
 */
export const POWER_UNITS: UnitTable<PowerUnit> = {
  canonical: "w",
  ratio: {
    w: "1",
    kw: "1000",
    mw: "1000000",
    gw: "1000000000",
    hp: "745.69987158227022",
  },
  alias: {
    w: "w",
    watt: "w",
    watts: "w",
    kw: "kw",
    kilowatt: "kw",
    kilowatts: "kw",
    mw: "mw",
    megawatt: "mw",
    megawatts: "mw",
    gw: "gw",
    gigawatt: "gw",
    gigawatts: "gw",
    hp: "hp",
    horsepower: "hp",
  },
};
