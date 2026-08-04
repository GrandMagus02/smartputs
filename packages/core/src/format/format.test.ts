import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { parseNumber } from "../locale/number";
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
const loc = (id: string) => defineLocale({ id, numberFormat: "intl", keywords: {} });
const en = loc("en");
const de = loc("de");
const value = (canonical: string, unit: string): Value =>
  Object.freeze({ kind: "mass", canonical: new Decimal(canonical), unit });

test("formats using the authored unit's symbol", () => {
  expect(formatValue(value("1500", "kg"), registry, en)).toBe("1.5kg");
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
  expect(formatValue(value("1000", "kg"), r, en)).toBe("1 kilogram");
  expect(formatValue(value("3000", "kg"), r, en)).toBe("3 kilograms");
});

test("falls back to the symbol when no display form covers the category", () => {
  // Grouped: en renders 3000 as "3,000".
  expect(formatValue(value("3000", "g"), registry, en)).toBe("3,000g");
});

test("formats a plain number without a unit", () => {
  const v: Value = Object.freeze({
    kind: "number",
    canonical: new Decimal("9"),
    unit: "one",
  });
  expect(formatValue(v, registry, en)).toBe("9");
});

test("uses the locale's number grammar", () => {
  expect(formatValue(value("1500500", "kg"), registry, de)).toBe("1.500,5kg");
});

test("does not print floating point noise", () => {
  expect(formatValue(value("100", "kg"), registry, en)).toBe("0.1kg");
});

test("honours a locale's own NumberFormatSpec instead of re-deriving from Intl", () => {
  // "en" resolves through Intl to "," / "." — this locale overrides both, and
  // the formatter must follow the spec, not the tag.
  const custom = defineLocale({
    id: "en",
    numberFormat: { group: " ", decimal: "," },
    keywords: {},
  });
  expect(formatValue(value("1500500", "kg"), registry, custom)).toBe("1 500,5kg");
});

test("a custom NumberFormatSpec round-trips through parseNumber", () => {
  const custom = defineLocale({
    id: "en",
    numberFormat: { group: " ", decimal: "," },
    keywords: {},
  });
  const canonical = new Decimal("1500500");
  const formatted = formatValue(value(canonical.toFixed(), "kg"), registry, custom);
  expect(formatted).toBe("1 500,5kg");
  // Strip the unit and feed the digits back: parse(format(v)) === v (spec §10).
  const reparsed = parseNumber(formatted.replace("kg", ""), custom);
  expect(reparsed?.times(1000).toFixed()).toBe(canonical.toFixed());
});

test("never emits exponential notation, above or below Decimal's window", () => {
  // Decimal.toString() flips to exponential outside toExpNeg/toExpPos. Such a
  // string is neither grouped nor re-parseable, so the digit path uses toFixed.
  const big = formatValue(value("1e41", "g"), registry, en);
  expect(big).not.toContain("e");
  expect(big).toBe("100,000,000,000,000,000,000,000,000,000,000,000,000,000g");
  expect(parseNumber(big.replace("g", ""), en)?.toFixed()).toBe(
    new Decimal("1e41").toFixed(),
  );

  const small = formatValue(value("1e-22", "g"), registry, en);
  expect(small).not.toContain("e");
  expect(small).toBe("0.0000000000000000000001g");
  expect(parseNumber(small.replace("g", ""), en)?.toFixed()).toBe(
    new Decimal("1e-22").toFixed(),
  );
});

test("a kind's own format hook wins over the default rendering", () => {
  const shouty = defineKind({
    id: "mass",
    value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
    format: (v) => `<<${v.canonical.toFixed()}>>`,
  });
  const r = buildRegistry([number, shouty]);
  expect(formatValue(value("1500", "kg"), r, en)).toBe("<<1500>>");
});

test("groups a 28-significant-digit value without losing a digit", () => {
  const digits = "1234567890123456789012345678";
  const out = formatValue(value(digits, "g"), registry, en);
  expect(out).toBe("1,234,567,890,123,456,789,012,345,678g");
  expect(parseNumber(out.replace("g", ""), en)?.toFixed()).toBe(digits);
});
