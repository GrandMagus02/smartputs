import { expect, test } from "bun:test";
import { createValueClass } from "./class";
import { ValidationError } from "./errors";
import type { UnitTable } from "./types";

const ANGLE: UnitTable<"rad" | "deg" | "turn"> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    turn: "6.28318530717958647692528676656",
  },
  alias: { rad: "rad", deg: "deg", degree: "deg", degrees: "deg", turn: "turn" },
};

const TEMPDELTA: UnitTable<"c" | "f" | "k"> = {
  canonical: "c",
  ratio: { c: "1", f: "0.55555555555555555556", k: "1" },
  alias: { c: "c", f: "f", k: "k" },
};

const TEMP: UnitTable<"c" | "f" | "k"> = {
  canonical: "c",
  ratio: { c: "1", f: "0.55555555555555555556", k: "1" },
  offset: { f: "-32", k: "-273.15" },
  alias: { c: "c", f: "f", k: "k" },
};

const Angle = createValueClass(ANGLE, "angle");
const TempDelta = createValueClass(TEMPDELTA, "tempdelta");
const Temperature = createValueClass(TEMP, "temperature", { delta: () => TempDelta });

test("the spec's worked example", () => {
  const a = Angle.parse("30deg");
  const b = a.add?.(new Angle(30, "deg"));
  expect(a.toString()).toBe("30deg");
  expect(b?.toString()).toBe("60deg");
});

test("instances are frozen and never mutated", () => {
  const a = Angle.parse("30deg");
  expect(Object.isFrozen(a)).toBe(true);
  expect(() => {
    (a as unknown as { value: number }).value = 99;
  }).toThrow();
  const b = a.add?.("15deg");
  expect(a.value).toBe(30);
  expect(b).not.toBe(a);
});

test("every mutation of a frozen instance throws, including a new property", () => {
  const a = Angle.parse("30deg");
  expect(() => {
    (a as unknown as { unit: string }).unit = "rad";
  }).toThrow(TypeError);
  expect(() => {
    (a as unknown as { extra: number }).extra = 1;
  }).toThrow(TypeError);
  expect(Object.isSealed(a)).toBe(true);
  expect(a.value).toBe(30);
  expect(a.unit).toBe("deg");
});

test("freezing the instance leaves the prototype's methods callable", () => {
  const a = Angle.parse("30deg");
  // The methods live on the prototype, which is not frozen by the
  // constructor -- freezing `this` only seals own properties.
  expect(Object.hasOwn(a, "add")).toBe(false);
  expect(Object.hasOwn(a, "toString")).toBe(false);
  expect(typeof a.add).toBe("function");
  expect(a.add?.("30deg").value).toBe(60);
  expect(Object.keys(a).sort()).toEqual(["unit", "value"]);
});

test("parse throws, tryParse does not", () => {
  expect(() => Angle.parse("30smth")).toThrow(ValidationError);
  try {
    Angle.parse("30smth");
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError);
    expect((e as ValidationError).code).toBe("unknown-unit");
    expect((e as ValidationError).input).toBe("30smth");
  }
  expect(Angle.tryParse("30smth")).toMatchObject({ ok: false, code: "unknown-unit" });
  expect(Angle.tryParse("30deg")).toBeInstanceOf(Angle);
});

test("parse forwards its options", () => {
  expect(() => Angle.parse("  30deg  ", { mode: "strict" })).toThrow(ValidationError);
  expect(Angle.parse("30", { defaultUnit: "deg" }).unit).toBe("deg");
  expect(Angle.tryParse("30rad", { unit: "deg" })).toMatchObject({
    ok: false,
    code: "wrong-unit",
  });
});

test("from accepts a string, an Ok record, and an instance", () => {
  expect(Angle.from("30deg").value).toBe(30);
  expect(Angle.from({ ok: true, value: 30, unit: "deg", raw: "30" }).value).toBe(30);
  const a = Angle.parse("30deg");
  expect(Angle.from(a)).toBe(a);
});

test("to, as, equals, compare", () => {
  const a = Angle.parse("180deg");
  expect(a.to("rad")).toBeCloseTo(Math.PI, 12);
  expect(a.as("rad").unit).toBe("rad");
  expect(a.equals("0.5turn")).toBe(true);
  expect(a.compare("0.25turn")).toBe(1);
});

test("equals and compare accept an instance as well as a string", () => {
  const a = Angle.parse("180deg");
  expect(a.equals(new Angle(0.5, "turn"))).toBe(true);
  expect(a.compare(new Angle(1, "turn"))).toBe(-1);
  expect(a.compare(a)).toBe(0);
  expect(a.equals("0.4turn")).toBe(false);
  expect(a.equals("0.4turn", 1)).toBe(true);
});

