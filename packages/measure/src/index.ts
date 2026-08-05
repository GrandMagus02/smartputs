import { aliasesFor, Decimal, decimalRatios, defineKind } from "@smartput/core";
import {
  DEFAULT_DPI,
  MEASURE_UNITS,
  type MeasureUnit,
  type StaticMeasureUnit,
} from "./units";

export type { MeasureUnit, StaticMeasureUnit } from "./units";
export { DEFAULT_DPI, MEASURE_UNITS } from "./units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

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
  // Aliases are derived, never restated: `units.ts` is the one place a new
  // alias is added, and it reaches both the engine and the micro path.
  // `symbol`, `display` and `typical` stay here — the micro path has no use
  // for any of them and should not carry their bytes.
  lexicon: {
    inch: {
      aliases: alias("inch"),
      symbol: "inch",
      display: { one: "inch", other: "inches" },
      typical: [1, 120],
    },
    mm: {
      aliases: alias("mm"),
      symbol: "mm",
      display: { one: "millimetre", other: "millimetres" },
      typical: [1, 1000],
    },
    cm: {
      aliases: alias("cm"),
      symbol: "cm",
      display: { one: "centimetre", other: "centimetres" },
      typical: [1, 300],
    },
    pt: {
      aliases: alias("pt"),
      symbol: "pt",
      display: { one: "point", other: "points" },
      typical: [1, 1000],
    },
    pc: {
      aliases: alias("pc"),
      symbol: "pc",
      display: { one: "pica", other: "picas" },
      typical: [1, 100],
    },
    px: {
      aliases: alias("px"),
      symbol: "px",
      display: { one: "pixel", other: "pixels" },
      typical: [1, 4000],
    },
  },
});
