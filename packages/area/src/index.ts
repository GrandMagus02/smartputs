import type { Value } from "@smartput/kind";
import { type Decimal, decimalRatios, defineKind, deriveValue } from "@smartput/kind";
import { AREA_UNITS } from "./units";

export type { AreaUnit } from "./units";
export { AREA_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the left operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

/** Canonical square metres. Produced by multiplying two lengths. */
export const area = defineKind({
  id: "area",
  value: {
    mode: "ratio",
    canonical: AREA_UNITS.canonical,
    units: decimalRatios(AREA_UNITS),
  },
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  // It stayed on the kind when the words left for `./locale/en` because a
  // hectare is a field in every language, and a unit with no entry scores 0.
  typical: {
    m2: [1, 10000],
    cm2: [1, 10000],
    km2: [0.1, 10000],
    hectare: [0.1, 1000],
    acre: [0.1, 1000],
  },
  ops: [
    {
      op: "*",
      left: "length",
      right: "length",
      result: "area",
      apply: (l, r) => make(l, "area", "m2", l.canonical.times(r.canonical)),
    },
  ],
});
