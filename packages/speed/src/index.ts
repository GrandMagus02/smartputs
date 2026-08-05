import type { Value } from "@smartput/core";
import { Decimal, defineKind, deriveValue } from "@smartput/core";

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
