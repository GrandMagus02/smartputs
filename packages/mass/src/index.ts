import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { MASS_UNITS, type MassUnit } from "./units";

export type { MassUnit } from "./units";
export { MASS_UNITS } from "./units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

export const mass = defineKind({
  id: "mass",
  value: {
    mode: "ratio",
    canonical: MASS_UNITS.canonical,
    units: decimalRatios(MASS_UNITS),
  },
  lexicon: {
    mg: {
      aliases: alias("mg"),
      symbol: "mg",
      display: { one: "milligram", other: "milligrams" },
      typical: [1, 2000],
    },
    g: {
      aliases: alias("g"),
      symbol: "g",
      display: { one: "gram", other: "grams" },
      typical: [1, 1000],
    },
    kg: {
      aliases: alias("kg"),
      symbol: "kg",
      display: { one: "kilogram", other: "kilograms" },
      typical: [0.1, 500],
    },
    t: {
      aliases: alias("t"),
      symbol: "t",
      display: { one: "tonne", other: "tonnes" },
      typical: [0.1, 200],
    },
    oz: {
      aliases: alias("oz"),
      symbol: "oz",
      display: { one: "ounce", other: "ounces" },
      typical: [0.5, 100],
    },
    lb: {
      aliases: alias("lb"),
      symbol: "lb",
      display: { one: "pound", other: "pounds" },
      typical: [0.5, 500],
    },
  },
});
