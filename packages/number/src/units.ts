import type { UnitTable } from "@smartput/validate";

export type NumberUnit = "one";

/**
 * The smallest table in the library: one unit, ratio 1, and exactly the
 * self-alias every unit needs so `format`'s `${raw}${unit}` round-trips
 * through strict mode (`formatNumber` emits `"7.25one"`; without `alias.one`
 * that string could never parse back). No synonym beyond that — "number" has
 * nothing else to call its one unit, and `validate.ts` hardcodes
 * `defaultUnit: "one"` so callers almost never spell it at all.
 */
export const NUMBER_UNITS: UnitTable<NumberUnit> = {
  canonical: "one",
  ratio: { one: "1" },
  alias: { one: "one" },
};
