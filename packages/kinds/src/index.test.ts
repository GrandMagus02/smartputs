import { expect, test } from "bun:test";
import { buildRegistry, Decimal } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "./index";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");

test("all M1 and M2 built-in kinds are registered", () => {
  expect([...registry.kinds.keys()].sort()).toEqual([
    "angle",
    "area",
    "datasize",
    "duration",
    "length",
    "mass",
    "number",
    "percent",
    "speed",
    "tempdelta",
    "temperature",
    "volume",
  ]);
});

test("m is ambiguous between length and duration", () => {
  expect(registry.aliasIndex.get("m")).toEqual([
    { kind: "duration", unit: "min" },
    { kind: "length", unit: "m" },
  ]);
});

test("canonical ratios are correct", () => {
  const length = registry.kinds.get("length");
  const self = { kind: "length", canonical: new Decimal(0), unit: "km" };
  expect(length?.units.get("km")?.ratio({ self, locale: "en" }).toString()).toBe("1000");
});

test("imperial length units are present", () => {
  for (const unit of ["in", "ft", "yd", "mi"]) {
    expect(registry.kinds.get("length")?.units.has(unit)).toBe(true);
  }
});

test("imperial mass units are present", () => {
  for (const unit of ["oz", "lb"]) {
    expect(registry.kinds.get("mass")?.units.has(unit)).toBe(true);
  }
});

test("duration covers ms through weeks", () => {
  for (const unit of ["ms", "s", "min", "h", "d", "wk"]) {
    expect(registry.kinds.get("duration")?.units.has(unit)).toBe(true);
  }
});

test("the English locale declares conversion keywords", () => {
  expect(en.keywords.in).toContain("in");
  expect(en.keywords.in).toContain("to");
  expect(en.keywords.in).toContain("as");
});

test("the English analyzer chain strips regular plurals", () => {
  expect(registry.aliasIndex.has("kilogram")).toBe(true);
});
