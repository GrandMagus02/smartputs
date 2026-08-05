import type { UnitTable } from "@smartput/validate";

export type AreaUnit = "m2" | "cm2" | "km2" | "hectare" | "acre";

/**
 * Canonical square metres. Every ratio is an exact terminating decimal, same
 * digits as the old numeric literals -- nothing here needed a Decimal
 * division to derive.
 */
export const AREA_UNITS: UnitTable<AreaUnit> = {
  canonical: "m2",
  ratio: {
    m2: "1",
    cm2: "0.0001",
    km2: "1000000",
    hectare: "10000",
    acre: "4046.8564224",
  },
  alias: {
    m2: "m2",
    "m²": "m2",
    sqm: "m2",
    cm2: "cm2",
    "cm²": "cm2",
    sqcm: "cm2",
    km2: "km2",
    "km²": "km2",
    sqkm: "km2",
    hectare: "hectare",
    hectares: "hectare",
    ha: "hectare",
    acre: "acre",
    acres: "acre",
  },
};
