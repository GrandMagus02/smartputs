import type { UnitTable } from "@smartput/validate";

export type MeasureUnit = "inch" | "mm" | "cm" | "pt" | "pc" | "px";

/** Every unit whose ratio is a constant — that is, everything but `px`. */
export type StaticMeasureUnit = Exclude<MeasureUnit, "px">;

/**
 * The dpi a `px` is worth when nobody says otherwise. Both paths read this one
 * constant: the micro path off `ctx.dpi`, the engine off the value's `meta.dpi`.
 */
export const DEFAULT_DPI = 96;

/**
 * The single source of measure's ratios and English aliases. The kind
 * descriptor widens the strings to `Decimal`; the micro path coerces them with
 * `Number()`. Neither owns them.
 *
 * `mm`, `cm`, `pt` and `pc` are all non-terminating decimals (5/127, 50/127,
 * 1/72, 1/6), so a literal has to stop somewhere. 30 significant digits, two
 * past the engine's configured 28, so the engine's own arithmetic is the thing
 * that rounds rather than the constant it starts from.
 *
 * `px` is the one dynamic ratio in the repo: a pixel is 1/dpi of an inch, and
 * dpi is a property of the document, not of the unit.
 */
export const MEASURE_UNITS: UnitTable<MeasureUnit> = {
  canonical: "inch",
  ratio: {
    inch: "1",
    mm: "0.0393700787401574803149606299213",
    cm: "0.393700787401574803149606299213",
    pt: "0.0138888888888888888888888888889",
    pc: "0.166666666666666666666666666667",
    px: (ctx) => 1 / (ctx.dpi ?? DEFAULT_DPI),
  },
  alias: {
    inch: "inch",
    inches: "inch",
    mm: "mm",
    millimetre: "mm",
    millimetres: "mm",
    millimeter: "mm",
    millimeters: "mm",
    cm: "cm",
    centimetre: "cm",
    centimetres: "cm",
    centimeter: "cm",
    centimeters: "cm",
    pt: "pt",
    point: "pt",
    points: "pt",
    pc: "pc",
    pica: "pc",
    picas: "pc",
    px: "px",
    pixel: "px",
    pixels: "px",
  },
};
