import type { Value } from "@smartput/kind";
import { type Decimal, decimalRatios, defineKind, deriveValue } from "@smartput/kind";
import { SPEED_UNITS } from "./units";

export type { SpeedUnit } from "./units";
export { SPEED_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the left operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

/** Canonical metres per second. Produced by dividing a length by a duration. */
export const speed = defineKind({
  id: "speed",
  value: {
    mode: "ratio",
    canonical: SPEED_UNITS.canonical,
    units: decimalRatios(SPEED_UNITS),
  },
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  typical: {
    mps: [0.5, 100],
    kph: [5, 300],
    mph: [5, 200],
    knot: [1, 100],
  },
  ops: [
    {
      op: "/",
      left: "length",
      right: "duration",
      result: "speed",
      apply: (l, r) => make(l, "speed", "mps", l.canonical.div(r.canonical)),
    },
  ],
});
