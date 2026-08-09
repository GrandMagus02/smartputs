import type { UnitTable } from "@smartput/shared";

export type AngleUnit = "rad" | "deg" | "grad" | "turn";

/**
 * The single source of angle's ratios and English aliases. The kind descriptor
 * widens these strings to `Decimal`; the micro path coerces them with
 * `Number()`. Neither owns them.
 *
 * Literals rather than a computed arctangent: decimal.js's trigonometric
 * precision depends on its own config and this value must not drift with it.
 * 30 significant digits, well past the configured 28.
 */
export const ANGLE_UNITS: UnitTable<AngleUnit> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076849",
    grad: "0.0157079632679489661923132169164",
    turn: "6.28318530717958647692528676656",
  },
  alias: {
    rad: "rad",
    radian: "rad",
    radians: "rad",
    deg: "deg",
    degree: "deg",
    degrees: "deg",
    grad: "grad",
    gradian: "grad",
    gradians: "grad",
    gon: "grad",
    turn: "turn",
    turns: "turn",
    rev: "turn",
    revolution: "turn",
    revolutions: "turn",
  },
};
