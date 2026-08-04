import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { deriveValue } from "../kind/ratio-ops";
import type { Value } from "../types";

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
    canonical: "mps",
    units: {
      mps: 1,
      kph: new Decimal(1000).div(3600),
      mph: 0.44704,
      knot: 0.514444,
    },
  },
  lexicon: {
    mps: { aliases: ["mps"], symbol: "m/s" },
    kph: { aliases: ["kph", "kmh"], symbol: "kph" },
    mph: { aliases: ["mph"], symbol: "mph" },
    knot: { aliases: ["knot", "kt"], symbol: "kt" },
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

/** Canonical square metres. Produced by multiplying two lengths. */
export const area = defineKind({
  id: "area",
  value: {
    mode: "ratio",
    canonical: "m2",
    units: { m2: 1, cm2: 0.0001, km2: 1e6, hectare: 1e4, acre: 4046.8564224 },
  },
  lexicon: {
    m2: { aliases: ["m2", "sqm"], symbol: "m²" },
    cm2: { aliases: ["cm2", "sqcm"], symbol: "cm²" },
    km2: { aliases: ["km2", "sqkm"], symbol: "km²" },
    hectare: { aliases: ["hectare", "ha"], symbol: "ha" },
    acre: { aliases: ["acre"], symbol: "acre" },
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

/** Canonical litres. Produced by multiplying an area by a length. */
export const volume = defineKind({
  id: "volume",
  value: {
    mode: "ratio",
    canonical: "l",
    units: { l: 1, ml: 0.001, m3: 1000, gal: 3.785411784, pint: 0.473176473 },
  },
  lexicon: {
    l: { aliases: ["l", "litre", "liter"], symbol: "l" },
    ml: { aliases: ["ml", "millilitre", "milliliter"], symbol: "ml" },
    m3: { aliases: ["m3"], symbol: "m³" },
    gal: { aliases: ["gal", "gallon"], symbol: "gal" },
    pint: { aliases: ["pint"], symbol: "pint" },
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
