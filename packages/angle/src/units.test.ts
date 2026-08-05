import { expect, test } from "bun:test";
import { ANGLE_UNITS, type AngleUnit } from "./units";

const unitKeys = Object.keys(ANGLE_UNITS.ratio) as AngleUnit[];

test("every ratio is a decimal string, never a float literal", () => {
  for (const [unit, ratio] of Object.entries(ANGLE_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe("string");
  }
});

test("pi-derived ratios carry 30 significant digits", () => {
  // The literal angle/index.ts guarded before this table existed. Losing these
  // digits is what makes "0.25 turn in deg" render 89.9999999999999 instead of
  // 90, and a float literal in this file would do exactly that.
  //
  // Every digit below is pi/180, pi/200 and 2pi correctly rounded to 30
  // significant digits, cross-checked against decimal.js's own `acos(-1)` at
  // precision 60. `toSignificantDigits` is what a reviewer should reach for to
  // re-derive them, not a hand count.
  expect(ANGLE_UNITS.ratio.deg).toBe("0.0174532925199432957692369076849");
  expect(ANGLE_UNITS.ratio.grad).toBe("0.0157079632679489661923132169164");
  expect(ANGLE_UNITS.ratio.turn).toBe("6.28318530717958647692528676656");
});

/** Digits that carry information: no sign, no point, no leading zeros. */
const significantDigits = (s: string) =>
  s.replace(/^-/, "").replace(".", "").replace(/^0+/, "").length;

test("every ratio string carries more digits than a double can", () => {
  // The point of the strings. A double holds ~17 significant digits, so any of
  // these written as a number literal would already have lost its tail before
  // Decimal ever saw it.
  for (const [unit, ratio] of Object.entries(ANGLE_UNITS.ratio)) {
    if (unit === ANGLE_UNITS.canonical) continue;
    expect(typeof ratio, unit).toBe("string");
    if (typeof ratio !== "string") continue;
    expect(significantDigits(ratio), unit).toBe(30);
    expect(String(Number(ratio)), unit).not.toBe(ratio);
  }
});

test("every alias maps to a real unit and every unit has an alias", () => {
  const units = new Set<AngleUnit>(unitKeys);
  for (const [alias, unit] of Object.entries(ANGLE_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
  for (const unit of units) {
    expect(Object.values(ANGLE_UNITS.alias)).toContain(unit);
  }
});

test("the canonical unit has ratio 1", () => {
  expect(ANGLE_UNITS.ratio[ANGLE_UNITS.canonical]).toBe("1");
});

test("a unit is its own alias, so format's output parses back", () => {
  // `format` writes `${value}${unit}`, so a unit key that is not also an alias
  // would make the round-trip contract unreachable for that unit.
  for (const unit of unitKeys) {
    expect(ANGLE_UNITS.alias[unit], unit).toBe(unit);
  }
});
