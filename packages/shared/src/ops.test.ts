import { expect, test } from "bun:test";
import { add, as, compare, equals, format, negate, scale, sub } from "./ops";
import { parse } from "./parse";
import type { UnitTable } from "./types";

const T: UnitTable<"rad" | "deg" | "turn"> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    turn: "6.28318530717958647692528676656",
  },
  alias: { rad: "rad", deg: "deg", degree: "deg", degrees: "deg", turn: "turn" },
};

test("ops accept raw strings", () => {
  expect(add(T, "30deg", "15deg")).toMatchObject({ ok: true, value: 45, unit: "deg" });
  expect(sub(T, "30deg", "15deg")).toMatchObject({ ok: true, value: 15, unit: "deg" });
});

test("the left operand's unit wins, matching the engine", () => {
  const sum = add(T, "1turn", "180deg");
  expect(sum).toMatchObject({ ok: true, unit: "turn" });
  if (sum.ok) expect(sum.value).toBeCloseTo(1.5, 12);

  const flipped = add(T, "180deg", "1turn");
  expect(flipped).toMatchObject({ ok: true, unit: "deg" });
  if (flipped.ok) expect(flipped.value).toBeCloseTo(540, 9);
});

test("errors short-circuit and name the operand that broke", () => {
  expect(add(T, "30smth", "15deg")).toEqual({
    ok: false,
    code: "unknown-unit",
    input: "30smth",
  });
  expect(add(T, "30deg", "15smth")).toEqual({
    ok: false,
    code: "unknown-unit",
    input: "15smth",
  });
});

test("scale and negate", () => {
  expect(scale(T, "30deg", 3)).toMatchObject({ ok: true, value: 90, unit: "deg" });
  expect(negate(T, "30deg")).toMatchObject({ ok: true, value: -30, unit: "deg" });
});

test("as rebases without changing the quantity", () => {
  const rebased = as(T, "180deg", "rad");
  expect(rebased).toMatchObject({ ok: true, unit: "rad" });
  if (rebased.ok) expect(rebased.value).toBeCloseTo(Math.PI, 12);
});

/**
 * Both of these are exact only because same-unit arithmetic and same-unit
 * rebasing skip the canonical round trip. Through it, `30deg - 15deg` is
 * 14.999999999999998 and `as(30deg, "deg")` is 29.999999999999996 — a ratio
 * that divides out on paper does not divide out in binary floating point.
 */
test("matching units are exact, not merely close", () => {
  expect(add(T, "30deg", "15deg")).toMatchObject({ value: 45 });
  expect(sub(T, "30deg", "15deg")).toMatchObject({ value: 15 });
  expect(add(T, "0.1turn", "0.2turn")).toMatchObject({ value: 0.1 + 0.2 });
  expect(as(T, "30deg", "deg")).toMatchObject({ value: 30, unit: "deg" });
});

test("equals compares across units, with an epsilon", () => {
  expect(equals(T, "180deg", "0.5turn")).toBe(true);
  expect(equals(T, "180deg", "181deg")).toBe(false);
  expect(equals(T, "180deg", "180.0000001deg", 1e-5)).toBe(true);
  expect(equals(T, "180deg", "30smth")).toBe(false);
});

test("compare orders across units and returns undefined on bad input", () => {
  expect(compare(T, "1turn", "180deg")).toBe(1);
  expect(compare(T, "180deg", "1turn")).toBe(-1);
  expect(compare(T, "180deg", "0.5turn")).toBe(0);
  expect(compare(T, "180deg", "30smth")).toBeUndefined();
});

test("format is compact and round-trips through parse in strict mode", () => {
  const a = parse(T, "30.5deg");
  expect(a.ok).toBe(true);
  if (!a.ok) return;
  expect(format(T, a)).toBe("30.5deg");
  expect(parse(T, format(T, a), { mode: "strict" })).toEqual(a);
});

/**
 * `format` emits `raw`, and an op builds its result with `raw: String(value)`
 * rather than carrying an authored one — so the round-trip contract only holds
 * if `String(value)` is itself in the grammar `parse` accepts. It is, including
 * the exponent forms `String` reaches for at the extremes.
 */
test("format of an op result parses in strict mode", () => {
  const results = [
    add(T, "30deg", "15deg"),
    sub(T, "0.5turn", "0.25turn"),
    scale(T, "30deg", -3),
    negate(T, "1e-7rad"),
    scale(T, "1e20rad", 100),
    as(T, "180deg", "rad"),
  ];
  for (const result of results) {
    expect(result.ok).toBe(true);
    if (!result.ok) continue;
    const text = format(T, result);
    const reparsed = parse(T, text, { mode: "strict" });
    expect(reparsed, text).toEqual(result);
  }
});

test("op results are frozen", () => {
  expect(Object.isFrozen(add(T, "30deg", "15deg"))).toBe(true);
  expect(Object.isFrozen(scale(T, "30deg", 2))).toBe(true);
  expect(Object.isFrozen(as(T, "30deg", "rad"))).toBe(true);
  expect(Object.isFrozen(add(T, "30smth", "15deg"))).toBe(true);
});
