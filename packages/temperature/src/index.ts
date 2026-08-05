import {
  aliasesFor,
  Decimal,
  decimalRatios,
  defineKind,
  deriveValue,
} from "@smartput/core";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "./units";

export type { TempDeltaUnit, TemperatureUnit } from "./units";
export { TEMPDELTA_UNITS, TEMPERATURE_UNITS } from "./units";

// Aliases and ratios are derived, never restated: `units.ts` is the one place
// a unit or an alias is added, and it reaches both the engine and the micro
// path. `symbol`, `display`, `typical` and `ops` stay here -- the micro path
// has no use for any of them and should not carry their bytes.
const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);

// The table's ratios as Decimals. `new Decimal(5).div(9)`, never `5 / 9`: the
// latter is a JS float before Decimal sees it, and 212F then lands on
// 100.000000000000008 instead of 100. That division is now written out as the
// 28-digit string it produces, in `units.ts`, so the micro path reads the same
// number -- `TEMPERATURE_UNITS.ratio.f` is asserted against the division
// itself in validate.test.ts.
const ratio = decimalRatios(TEMPERATURE_UNITS);
const offset = (unit: TemperatureUnit) =>
  new Decimal(TEMPERATURE_UNITS.offset?.[unit] ?? 0);

/** An absolute reading. Offsets apply; sums and products do not. */
export const temperature = defineKind({
  id: "temperature",
  value: {
    mode: "ratio",
    canonical: TEMPERATURE_UNITS.canonical,
    affine: { deltaKind: "tempdelta" },
    units: {
      c: ratio.c,
      f: { ratio: ratio.f, offset: offset("f") },
      k: { ratio: ratio.k, offset: offset("k") },
    },
  },
  // No `display` on any temperature unit, deliberately. The written form a
  // person actually uses is the symbol — "20°C", not "20 celsius" — and the one
  // genuine word form, "20 degrees celsius", does not parse: the analyzers have
  // no route from a two-word unit back to an alias. A bare "20 celsius" parses
  // but reads worse than the symbol it would replace, so `formatValue` keeps
  // the symbol and completion falls back to the alias, which is already the
  // string a user would type. `typical` is unaffected; scaleFit does not care
  // how a unit renders.
  //
  // Bands are magnitudes: scaleFit takes `count.abs()`, so a negative low would
  // be dead weight. c covers weather through an oven, f the same range in
  // Fahrenheit, k lab temperatures through lamp colour temperature.
  lexicon: {
    c: { aliases: alias("c"), symbol: "°C", typical: [1, 250] },
    f: { aliases: alias("f"), symbol: "°F", typical: [1, 500] },
    k: { aliases: alias("k"), symbol: "K", typical: [1, 6500] },
  },
  // Only the two genuine signatures live here. The refusals that keep
  // `tempdelta` from silently capturing "20 C * 2", "20 C + 20%" and friends
  // are generated in ratio-ops.ts from the very op set an ordinary kind would
  // get, so they cannot drift out of sync with that generation and the next
  // affine kind (M4's datetime) inherits them for free.
  ops: [
    {
      op: "+",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: {
        code: "temperature-delta",
        message: "the second operand was read as a temperature difference",
      },
      apply: (l, r) => deriveValue(l, l.canonical.plus(r.canonical)),
    },
    {
      op: "-",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: {
        code: "temperature-delta",
        message: "the second operand was read as a temperature difference",
      },
      apply: (l, r) => deriveValue(l, l.canonical.minus(r.canonical)),
    },
  ],
});

const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * A difference between readings. Same ratios as `temperature`, no offsets —
 * that difference is the whole point: 5F as a reading is -15C, as a difference
 * it is 2.78C. Both kinds read the one shared ratio and alias object in
 * `units.ts`, so "same ratios, no offsets" is structural rather than copied.
 *
 * The prior sits well below `temperature` so a bare "5 C" reads as a reading.
 * It is low enough that "20 C + 5 C" prefers temperature+delta over
 * delta+delta, which the solver's same-kind context bonus would otherwise win.
 */
export const tempdelta = defineKind({
  id: "tempdelta",
  prior: -40,
  value: {
    mode: "ratio",
    canonical: TEMPDELTA_UNITS.canonical,
    units: decimalRatios(TEMPDELTA_UNITS),
  },
  // `display` omitted for the same reason as `temperature` above. The bands are
  // narrower: a difference between readings is a smaller number than a reading.
  lexicon: {
    c: { aliases: deltaAlias("c"), symbol: "°C", typical: [1, 100] },
    f: { aliases: deltaAlias("f"), symbol: "°F", typical: [1, 180] },
    k: { aliases: deltaAlias("k"), symbol: "K", typical: [1, 100] },
  },
});
