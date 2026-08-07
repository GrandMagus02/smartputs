import type { Value } from "@smartput/core";
import { type Decimal, decimalRatios, defineKind, deriveValue } from "@smartput/core";
import { DATARATE_UNITS } from "./units";

export type { DatarateUnit } from "./units";
export { DATARATE_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the source operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

/**
 * Canonical bits per second. Produced by dividing a datasize by a duration.
 *
 * The four ops below are declared here rather than on `datasize` or `duration`
 * because a signature names its operand kinds by string: this package can bridge
 * two kinds it does not depend on, and neither of them has to learn that
 * datarate exists.
 *
 * Every one of them carries the bit/byte factor explicitly. `datasize` counts
 * bytes and this kind counts bits, so a bridge that omitted the 8 would be off
 * by that factor and still typecheck.
 */
export const datarate = defineKind({
  id: "datarate",
  value: {
    mode: "ratio",
    canonical: DATARATE_UNITS.canonical,
    units: decimalRatios(DATARATE_UNITS),
  },
  // Engineering, not language: the magnitude band people type each unit in,
  // read only by completion's `scaleFit`. The words moved to `locale/en.ts`.
  typical: {
    bps: [1, 1000],
    kbps: [1, 1000],
    mbps: [1, 1000],
    gbps: [0.1, 100],
    tbps: [0.1, 100],
  },
  ops: [
    {
      op: "/",
      left: "datasize",
      right: "duration",
      result: "datarate",
      apply: (l, r) => make(l, "datarate", "mbps", l.canonical.times(8).div(r.canonical)),
    },
    {
      op: "*",
      left: "datarate",
      right: "duration",
      result: "datasize",
      apply: (l, r) => make(l, "datasize", "b", l.canonical.times(r.canonical).div(8)),
    },
    {
      // Multiplication commutes, but signatures do not: the op table is keyed on
      // (op, left, right), so "1 min * 100 mbps" has no answer unless the
      // swapped pair is declared too.
      op: "*",
      left: "duration",
      right: "datarate",
      result: "datasize",
      apply: (l, r) => make(l, "datasize", "b", l.canonical.times(r.canonical).div(8)),
    },
    {
      op: "/",
      left: "datasize",
      right: "datarate",
      result: "duration",
      apply: (l, r) => make(l, "duration", "s", l.canonical.times(8).div(r.canonical)),
    },
  ],
});
