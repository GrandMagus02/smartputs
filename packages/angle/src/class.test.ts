import { expect, test } from "bun:test";
import { Angle } from "./class";
import { ANGLE_UNITS, type AngleUnit } from "./units";

test("the spec's worked example", () => {
  const a = Angle.parse("30deg");
  const b = a.add?.(new Angle(30, "deg"));
  expect(a.toString()).toBe("30deg");
  expect(b?.toString()).toBe("60deg");
  expect(b?.to("rad")).toBeCloseTo(Math.PI / 3, 12);
});

test("instances are immutable", () => {
  const a = Angle.parse("30deg");
  expect(Object.isFrozen(a)).toBe(true);
  a.add?.("15deg");
  expect(a.value).toBe(30);
});

test("comparison operators work through valueOf", () => {
  expect(Angle.parse("30deg") < Angle.parse("1turn")).toBe(true);
});

test("the class reports the same units the table declares", () => {
  const declared = Object.keys(ANGLE_UNITS.ratio) as AngleUnit[];
  expect([...Angle.units].sort()).toEqual(declared.sort());
  expect(Angle.canonical).toBe(ANGLE_UNITS.canonical);
  expect(Angle.kind).toBe("angle");
});

test("angle is a ratio kind, so it has the arithmetic and no diff", () => {
  const a = Angle.parse("30deg");
  expect(a.add).toBeDefined();
  expect(a.sub).toBeDefined();
  expect(a.scale).toBeDefined();
  expect(a.negate).toBeDefined();
  expect(a.diff).toBeUndefined();
});

test("a same-unit result is exact", () => {
  expect(Angle.parse("30deg").to("deg")).toBe(30);
  expect(Angle.parse("30deg").sub?.("15deg").value).toBe(15);
});
