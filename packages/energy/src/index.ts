import type { Value } from "@smartput/core";
import {
  aliasesFor,
  type Decimal,
  decimalRatios,
  defineKind,
  deriveValue,
} from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "./units";

export type { EnergyUnit } from "./units";
export { ENERGY_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the left operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/** Canonical joule. Produced by multiplying a power by a duration. */
export const energy = defineKind({
  id: "energy",
  value: {
    mode: "ratio",
    canonical: ENERGY_UNITS.canonical,
    units: decimalRatios(ENERGY_UNITS),
  },
  lexicon: {
    j: {
      aliases: alias("j"),
      symbol: "j",
      display: { one: "joule", other: "joules" },
      typical: [1, 1000],
    },
    kj: {
      aliases: alias("kj"),
      symbol: "kj",
      display: { one: "kilojoule", other: "kilojoules" },
      typical: [1, 1000],
    },
    mj: {
      aliases: alias("mj"),
      symbol: "mj",
      display: { one: "megajoule", other: "megajoules" },
      typical: [1, 1000],
    },
    // wh, kwh and mwh carry no `display`: their written-out forms are compounds
    // ("watt hours") that the parser rejects, and a display form that does not
    // parse back is a dead end for completion. Absent display keeps formatValue
    // on the symbol. Same call `speed` makes for "metres per second".
    wh: { aliases: alias("wh"), symbol: "wh", typical: [1, 1000] },
    kwh: { aliases: alias("kwh"), symbol: "kwh", typical: [1, 1000] },
    mwh: { aliases: alias("mwh"), symbol: "mwh", typical: [0.1, 100] },
    cal: {
      aliases: alias("cal"),
      symbol: "cal",
      display: { one: "calorie", other: "calories" },
      typical: [1, 1000],
    },
    kcal: {
      aliases: alias("kcal"),
      symbol: "kcal",
      display: { one: "kilocalorie", other: "kilocalories" },
      typical: [1, 5000],
    },
    btu: {
      aliases: alias("btu"),
      symbol: "btu",
      display: { one: "btu", other: "btus" },
      typical: [1, 100000],
    },
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
