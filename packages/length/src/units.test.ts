import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind";
import { LENGTH_UNITS, type LengthUnit } from "./units";

/**
 * Each unit's *definition*, not its digits. The international yard is exactly
 * 0.9144 m (the 1959 yard-and-pound agreement), and every imperial length here
 * is a whole-number multiple or divisor of it: 36 inches, 3 feet, 1760 yards to
 * the mile. The metric four are SI prefixes on the metre.
 *
 * Restating the strings would only re-bless whatever is in the table, which is
 * how `speed`'s knot survived six truncated decimals. Dividing re-derives them,
 * so a digit dropped from the yard fails here rather than in a tape measure.
 */
const YARD = () => new Decimal("0.9144");

const DEFINITION: Record<LengthUnit, () => Decimal> = {
  mm: () => new Decimal(1).div(1000),
  cm: () => new Decimal(1).div(100),
  m: () => new Decimal(1),
  km: () => new Decimal(1000),
  in: () => YARD().div(36),
  ft: () => YARD().div(3),
  yd: YARD,
  mi: () => YARD().times(1760),
};

test("every ratio is a decimal string, never a float literal", () => {
  // §3 of the code practices: the shared path does `Number(r)` and the engine
  // path does `new Decimal(r)`, and only a string keeps both exact.
  for (const [unit, ratio] of Object.entries(LENGTH_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe("string");
  }
});

test("every ratio re-derives from its defining standard, digit for digit", () => {
  for (const [unit, derive] of Object.entries(DEFINITION)) {
    expect(LENGTH_UNITS.ratio[unit as LengthUnit], unit).toBe(derive().toString());
  }
});

test("the imperial lengths stay whole multiples of each other", () => {
  // All four terminate in decimal, so the relations are exact equalities and
  // not tolerances: a mile that drifts is a mile that no longer holds 5280 ft.
  const r = (u: LengthUnit) => new Decimal(LENGTH_UNITS.ratio[u] as string);
  expect(r("in").times(12).eq(r("ft"))).toBe(true);
  expect(r("ft").times(3).eq(r("yd"))).toBe(true);
  expect(r("ft").times(5280).eq(r("mi"))).toBe(true);
});

test("the canonical unit has ratio 1", () => {
  expect(LENGTH_UNITS.ratio[LENGTH_UNITS.canonical]).toBe("1");
});

test("a unit is its own alias, so format's output parses back", () => {
  // `format` writes `${value}${unit}`, so a unit key that is not also an alias
  // would make the round-trip contract unreachable for that unit.
  for (const unit of Object.keys(LENGTH_UNITS.ratio) as LengthUnit[]) {
    expect(LENGTH_UNITS.alias[unit], unit).toBe(unit);
  }
});

test("every alias is lowercase and names a real unit", () => {
  const units = new Set(Object.keys(LENGTH_UNITS.ratio));
  for (const [alias, unit] of Object.entries(LENGTH_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
});
