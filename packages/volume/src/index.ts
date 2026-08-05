import type { Value } from "@smartput/core";
import { type Decimal, defineKind, deriveValue } from "@smartput/core";

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
    canonical: "l",
    units: { l: 1, ml: 0.001, m3: 1000, gal: 3.785411784, pint: 0.473176473 },
  },
  lexicon: {
    l: {
      aliases: ["l", "litre", "liter"],
      symbol: "l",
      display: { one: "litre", other: "litres" },
      typical: [0.1, 100],
    },
    ml: {
      aliases: ["ml", "millilitre", "milliliter"],
      symbol: "ml",
      display: { one: "millilitre", other: "millilitres" },
      typical: [1, 2000],
    },
    // m3 has no parseable word form ("cubic metres" is rejected), so no display.
    m3: { aliases: ["m3"], symbol: "m³", typical: [0.1, 1000] },
    gal: {
      aliases: ["gal", "gallon"],
      symbol: "gal",
      display: { one: "gallon", other: "gallons" },
      typical: [0.1, 100],
    },
    pint: {
      aliases: ["pint"],
      symbol: "pint",
      display: { one: "pint", other: "pints" },
      typical: [1, 20],
    },
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
