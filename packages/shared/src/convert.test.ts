import { expect, test } from "bun:test";
import { convert, fromCanonical, toCanonical } from "./convert";
import type { UnitTable } from "./types";

const ANGLE: UnitTable<"rad" | "deg" | "turn"> = {
  canonical: "rad",
  ratio: {
    rad: "1",
    deg: "0.0174532925199432957692369076848",
    turn: "6.28318530717958647692528676656",
  },
  alias: { rad: "rad", deg: "deg", turn: "turn" },
};

const TEMP: UnitTable<"c" | "f" | "k"> = {
  canonical: "c",
  ratio: { c: "1", f: "0.55555555555555555556", k: "1" },
  offset: { f: "-32", k: "-273.15" },
  alias: { c: "c", f: "f", k: "k" },
};

const MEASURE: UnitTable<"inch" | "mm" | "px"> = {
  canonical: "inch",
  ratio: {
    inch: "1",
    mm: "0.03937007874015748031496062992126",
    px: (ctx) => 1 / (ctx.dpi ?? 96),
  },
  alias: { inch: "inch", mm: "mm", px: "px" },
};

test("ratio conversion round-trips", () => {
  expect(convert(ANGLE, "180deg", "rad")).toBeCloseTo(Math.PI, 12);
  expect(convert(ANGLE, "0.25turn", "deg")).toBeCloseTo(90, 12);
  expect(convert(ANGLE, "1rad", "rad")).toBe(1);
});

test("affine conversion applies offsets in the right order", () => {
  expect(convert(TEMP, "212f", "c")).toBeCloseTo(100, 9);
  expect(convert(TEMP, "0c", "k")).toBeCloseTo(273.15, 9);
  expect(convert(TEMP, "300k", "c")).toBeCloseTo(26.85, 9);
  expect(convert(TEMP, "100c", "f")).toBeCloseTo(212, 9);
});

test("a dynamic ratio reads dpi off the context", () => {
  expect(convert(MEASURE, "96px", "inch", { ctx: { dpi: 96 } })).toBeCloseTo(1, 12);
  expect(convert(MEASURE, "144px", "inch", { ctx: { dpi: 144 } })).toBeCloseTo(1, 12);
  // No ctx supplied: 96 dpi is assumed, matching the kind's DEFAULT_DPI.
  expect(convert(MEASURE, "96px", "inch")).toBeCloseTo(1, 12);
});

test("convert returns undefined on bad input rather than a sentinel number", () => {
  expect(convert(ANGLE, "30smth", "rad")).toBeUndefined();
});

test("converting a unit to itself is exact for any dpi", () => {
  // 30 * ratio / ratio is 29.999999999999996 in binary floating point.
  expect(convert(ANGLE, "30deg", "deg")).toBe(30);
  expect(convert(TEMP, "37.5f", "f")).toBe(37.5);
  expect(convert(MEASURE, "13px", "px", { ctx: { dpi: 110 } })).toBe(13);
});

/**
 * One table at a time, through a generic helper. Iterating `[ANGLE, TEMP]`
 * directly hands `toCanonical` a *union* of `UnitTable`s, and TypeScript then
 * infers `U` as the union of both unit sets — which neither table satisfies.
 */
function expectInverses<U extends string>(table: UnitTable<U>): void {
  for (const unit of Object.keys(table.ratio) as U[]) {
    const canonical = toCanonical(table, 7, unit);
    expect(fromCanonical(table, canonical, unit), unit).toBeCloseTo(7, 9);
  }
}

test("toCanonical and fromCanonical are inverses for every unit", () => {
  expectInverses(ANGLE);
  expectInverses(TEMP);
  expectInverses(MEASURE);
});
