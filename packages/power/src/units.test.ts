import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind";
import { POWER_UNITS, type PowerUnit } from "./units";

const unitKeys = Object.keys(POWER_UNITS.ratio) as PowerUnit[];

/**
 * A `UnitTable` ratio may be a function — that is the seam `currency` uses for
 * rates that move. Power's are all static strings, so narrow rather than cast:
 * a table that grew a dynamic ratio should fail loudly here, not silently
 * stringify a closure.
 */
const ratioOf = (unit: PowerUnit): Decimal => {
  const r = POWER_UNITS.ratio[unit];
  if (typeof r !== "string") throw new Error(`${unit} must be a static ratio`);
  return new Decimal(r);
};

/**
 * Mechanical horsepower is 550 ft·lbf/s, and every factor in that sentence is
 * an exact decimal by definition — the international foot (0.3048 m), the
 * international avoirdupois pound (0.45359237 kg) and standard gravity
 * (9.80665 m/s²) are all definitions, not measurements. So the product
 * terminates and the table can hold it exactly.
 *
 * Derived here rather than restated because `speed`'s knot ratio shipped as a
 * truncation of its definition and stayed wrong until a test like this one
 * existed.
 */
const HP_FROM_DEFINITION = new Decimal(550)
  .times("0.3048") // foot, in metres
  .times("0.45359237") // pound, in kilograms
  .times("9.80665"); // standard gravity, in m/s²

test("hp is derived from 550 ft·lbf/s, not restated", () => {
  expect(POWER_UNITS.ratio.hp).toBe(HP_FROM_DEFINITION.toString());
});

test("the hp ratio terminates, so no digit of it is a rounding", () => {
  // 550 x 0.3048 x 0.45359237 x 9.80665 is an integer over 10^17, which
  // terminates well inside the repo's 28-digit precision
  // (`Decimal.set({ precision: 28 })` in `@smartput/core/decimal`). So the
  // string is the value, not an approximation of it.
  expect(HP_FROM_DEFINITION.times("1e17").mod(1).toString()).toBe("0");
});

test("the hp ratio is wider than a double, which is why it is a string", () => {
  // `Number("745.69987158227022")` is 745.6998715822702 — the last digit is
  // gone, and that shorter literal is what a reader who round-trips this value
  // through a float ends up writing down. Written as a number literal in
  // `units.ts` the tail would be lost before Decimal ever saw it, so this
  // asserts the two spellings are genuinely different.
  const hp = ratioOf("hp").toString();
  expect(String(Number(hp))).not.toBe(hp);
});

test("the 76.0402249 kgf·m/s shortcut is why the definition is used instead", () => {
  // 76.0402249 is the intermediate (550 ft·lbf = 76.0402249068 kg·m) rounded
  // to nine decimals, and that rounding is visible in the product: the two
  // routes agree to nine significant digits and part company at the tenth.
  // This test exists to keep the rejected route documented and measured — if
  // someone "simplifies" the table to the shortcut's output, the assertion
  // above fails and this one explains why.
  const shortcut = new Decimal("76.0402249").times("9.80665");
  expect(shortcut.toSignificantDigits(9).toString()).toBe(
    HP_FROM_DEFINITION.toSignificantDigits(9).toString(),
  );
  expect(shortcut.toString()).not.toBe(POWER_UNITS.ratio.hp);
});

test("the SI prefixes are exact powers of a thousand", () => {
  // Not a restatement of the table: each is recomputed from the canonical
  // watt, so a mistyped zero is a failure rather than a silent 10x.
  expect(POWER_UNITS.ratio.kw).toBe(new Decimal(1000).toString());
  expect(POWER_UNITS.ratio.mw).toBe(new Decimal(1000).pow(2).toString());
  expect(POWER_UNITS.ratio.gw).toBe(new Decimal(1000).pow(3).toString());
});

test("mw is the megawatt and milliwatt has no spelling", () => {
  // The ruling in units.ts, pinned. Aliases fold to lowercase, so `mW` and
  // `MW` are one key; shipping both would make which one wins depend on table
  // order. If a milliwatt alias ever appears it will overwrite the megawatt
  // silently, and this is what catches that.
  expect(POWER_UNITS.alias.mw).toBe("mw");
  expect(ratioOf("mw").toNumber()).toBe(1e6);
  for (const alias of Object.keys(POWER_UNITS.alias))
    expect(alias, "milliwatt must not be spellable").not.toMatch(/^milli/);
});

test("every ratio is a decimal string, never a float literal", () => {
  for (const [unit, ratio] of Object.entries(POWER_UNITS.ratio))
    expect(typeof ratio, unit).toBe("string");
});

test("every alias maps to a real unit and every unit has an alias", () => {
  const units = new Set<PowerUnit>(unitKeys);
  for (const [alias, unit] of Object.entries(POWER_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
  for (const unit of units) expect(Object.values(POWER_UNITS.alias)).toContain(unit);
});

test("the canonical unit has ratio 1", () => {
  expect(POWER_UNITS.ratio[POWER_UNITS.canonical]).toBe("1");
});

test("a unit is its own alias, so format's output parses back", () => {
  // `format` writes `${value}${unit}`, so a unit key that is not also an alias
  // would make the round-trip contract unreachable for that unit.
  for (const unit of unitKeys) expect(POWER_UNITS.alias[unit], unit).toBe(unit);
});
