import { expect, test } from "bun:test";
import { Decimal } from "@smartput/kind";
import { SPEED_UNITS, type SpeedUnit } from "./units";

const unitKeys = Object.keys(SPEED_UNITS.ratio) as SpeedUnit[];

/**
 * Each unit's *definition*, not its digits. A per-hour unit is its metre count
 * divided by 3600; the metre counts themselves are the defining standards --
 * 1000 m in a kilometre, 1852 m in a nautical mile (exact, BIPM/IHO), and
 * 1609.344 m in a statute mile (1760 international yards of 0.9144 m).
 *
 * `units.ts`'s own comment has promised this file since the knot was found
 * truncated to "0.514444" on 2026-08-06 (8.6e-7 relative low, which made
 * `1 knot in kph` read 1.8519984 instead of 1.852). Restating the string would
 * have re-blessed that bug; dividing re-derives it.
 */
const DEFINITION: Record<Exclude<SpeedUnit, "mps">, () => Decimal> = {
  kph: () => new Decimal(1000).div(3600),
  mph: () => new Decimal("1609.344").div(3600),
  knot: () => new Decimal(1852).div(3600),
};

test("every ratio is a decimal string, never a float literal", () => {
  for (const [unit, ratio] of Object.entries(SPEED_UNITS.ratio)) {
    expect(typeof ratio, unit).toBe("string");
  }
});

test("every per-hour ratio re-derives from its definition, digit for digit", () => {
  // `Decimal.toString()` at this repo's configured precision (28) is what the
  // table's strings were copied from, so the comparison is an equality and not
  // a tolerance. A reviewer re-derives a digit here, never counts one by hand.
  for (const [unit, derive] of Object.entries(DEFINITION)) {
    expect(SPEED_UNITS.ratio[unit as SpeedUnit], unit).toBe(derive().toString());
  }
});

test("the knot stays exactly one nautical mile per hour", () => {
  // The regression this file exists for: `1 knot in kph` is definitionally
  // 1.852, and a truncated knot moves it in the seventh decimal on both paths.
  const knot = new Decimal(SPEED_UNITS.ratio.knot as string);
  const kph = new Decimal(SPEED_UNITS.ratio.kph as string);
  expect(knot.div(kph).toSignificantDigits(10).toString()).toBe("1.852");
});

test("a mile per hour is the international yard, exactly", () => {
  // 1760 yd of 0.9144 m, per hour. `mph` is the one ratio here that terminates,
  // so it gets an exact equality rather than a rounded one.
  expect(SPEED_UNITS.ratio.mph).toBe(
    new Decimal("0.9144").times(1760).div(3600).toString(),
  );
});

/** Digits that carry information: no sign, no point, no leading zeros. */
const significantDigits = (s: string) =>
  s.replace(/^-/, "").replace(".", "").replace(/^0+/, "").length;

test("the non-terminating ratios carry more digits than a double can", () => {
  // The point of the strings. A double holds ~17 significant digits, so either
  // of these written as a number literal would have lost its tail before
  // `Decimal` ever saw it.
  for (const unit of ["kph", "knot"] as const) {
    const ratio = SPEED_UNITS.ratio[unit];
    expect(typeof ratio, unit).toBe("string");
    if (typeof ratio !== "string") continue;
    expect(significantDigits(ratio), unit).toBe(28);
    expect(String(Number(ratio)), unit).not.toBe(ratio);
  }
});

test("every alias maps to a real unit and every unit has an alias", () => {
  const units = new Set<SpeedUnit>(unitKeys);
  for (const [alias, unit] of Object.entries(SPEED_UNITS.alias)) {
    expect(units.has(unit), `${alias} -> ${unit}`).toBe(true);
    expect(alias, `${alias} must be lowercase`).toBe(alias.toLowerCase());
  }
  for (const unit of units) {
    expect(Object.values(SPEED_UNITS.alias)).toContain(unit);
  }
});

test("the canonical unit has ratio 1", () => {
  expect(SPEED_UNITS.ratio[SPEED_UNITS.canonical]).toBe("1");
});

test("a unit is its own alias, so format's output parses back", () => {
  // `format` writes `${value}${unit}`, so a unit key that is not also an alias
  // would make the round-trip contract unreachable for that unit.
  for (const unit of unitKeys) {
    expect(SPEED_UNITS.alias[unit], unit).toBe(unit);
  }
});
