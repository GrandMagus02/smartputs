import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import type { Value } from "../types";
import { formatValue } from "./format";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});

const mass = defineKind({
  id: "mass",
  value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
  lexicon: {
    // No `display` here on purpose: this fixture exercises the symbol path.
    // Intl.PluralRules("en").select(1.5) is "other", so a display.other entry
    // would make every test below render "1.5 kilograms" instead of "1.5kg".
    // The display path gets its own fixture (mass2) in the test that needs it.
    kg: { aliases: ["kg"], symbol: "kg" },
    g: { aliases: ["g"], symbol: "g" },
  },
});

const registry = buildRegistry([number, mass]);
const value = (canonical: string, unit: string): Value =>
  Object.freeze({ kind: "mass", canonical: new Decimal(canonical), unit });

test("formats using the authored unit's symbol", () => {
  expect(formatValue(value("1500", "kg"), registry, "en")).toBe("1.5kg");
});

test("uses the plural display form when the number selects it", () => {
  const mass2 = defineKind({
    id: "mass",
    value: { mode: "ratio", canonical: "g", units: { kg: 1000 } },
    lexicon: {
      kg: { aliases: ["kg"], display: { one: "kilogram", other: "kilograms" } },
    },
  });
  const r = buildRegistry([number, mass2]);
  expect(formatValue(value("1000", "kg"), r, "en")).toBe("1 kilogram");
  expect(formatValue(value("3000", "kg"), r, "en")).toBe("3 kilograms");
});

test("falls back to the symbol when no display form covers the category", () => {
  // Grouped: en renders 3000 as "3,000".
  expect(formatValue(value("3000", "g"), registry, "en")).toBe("3,000g");
});

test("formats a plain number without a unit", () => {
  const v: Value = Object.freeze({
    kind: "number",
    canonical: new Decimal("9"),
    unit: "one",
  });
  expect(formatValue(v, registry, "en")).toBe("9");
});

test("uses the locale's number grammar", () => {
  expect(formatValue(value("1500500", "kg"), registry, "de")).toBe("1.500,5kg");
});

test("does not print floating point noise", () => {
  expect(formatValue(value("100", "kg"), registry, "en")).toBe("0.1kg");
});
