import { aliasesFor, decimalRatios, defineKind } from "@smartput/core";
import { ANGLE_UNITS, type AngleUnit } from "./units";

export type { AngleUnit } from "./units";
export { ANGLE_UNITS } from "./units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

export const angle = defineKind({
  id: "angle",
  value: {
    mode: "ratio",
    canonical: ANGLE_UNITS.canonical,
    units: decimalRatios(ANGLE_UNITS),
  },
  // Aliases are derived, never restated: `units.ts` is the one place a new
  // alias is added, and it reaches both the engine and the micro path.
  // `symbol`, `display` and `typical` stay here — the micro path has no use
  // for any of them and should not carry their bytes.
  lexicon: {
    rad: {
      aliases: alias("rad"),
      symbol: "rad",
      display: { one: "radian", other: "radians" },
      // A full circle is 2pi, and nobody writes an angle in radians much past
      // one revolution.
      typical: [0.1, 7],
    },
    deg: {
      aliases: alias("deg"),
      symbol: "deg",
      display: { one: "degree", other: "degrees" },
      typical: [1, 360],
    },
    grad: {
      aliases: alias("grad"),
      symbol: "grad",
      display: { one: "gradian", other: "gradians" },
      typical: [1, 400],
    },
    turn: {
      aliases: alias("turn"),
      symbol: "turn",
      display: { one: "turn", other: "turns" },
      typical: [0.1, 10],
    },
  },
});
