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
  // "1 turn 30 deg" — a full revolution plus a bit, which is how a rotation is
  // dictated. The classic compound angle, "30° 15′", needs an arcminute and
  // this kind has none: `ANGLE_UNITS` is rad, deg, grad and turn, so opting in
  // buys the turn/deg pair today and the minute/second pair on the day
  // `units.ts` grows them.
  compound: true,
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
