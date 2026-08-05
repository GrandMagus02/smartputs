import type { Value } from "@smartput/core";
import {
  aliasesFor,
  type Decimal,
  decimalRatios,
  defineKind,
  deriveValue,
} from "@smartput/core";
import { SPEED_UNITS, type SpeedUnit } from "./units";

export type { SpeedUnit } from "./units";
export { SPEED_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the left operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

const alias = (unit: SpeedUnit) => aliasesFor(SPEED_UNITS, unit);

/** Canonical metres per second. Produced by dividing a length by a duration. */
export const speed = defineKind({
  id: "speed",
  value: {
    mode: "ratio",
    canonical: SPEED_UNITS.canonical,
    units: decimalRatios(SPEED_UNITS),
  },
  lexicon: {
    // mps, kph and mph carry no `display`: their written-out forms
    // ("metres per second", "kilometres per hour") are compounds the parser
    // rejects, and a display form that does not parse back is a dead end for
    // completion. Absent display keeps formatValue on the symbol.
    mps: { aliases: alias("mps"), symbol: "m/s", typical: [0.5, 100] },
    kph: { aliases: alias("kph"), symbol: "kph", typical: [5, 300] },
    mph: { aliases: alias("mph"), symbol: "mph", typical: [5, 200] },
    knot: {
      aliases: alias("knot"),
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
