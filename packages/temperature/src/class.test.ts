import { expect, test } from "bun:test";
import { ValidationError } from "@smartput/shared";
import { TempDelta, Temperature } from "./class";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "./units";

test("the classes describe their own tables", () => {
  expect(Temperature.kind).toBe("temperature");
  expect(Temperature.canonical).toBe(TEMPERATURE_UNITS.canonical);
  expect([...Temperature.units].sort()).toEqual(
    Object.keys(TEMPERATURE_UNITS.ratio) as TemperatureUnit[],
  );
  expect(TempDelta.kind).toBe("tempdelta");
  expect(TempDelta.canonical).toBe(TEMPDELTA_UNITS.canonical);
  expect([...TempDelta.units].sort()).toEqual(
    Object.keys(TEMPDELTA_UNITS.ratio) as TempDeltaUnit[],
  );
});

test("an absolute reading has no sum, product or negation", () => {
  const t = Temperature.parse("20c") as unknown as Record<string, unknown>;
  // `add` is the one documented exception and is wired below; the rest stay
  // absent, because 20C * 2 has no meaning.
  expect(t.scale).toBeUndefined();
  expect(t.negate).toBeUndefined();
  expect(t.sub).toBeUndefined();
  expect(t.diff).toBeInstanceOf(Function);
});

test("a difference is an ordinary ratio value", () => {
  const d = TempDelta.parse("10c") as unknown as Record<string, unknown>;
  expect(d.add).toBeInstanceOf(Function);
  expect(d.sub).toBeInstanceOf(Function);
  expect(d.scale).toBeInstanceOf(Function);
  expect(d.negate).toBeInstanceOf(Function);
  expect(d.diff).toBeUndefined();
});

test("subtracting two readings yields a delta", () => {
  const d = Temperature.parse("30c").diff(Temperature.parse("20c"));
  expect(d.value).toBe(10);
  expect(d.unit).toBe("c");
  expect(TempDelta.from(d)).toBeInstanceOf(TempDelta);
  // 212F - 32F is 100C of difference, never 212F read back through the offset.
  expect(Temperature.parse("212f").diff("32f").value).toBeCloseTo(100, 9);
});

test("a reading plus a delta is a reading, in the reading's own unit", () => {
  const warmer = Temperature.parse("30c").add(TempDelta.parse("5c"));
  expect(warmer.unit).toBe("c");
  expect(warmer.value).toBe(35);
  expect(warmer).toBeInstanceOf(Temperature);

  // 86F is 30C; five *degrees Celsius* warmer is 35C, which is 95F.
  const f = Temperature.parse("86f").add("5c");
  expect(f.unit).toBe("f");
  expect(f.value).toBeCloseTo(95, 9);

  // And a Fahrenheit difference stays a Fahrenheit difference: 9F of warming
  // is 5C of warming, so 20C becomes 25C.
  expect(Temperature.parse("20c").add(TempDelta.parse("9f")).value).toBeCloseTo(25, 9);
});

test("adding a delta leaves the receiver untouched", () => {
  const a = Temperature.parse("20c");
  const b = a.add("5c");
  expect(a.value).toBe(20);
  expect(b.value).toBe(25);
  expect(Object.isFrozen(a)).toBe(true);
});

test("conversion, comparison and rendering", () => {
  expect(Temperature.parse("212f").to("c")).toBeCloseTo(100, 9);
  expect(Temperature.parse("0k").to("c")).toBeCloseTo(-273.15, 9);
  expect(Temperature.parse("100c").compare("100f")).toBe(1);
  expect(Temperature.parse("100c") > Temperature.parse("100f")).toBe(true);
  expect(Temperature.parse("30c").toString()).toBe("30c");
  expect(Temperature.parse("30c").toJSON()).toEqual({ value: 30, unit: "c" });
  expect(() => Temperature.parse("30smth")).toThrow(ValidationError);
  expect(TempDelta.tryParse("30smth")).toMatchObject({ ok: false, code: "unknown-unit" });
});
