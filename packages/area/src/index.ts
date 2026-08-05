import type { Value } from "@smartput/core";
import { type Decimal, defineKind, deriveValue } from "@smartput/core";

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
