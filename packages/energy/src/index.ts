import type { Value } from "@smartput/kind";
import { type Decimal, decimalRatios, defineKind, deriveValue } from "@smartput/kind";
import { ENERGY_UNITS } from "./units";

export type { EnergyUnit } from "./units";
export { ENERGY_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the left operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

/** Canonical joule. Produced by multiplying a power by a duration. */
export const energy = defineKind({
  id: "energy",
  value: {
    mode: "ratio",
    canonical: ENERGY_UNITS.canonical,
    units: decimalRatios(ENERGY_UNITS),
  },
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  typical: {
    j: [1, 1000],
    kj: [1, 1000],
    mj: [1, 1000],
    wh: [1, 1000],
    kwh: [1, 1000],
    mwh: [0.1, 100],
    cal: [1, 1000],
    kcal: [1, 5000],
    btu: [1, 100000],
  },
  // The whole power/duration/energy bridge lives here rather than being split
  // across the three packages, because a signature has to be declared exactly
  // once: two packages declaring `* | power | duration` would register two
  // handlers for one key. Energy is the produced kind, so energy owns all four.
  //
  // `"power"` and `"duration"` are kind-id strings, not imports — the registry
  // resolves an op's operands by id at registration time, so naming a kind
  // costs nothing at the module graph. That is what keeps this package off
  // `@smartput/power` and `@smartput/duration`, exactly as `speed` names
  // "length" and "duration" without depending on either.
  ops: [
    {
      op: "*",
      left: "power",
      right: "duration",
      result: "energy",
      apply: (l, r) => make(l, "energy", "j", l.canonical.times(r.canonical)),
    },
    // Multiplication commutes, but signature lookup does not: the key is the
    // ordered operand pair, so "3 h * 2 kw" needs its own entry.
    {
      op: "*",
      left: "duration",
      right: "power",
      result: "energy",
      apply: (l, r) => make(l, "energy", "j", l.canonical.times(r.canonical)),
    },
    {
      op: "/",
      left: "energy",
      right: "duration",
      result: "power",
      apply: (l, r) => make(l, "power", "w", l.canonical.div(r.canonical)),
    },
    {
      op: "/",
      left: "energy",
      right: "power",
      result: "duration",
      apply: (l, r) => make(l, "duration", "s", l.canonical.div(r.canonical)),
    },
  ],
});
