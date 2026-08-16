import { decimalRatios, defineKind } from "@smartput/kind";
import { LENGTH_UNITS } from "./units";

export type { LengthUnit } from "./units";
export { LENGTH_UNITS } from "./units";

export const length = defineKind({
  id: "length",
  value: {
    mode: "ratio",
    canonical: LENGTH_UNITS.canonical,
    units: decimalRatios(LENGTH_UNITS),
  },
  // Physics, not language (ruling R3): the magnitude band people type each unit
  // in, read only by completion's `scaleFit`.
  typical: {
    mm: [1, 1000],
    cm: [1, 300],
    m: [1, 1000],
    km: [1, 1000],
    in: [1, 120],
    ft: [1, 500],
    yd: [1, 500],
    mi: [0.1, 500],
  },
});
