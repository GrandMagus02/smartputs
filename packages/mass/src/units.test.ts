import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind";
import { MASS_UNITS, type MassUnit } from "./units";

/**
 * Each unit's *definition*, not its digits. The avoirdupois pound is exactly
 * 0.45359237 kg by the 1959 international yard-and-pound agreement, and the
 * ounce is a sixteenth of it; the rest are SI prefixes on the gram.
 *
 * Restating the strings would only re-bless whatever is in the table, which is
 * how `speed`'s knot survived six truncated decimals. Dividing re-derives them,
 * so a digit dropped from `lb` fails here rather than in someone's invoice.
 */
const POUND_IN_GRAMS = () => new Decimal("0.45359237").times(1000);

const DEFINITION: Record<MassUnit, () => Decimal> = {
  mg: () => new Decimal(1).div(1000),
  g: () => new Decimal(1),
  kg: () => new Decimal(1000),
  t: () => new Decimal(1000).times(1000),
  oz: () => POUND_IN_GRAMS().div(16),
  lb: POUND_IN_GRAMS,
};

test("every ratio is a decimal string, never a float literal", () => {
  // §3 of the code practices: the shared path does `Number(r)` and the engine
  // path does `new Decimal(r)`, and only a string keeps both exact.
  for (const [unit, ratio] of Object.entries(MASS_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe("string");
  }
});

test("every ratio re-derives from its defining standard, digit for digit", () => {
  for (const [unit, derive] of Object.entries(DEFINITION)) {
    expect(MASS_UNITS.ratio[unit as MassUnit], unit).toBe(derive().toString());
  }
});

test("the pound and the ounce stay exact, not rounded", () => {
  // Both terminate in decimal, so neither may acquire a tail or lose one: an
  // ounce is 28.349523125 g on the nose, and sixteen of them are a pound.
  const oz = new Decimal(MASS_UNITS.ratio.oz as string);
  const lb = new Decimal(MASS_UNITS.ratio.lb as string);
  expect(oz.times(16).eq(lb)).toBe(true);
  expect(lb.div(1000).toString()).toBe("0.45359237");
});

test("the canonical unit has ratio 1", () => {
  expect(MASS_UNITS.ratio[MASS_UNITS.canonical]).toBe("1");
});

test("a unit is its own alias, so format's output parses back", () => {
  // `format` writes `${value}${unit}`, so a unit key that is not also an alias
  // would make the round-trip contract unreachable for that unit.
  for (const unit of Object.keys(MASS_UNITS.ratio) as MassUnit[]) {
    expect(MASS_UNITS.alias[unit], unit).toBe(unit);
  }
});

test("every alias is lowercase and names a real unit", () => {
  const units = new Set(Object.keys(MASS_UNITS.ratio));
  for (const [alias, unit] of Object.entries(MASS_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
});
