import { decimalRatios, defineKind } from "@smartput/kind";
import { DURATION_UNITS } from "./units";

export type { DurationUnit } from "./units";
export { DURATION_UNITS } from "./units";

export const duration = defineKind({
  id: "duration",
  value: {
    mode: "ratio",
    canonical: DURATION_UNITS.canonical,
    units: decimalRatios(DURATION_UNITS),
  },
  // Physics, not language (spec §4): the magnitude band people type each unit
  // in, read only by completion's `scaleFit`.
  typical: {
    ms: [1, 5000],
    s: [1, 300],
    min: [1, 180],
    h: [1, 72],
    d: [1, 90],
    wk: [1, 52],
  },
});
