import { Decimal, decimalRatios, defineKind } from "@smartput/core";
import { DEFAULT_DPI, MEASURE_UNITS, type StaticMeasureUnit } from "./units";

export type { MeasureUnit, StaticMeasureUnit } from "./units";
export { DEFAULT_DPI, MEASURE_UNITS } from "./units";

/**
 * `decimalRatios` refuses a dynamic ratio by design rather than coercing a
 * function to NaN, so `px` is lifted out here and re-declared below as the
 * closure the engine wants. Every other ratio still comes from `units.ts`,
 * which is the whole point of the split.
 */
const { px: _dynamic, ...constantRatio } = MEASURE_UNITS.ratio;

const constantUnits = decimalRatios<StaticMeasureUnit>({
  // `decimalRatios` reads `ratio` and nothing else. `canonical` is spelled out
  // because narrowing the unit union narrows its type too; the contract test
  // in `validate.test.ts` asserts it still matches `MEASURE_UNITS.canonical`.
  canonical: "inch",
  ratio: constantRatio,
  alias: {},
});

/**
 * Typographic measurement. `px` is the only dpi-relative unit, and it reads its
 * dpi from the value's own `meta` — the one generic escape hatch, used by the
 * one kind that needs it. There is deliberately no per-kind context mechanism.
 *
 * Arithmetic runs in canonical inches, so operands authored at different dpi
 * still combine correctly.
 */
export const measure = defineKind({
  id: "measure",
  value: {
    mode: "ratio",
    canonical: MEASURE_UNITS.canonical,
    // Opt in to the facade's dpi surface — `.dpi` and `withDpi()`. See
    // RatioSpec.dpiUnit.
    dpiUnit: "px",
    units: {
      ...constantUnits,
      px: {
        ratio: (ctx) => {
          const dpi = ctx.self.meta?.dpi;
          return new Decimal(1).div(typeof dpi === "number" ? dpi : DEFAULT_DPI);
        },
      },
    },
  },
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  // It stayed on the kind when the words left for `./locale/en` because a
  // pixel spans the same range of counts in every language, and a unit with no
  // entry simply scores 0.
  typical: {
    inch: [1, 120],
    mm: [1, 1000],
    cm: [1, 300],
    pt: [1, 1000],
    pc: [1, 100],
    px: [1, 4000],
  },
});
