import { expect, test } from "bun:test";
import { UnitParseError } from "../errors";
import { buildRegistry } from "../kind/registry";
import { BUILTIN_KINDS } from "../kinds/index";
import en from "../locale/en";
import { createFacade } from "./quantity";

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const massKind = registry.kinds.get("mass");
if (massKind === undefined) throw new Error("mass kind missing");
const Weight = createFacade({ kind: massKind, registry, locale: en });

test("constructs in an authored unit and stores it verbatim", () => {
  const w = new Weight(1.5, "kg");
  expect(w.value.toString()).toBe("1.5");
  expect(w.unit).toBe("kg");
});

test("converts to another unit", () => {
  expect(new Weight(1, "kg").to("g").toString()).toBe("1000");
});

test("as rebases on a unit without changing the quantity", () => {
  const rebased = new Weight(1, "kg").as("g");
  expect(rebased.unit).toBe("g");
  expect(rebased.value.toString()).toBe("1000");
});

test("parse accepts a number-unit string", () => {
  expect(Weight.parse("12.5lb").to("g").toString()).toBe("5669.904625");
});

test("parse rejects a bare number", () => {
  expect(() => Weight.parse("12.5")).toThrow(UnitParseError);
});

test("from passes an instance through unchanged", () => {
  const w = new Weight(1, "kg");
  expect(Weight.from(w)).toBe(w);
});

test("from treats a bare number as the canonical unit", () => {
  expect(Weight.from(500).unit).toBe("g");
});

test("equals compares canonical values across units", () => {
  expect(new Weight(1, "kg").equals(new Weight(1000, "g"))).toBe(true);
  expect(new Weight(1, "kg").equals(new Weight(999, "g"))).toBe(false);
  expect(new Weight(1, "kg").equals(new Weight(999, "g"), 2)).toBe(true);
});

test("toString renders in the authored unit", () => {
  expect(new Weight(1.5, "kg").toString()).toBe("1.5 kilograms");
  expect(new Weight(210, "g").toString()).toBe("210g");
});

test("toJSON round-trips through from", () => {
  const w = new Weight(1.5, "kg");
  expect(w.toJSON()).toEqual({ value: "1.5", unit: "kg" });
});

test("instances are frozen", () => {
  expect(Object.isFrozen(new Weight(1, "kg"))).toBe(true);
});

test("an unknown unit throws", () => {
  expect(() => new Weight(1, "furlong")).toThrow(UnitParseError);
});
