import type { UnitTable } from "@smartput/shared";

export type VolumeUnit = "l" | "ml" | "m3" | "gal" | "pint";

/**
 * Canonical litres. Every ratio is an exact terminating decimal, same digits
 * as the old numeric literals -- nothing here needed a Decimal division to
 * derive.
 */
export const VOLUME_UNITS: UnitTable<VolumeUnit> = {
  canonical: "l",
  ratio: {
    l: "1",
    ml: "0.001",
    m3: "1000",
    gal: "3.785411784",
    pint: "0.473176473",
  },
  alias: {
    l: "l",
    litre: "l",
    litres: "l",
    liter: "l",
    liters: "l",
    ml: "ml",
    millilitre: "ml",
    millilitres: "ml",
    milliliter: "ml",
    milliliters: "ml",
    m3: "m3",
    "m³": "m3",
    gal: "gal",
    gallon: "gal",
    gallons: "gal",
    pint: "pint",
    pints: "pint",
  },
};
