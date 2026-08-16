import { decimalRatios, defineKind } from "@smartput/kind";
import { ANGLE_UNITS } from "./units";

export type { AngleUnit } from "./units";
export { ANGLE_UNITS } from "./units";

export const angle = defineKind({
  id: "angle",
  value: {
    mode: "ratio",
    canonical: ANGLE_UNITS.canonical,
    units: decimalRatios(ANGLE_UNITS),
  },
  // Physics, not language: the magnitude band people type each unit in, read
  // only by completion's `scaleFit`. The words live in `src/locale/en.ts`.
  typical: {
    // A full circle is 2pi, and nobody writes an angle in radians much past
    // one revolution.
    rad: [0.1, 7],
    deg: [1, 360],
    grad: [1, 400],
    turn: [0.1, 10],
  },
});
