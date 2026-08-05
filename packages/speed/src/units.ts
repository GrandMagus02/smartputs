import type { UnitTable } from "@smartput/validate";

export type SpeedUnit = "mps" | "kph" | "mph" | "knot";

/**
 * Canonical metres per second. `kph` is 1000/3600 -- not a terminating
 * decimal -- so its string is the same 28-significant-digit value
 * `new Decimal(1000).div(3600)` produces at this repo's configured precision
 * (`Decimal.set({ precision: 28 })` in `@smartput/core/decimal`), verified by
 * running that division and copying its `.toString()` verbatim rather than
 * retyping digits by hand. `mph` and `knot` are exact terminating decimals
 * and carry no more digits than the old numeric literals did.
 */
export const SPEED_UNITS: UnitTable<SpeedUnit> = {
  canonical: "mps",
  ratio: {
    mps: "1",
    kph: "0.2777777777777777777777777778",
    mph: "0.44704",
    knot: "0.514444",
  },
  alias: {
    mps: "mps",
    kph: "kph",
    kmh: "kph",
    mph: "mph",
    knot: "knot",
    knots: "knot",
    kt: "knot",
  },
};
