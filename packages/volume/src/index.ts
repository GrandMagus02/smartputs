import type { Value } from "@smartput/kind";
import { type Decimal, decimalRatios, defineKind, deriveValue } from "@smartput/kind";
import { VOLUME_UNITS } from "./units";

export type { VolumeUnit } from "./units";
export { VOLUME_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the left operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

/** Canonical litres. Produced by multiplying an area by a length. */
export const volume = defineKind({
  id: "volume",
  value: {
    mode: "ratio",
    canonical: VOLUME_UNITS.canonical,
    units: decimalRatios(VOLUME_UNITS),
  },
  // Physics, not language (spec §4): the magnitude band people type each unit
  // in, read only by completion's `scaleFit`.
  typical: {
    l: [0.1, 100],
    ml: [1, 2000],
    m3: [0.1, 1000],
    gal: [0.1, 100],
    pint: [1, 20],
  },
  ops: [
    {
      // area's canonical is m², length's canonical is m, so their product is
      // a magnitude in m³. This kind's own canonical unit is litres (1 l
      // ratio), and 1 m³ = 1000 l, so the m³ product must be *multiplied* by
      // 1000 to become the litre-denominated canonical magnitude.
      op: "*",
      left: "area",
      right: "length",
      result: "volume",
      apply: (l, r) =>
        make(l, "volume", "m3", l.canonical.times(r.canonical).times(1000)),
    },
    {
      op: "*",
      left: "length",
      right: "area",
      result: "volume",
      apply: (l, r) =>
        make(l, "volume", "m3", l.canonical.times(r.canonical).times(1000)),
    },
  ],
});
