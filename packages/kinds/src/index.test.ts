import { expect, test } from "bun:test";
import { buildRegistry, composeLocale, Decimal } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";

// The words half is installed, not bridged: a kind that has moved to
// `locale/en` carries no `lexicon` for the registry to fall back on, so an
// alias assertion below would be asserting the absence of a table rather than
// the presence of a word.
const registry = buildRegistry(BUILTIN_KINDS, [composeLocale(en, BUILTIN_EN)]);

test("all M1 and M2 built-in kinds are registered", () => {
  expect([...registry.kinds.keys()].sort()).toEqual([
    "angle",
    "area",
    "boolean",
    "datarate",
    "datasize",
    "duration",
    "energy",
    "length",
    "mass",
    "number",
    "percent",
    "power",
    "speed",
    "tempdelta",
    "temperature",
    "tempo",
    "volume",
  ]);
});

test("m is ambiguous between length and duration", () => {
  expect(registry.aliasIndex.get("m")).toEqual([
    { kind: "duration", unit: "min", locale: "en" },
    { kind: "length", unit: "m", locale: "en" },
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
