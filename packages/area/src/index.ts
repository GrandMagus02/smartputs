import type { Value } from "@smartput/core";
import {
  aliasesFor,
  type Decimal,
  decimalRatios,
  defineKind,
  deriveValue,
} from "@smartput/core";
import { AREA_UNITS, type AreaUnit } from "./units";

export type { AreaUnit } from "./units";
export { AREA_UNITS } from "./units";

/**
 * A derived kind's result is a different kind and unit than either operand,
 * but it still inherits the left operand's `meta` — that is what `deriveValue`
 * is for, and hand-building the frozen Value here is what dropped it.
 */
const make = (source: Value, kind: string, unit: string, canonical: Decimal): Value =>
  deriveValue(source, canonical, { kind, unit });

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/** Canonical square metres. Produced by multiplying two lengths. */
export const area = defineKind({
  id: "area",
  value: {
    mode: "ratio",
    canonical: AREA_UNITS.canonical,
    units: decimalRatios(AREA_UNITS),
  },
  lexicon: {
    // The squared units carry no `display` for the same reason as the speeds:
    // "square metres" is not a string the parser accepts, so completion would
    // hand back text that fails to evaluate.
    m2: { aliases: alias("m2"), symbol: "m²", typical: [1, 10000] },
    cm2: { aliases: alias("cm2"), symbol: "cm²", typical: [1, 10000] },
    km2: { aliases: alias("km2"), symbol: "km²", typical: [0.1, 10000] },
    hectare: {
      aliases: alias("hectare"),
      symbol: "ha",
      display: { one: "hectare", other: "hectares" },
      typical: [0.1, 1000],
    },
    acre: {
      aliases: alias("acre"),
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
