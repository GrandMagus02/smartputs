import type { UnitTable } from "@smartput/shared";

export type LengthUnit = "mm" | "cm" | "m" | "km" | "in" | "ft" | "yd" | "mi";

/**
 * The single source of length's ratios and English aliases. The kind
 * descriptor widens these strings to `Decimal`; the micro path coerces them
 * with `Number()`. Neither owns them.
 *
 * All eight ratios are exact in decimal (the imperial ones are exact by
 * definition of the international yard/pound agreement), so each is just the
 * literal that used to live in `index.ts`, stringified.
 */
export const LENGTH_UNITS: UnitTable<LengthUnit> = {
  canonical: "m",
  ratio: {
    mm: "0.001",
    cm: "0.01",
    m: "1",
    km: "1000",
    in: "0.0254",
    ft: "0.3048",
    yd: "0.9144",
    mi: "1609.344",
  },
  alias: {
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
    m: "m",
    metre: "m",
    metres: "m",
    meter: "m",
    meters: "m",
    km: "km",
    kilometre: "km",
    kilometres: "km",
    kilometer: "km",
    kilometers: "km",
    in: "in",
    inch: "in",
    inches: "in",
    ft: "ft",
    foot: "ft",
    feet: "ft",
    yd: "yd",
    yard: "yd",
    yards: "yd",
    mi: "mi",
    mile: "mi",
    miles: "mi",
  },
};