test("a conversion to the unit already held is exact", () => {
  const a = Angle.parse("30deg");
  expect(a.to("deg")).toBe(30);
  expect(a.as("deg").value).toBe(30);
  expect(a.add?.("15deg").value).toBe(45);
  expect(a.sub?.("15deg").value).toBe(15);
  expect(a.scale?.(3).value).toBe(90);
  expect(a.negate?.().value).toBe(-30);
});

test("valueOf returns the canonical magnitude, so < and > work", () => {
  const small = Angle.parse("30deg");
  const large = Angle.parse("1turn");
  expect(small < large).toBe(true);
  expect(large > small).toBe(true);
});

test("valueOf is the canonical magnitude of the value itself", () => {
  expect(Angle.parse("1turn").valueOf()).toBeCloseTo(2 * Math.PI, 12);
  expect(Angle.parse("2rad").valueOf()).toBe(2);
  const sorted = ["1turn", "30deg", "2rad"]
    .map((s) => Angle.parse(s))
    .sort((x, y) => x.compare(y));
  expect(sorted.map((v) => v.toString())).toEqual(["30deg", "2rad", "1turn"]);
});

test("toJSON and toString round-trip", () => {
  const a = Angle.parse("30.5deg");
  expect(a.toJSON()).toEqual({ value: 30.5, unit: "deg" });
  expect(JSON.stringify(a)).toBe('{"value":30.5,"unit":"deg"}');
  expect(Angle.parse(a.toString()).equals(a)).toBe(true);
});

test("an operation's result round-trips through strict parse", () => {
  const b = Angle.parse("30deg").add?.("0.25turn");
  expect(b).toBeDefined();
  if (b === undefined) return;
  expect(Angle.parse(b.toString(), { mode: "strict" }).equals(b)).toBe(true);
});

test("static metadata", () => {
  expect(Angle.kind).toBe("angle");
  expect(Angle.canonical).toBe("rad");
  expect([...Angle.units].sort()).toEqual(["deg", "rad", "turn"]);
});

test("an affine kind has diff and no add, sub, scale or negate", () => {
  const t = Temperature.parse("30c");
  expect(t.add).toBeUndefined();
  expect(t.sub).toBeUndefined();
  expect(t.scale).toBeUndefined();
  expect(t.negate).toBeUndefined();
  expect(t.diff).toBeDefined();
});

test("a temperature diff produces a delta in the delta class", () => {
  const d = Temperature.parse("30c").diff?.("20c");
  expect(d).toBeInstanceOf(TempDelta);
  expect(d?.value).toBeCloseTo(10, 9);
  expect(d?.add?.("5c").value).toBeCloseTo(15, 9);
});

test("a Fahrenheit diff is a Celsius delta, with no offset re-applied", () => {
  // 212F - 32F is a hundred degree difference, not 180 and not 68.
  const d = Temperature.parse("212f").diff?.(Temperature.parse("32f"));
  expect(d).toBeInstanceOf(TempDelta);
  expect(d?.unit).toBe("c");
  expect(d?.value).toBeCloseTo(100, 9);
  // Read back into Fahrenheit the delta is 180 -- the delta table has no
  // offset, so no 32 comes back with it.
  expect(d?.to("f")).toBeCloseTo(180, 9);
});

test("diff on an affine kind with no delta class bound throws", () => {
  const Lonely = createValueClass(TEMP, "temperature");
  expect(() => Lonely.parse("30c").diff?.("20c")).toThrow(ValidationError);
});

test("a ratio kind has no diff", () => {
  expect(Angle.parse("30deg").diff).toBeUndefined();
});

test("the constructor accepts a numeric string and rejects an unknown unit", () => {
  expect(new Angle("30.5", "deg").value).toBe(30.5);
  expect(() => new Angle(30, "smth" as never)).toThrow(ValidationError);
});

test("the constructor rejects a value that is not a finite number", () => {
  expect(() => new Angle("abc", "deg")).toThrow(ValidationError);
  expect(() => new Angle(Number.NaN, "deg")).toThrow(ValidationError);
  expect(() => new Angle(Number.POSITIVE_INFINITY, "deg")).toThrow(ValidationError);
  // An inherited key is not a unit: `"toString" in table.ratio` is true.
  expect(() => new Angle(1, "toString" as never)).toThrow(ValidationError);
});
