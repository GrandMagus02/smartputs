import type { UnitTable } from "@smartput/shared";

export type SpeedUnit = "mps" | "kph" | "mph" | "knot";

/**
 * Canonical metres per second. Every ratio here is a definition divided by
 * 3600: a kilometre per hour is 1000/3600, a knot is one nautical mile
 * (1852 m, exactly) per hour, a mile per hour is 1609.344/3600 = 0.44704.
 *
 * Only `mph` terminates. `kph` and `knot` do not, so each string is the
 * 28-significant-digit value `new Decimal(n).div(3600)` produces at this
 * repo's configured precision (`Decimal.set({ precision: 28 })` in
 * `@smartput/core/decimal`), verified by running that division and copying its
 * `.toString()` verbatim rather than retyping digits by hand.
 *
 * `knot` was "0.514444" until 2026-08-06 — the true value truncated at six
 * decimals, 8.6e-7 relative low, which made `1 knot in kph` 1.8519984 instead
 * of the definitional 1.852 on both paths. `units.test.ts` now re-derives every
 * ratio from its definition rather than restating the string, which is what
 * makes that a test failure rather than a doc comment.
 */
export const SPEED_UNITS: UnitTable<SpeedUnit> = {
  canonical: "mps",
  ratio: {
    mps: "1",
    kph: "0.2777777777777777777777777778",
    mph: "0.44704",
    knot: "0.5144444444444444444444444444",
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
