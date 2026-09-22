import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind";
import { VOLUME_UNITS, type VolumeUnit } from "./units";

/**
 * Each unit's *definition*, not its digits. Canonical is the litre, which is
 * exactly a cubic decimetre, so a cubic metre is 1000 of them. `gal` and
 * `pint` are the **US liquid** ones: the gallon is exactly 231 cubic inches
 * (the inch being exactly 0.0254 m since 1959) and the pint is an eighth of
 * it. The imperial gallon is 4.54609 l and is deliberately not this table's —
 * a test that derived it would be asserting a different unit.
 *
 * Restating the strings would only re-bless whatever is in the table, which is
 * how `speed`'s knot survived six truncated decimals. Cubing re-derives them,
 * so a digit dropped from the gallon fails here rather than in a recipe.
 */
const INCH_CUBED_IN_LITRES = () => new Decimal("0.0254").pow(3).times(1000);

const DEFINITION: Record<VolumeUnit, () => Decimal> = {
  l: () => new Decimal(1),
  ml: () => new Decimal(1).div(1000),
  m3: () => new Decimal(1000),
  gal: () => INCH_CUBED_IN_LITRES().times(231),
  pint: () => INCH_CUBED_IN_LITRES().times(231).div(8),
};

test("every ratio is a decimal string, never a float literal", () => {
  // §3 of the code practices: the shared path does `Number(r)` and the engine
  // path does `new Decimal(r)`, and only a string keeps both exact.
  for (const [unit, ratio] of Object.entries(VOLUME_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe("string");
  }
});

test("every ratio re-derives from its defining standard, digit for digit", () => {
  for (const [unit, derive] of Object.entries(DEFINITION)) {
    expect(VOLUME_UNITS.ratio[unit as VolumeUnit], unit).toBe(derive().toString());
  }
});

test("the gallon is the US liquid one, eight pints and not 4.54609 l", () => {
  // Naming the unit the table does *not* hold is the point: 3.785411784 and
  // 4.54609 are both called "a gallon", and the aliases in `units.ts` claim the
  // bare word, so which one it means is a ruling and belongs in a test.
  const gal = new Decimal(VOLUME_UNITS.ratio.gal as string);
  const pint = new Decimal(VOLUME_UNITS.ratio.pint as string);
  expect(pint.times(8).eq(gal)).toBe(true);
  expect(gal.eq("4.54609")).toBe(false);
  expect(gal.eq("3.785411784")).toBe(true);
});

test("the canonical unit has ratio 1", () => {
  expect(VOLUME_UNITS.ratio[VOLUME_UNITS.canonical]).toBe("1");
});

test("a unit is its own alias, so format's output parses back", () => {
  // `format` writes `${value}${unit}`, so a unit key that is not also an alias
  // would make the round-trip contract unreachable for that unit.
  for (const unit of Object.keys(VOLUME_UNITS.ratio) as VolumeUnit[]) {
    expect(VOLUME_UNITS.alias[unit], unit).toBe(unit);
  }
});

test("every alias is lowercase and names a real unit", () => {
  const units = new Set(Object.keys(VOLUME_UNITS.ratio));
  for (const [alias, unit] of Object.entries(VOLUME_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
});
