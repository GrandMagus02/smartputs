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
    // mps, kph and mph carry no `display`: their written-out forms
    // ("metres per second", "kilometres per hour") are compounds the parser
    // rejects, and a display form that does not parse back is a dead end for
    // completion. Absent display keeps formatValue on the symbol.
    mps: { aliases: ["mps"], symbol: "m/s", typical: [0.5, 100] },
    kph: { aliases: ["kph", "kmh"], symbol: "kph", typical: [5, 300] },
    mph: { aliases: ["mph"], symbol: "mph", typical: [5, 200] },
    knot: {
      aliases: ["knot", "kt"],
      symbol: "kt",
      display: { one: "knot", other: "knots" },
      typical: [1, 100],
    },
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
    // The squared units carry no `display` for the same reason as the speeds:
    // "square metres" is not a string the parser accepts, so completion would
    // hand back text that fails to evaluate.
    m2: { aliases: ["m2", "sqm"], symbol: "m²", typical: [1, 10000] },
    cm2: { aliases: ["cm2", "sqcm"], symbol: "cm²", typical: [1, 10000] },
    km2: { aliases: ["km2", "sqkm"], symbol: "km²", typical: [0.1, 10000] },
    hectare: {
      aliases: ["hectare", "ha"],
      symbol: "ha",
      display: { one: "hectare", other: "hectares" },
      typical: [0.1, 1000],
    },
    acre: {
      aliases: ["acre"],
      symbol: "acre",
      display: { one: "acre", other: "acres" },
      typical: [0.1, 1000],
    },
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
