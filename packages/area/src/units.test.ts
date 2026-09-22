import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind";
import { AREA_UNITS, type AreaUnit } from "./units";

/**
 * Each unit's *definition*, not its digits. An area unit is the square of a
 * length unit, so every ratio here is derived from the length that names it:
 * the hectare is a hectometre squared, and the acre is 4840 square
 * international yards, the yard being exactly 0.9144 m since 1959.
 *
 * Restating the strings would only re-bless whatever is in the table, which is
 * how `speed`'s knot survived six truncated decimals. Squaring re-derives them,
 * so a digit dropped from the acre fails here rather than in a land registry.
 */
const YARD = () => new Decimal("0.9144");

const DEFINITION: Record<AreaUnit, () => Decimal> = {
  m2: () => new Decimal(1),
  cm2: () => new Decimal(1).div(100).pow(2),
  km2: () => new Decimal(1000).pow(2),
  hectare: () => new Decimal(100).pow(2),
  acre: () => YARD().pow(2).times(4840),
};

test("every ratio is a decimal string, never a float literal", () => {
  // §3 of the code practices: the shared path does `Number(r)` and the engine
  // path does `new Decimal(r)`, and only a string keeps both exact.
  for (const [unit, ratio] of Object.entries(AREA_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe("string");
  }
});

test("every ratio re-derives from its defining standard, digit for digit", () => {
  for (const [unit, derive] of Object.entries(DEFINITION)) {
    expect(AREA_UNITS.ratio[unit as AreaUnit], unit).toBe(derive().toString());
  }
});

test("the acre stays 4840 square yards and 1/640 of a square mile", () => {
  // Both relations terminate in decimal, so they are exact equalities: an acre
  // that drifts is an acre that no longer tiles a section.
  const acre = new Decimal(AREA_UNITS.ratio.acre as string);
  expect(acre.div(YARD().pow(2)).eq(4840)).toBe(true);
  expect(acre.times(640).eq(YARD().times(1760).pow(2))).toBe(true);
});

test("the canonical unit has ratio 1", () => {
  expect(AREA_UNITS.ratio[AREA_UNITS.canonical]).toBe("1");
});

test("a unit is its own alias, so format's output parses back", () => {
  // `format` writes `${value}${unit}`, so a unit key that is not also an alias
  // would make the round-trip contract unreachable for that unit.
  for (const unit of Object.keys(AREA_UNITS.ratio) as AreaUnit[]) {
    expect(AREA_UNITS.alias[unit], unit).toBe(unit);
  }
});

test("every alias is lowercase and names a real unit", () => {
  const units = new Set(Object.keys(AREA_UNITS.ratio));
  for (const [alias, unit] of Object.entries(AREA_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
});
