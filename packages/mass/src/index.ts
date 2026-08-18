import { decimalRatios, defineKind } from "@smartput/kind";
import { MASS_UNITS } from "./units";

export type { MassUnit } from "./units";
export { MASS_UNITS } from "./units";

export const mass = defineKind({
  id: "mass",
  value: {
    mode: "ratio",
    canonical: MASS_UNITS.canonical,
    units: decimalRatios(MASS_UNITS),
  },
  // "1 kg 200 g", "5 lb 4 oz" — a recipe and a scale readout. Two adjacent
  // masses in strictly descending units fold into a sum.
  compound: true,
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  // It stayed on the kind when the words left for `./locale/en` because a
  // kilogram is a household weight in every language, and a unit with no entry
  // simply scores 0.
  typical: {
    mg: [1, 2000],
    g: [1, 1000],
    kg: [0.1, 500],
    t: [0.1, 200],
    oz: [0.5, 100],
    lb: [0.5, 500],
  },
});
