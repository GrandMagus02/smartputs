import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { parseNumber } from "../locale/number";
import { defineVocabulary } from "../locale/vocabulary";
import type { Value } from "../types";
import { formatNumber, formatValue } from "./format";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});

const mass = defineKind({
  id: "mass",
  value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
});

const massWords = {
  // No `forms` here on purpose: this fixture exercises the symbol path.
  // Intl.PluralRules("en").select(1.5) is "other", so a `forms.other` entry
  // would make every test below render "1.5 kilograms" instead of "1.5kg".
  // The forms path gets its own fixture (mass2) in the test that needs it.
  kg: { aliases: ["kg"], symbol: "kg" },
  g: { aliases: ["g"], symbol: "g" },
};

const loc = (id: string) =>
  composeLocale(
    defineLanguage({ id, numberFormat: "intl", keywords: {}, selectForm: () => "other" }),
    [defineVocabulary({ locale: id, kind: "mass", units: massWords })],
  );
const en = loc("en");
const de = loc("de");
const registry = buildRegistry([number, mass], [en, de]);
const value = (canonical: string, unit: string): Value =>
  Object.freeze({ kind: "mass", canonical: new Decimal(canonical), unit });

test("formats using the authored unit's symbol", () => {
  expect(formatValue(value("1500", "kg"), registry, en)).toBe("1.5kg");
});

test("uses the plural display form when the number selects it", () => {
  const mass2 = defineKind({
    id: "mass",
    value: { mode: "ratio", canonical: "g", units: { kg: 1000 } },
  });
  // The real English language, not this file's stub: which key is looked up is
  // now `Language.selectForm`'s answer, and a stub that always says "other"
  // would be asserting its own return value rather than plural selection.
  const loc = composeLocale(english, [
    defineVocabulary({
      locale: "en",
      kind: "mass",
      units: {
        kg: { aliases: ["kg"], forms: { one: "kilogram", other: "kilograms" } },
      },
    }),
  ]);
  const r = buildRegistry([number, mass2], [loc]);
  expect(formatValue(value("1000", "kg"), r, loc)).toBe("1 kilogram");
  expect(formatValue(value("3000", "kg"), r, loc)).toBe("3 kilograms");
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
  const custom = composeLocale(
    defineLanguage({
      id: "en",
      numberFormat: { group: " ", decimal: "," },
      keywords: {},
      selectForm: () => "other",
    }),
  );
  expect(formatValue(value("1500500", "kg"), registry, custom)).toBe("1 500,5kg");
});

test("a custom NumberFormatSpec round-trips through parseNumber", () => {
  const custom = composeLocale(
    defineLanguage({
      id: "en",
      numberFormat: { group: " ", decimal: "," },
      keywords: {},
      selectForm: () => "other",
    }),
  );
  const canonical = new Decimal("1500500");
  const formatted = formatValue(value(canonical.toFixed(), "kg"), registry, custom);
  expect(formatted).toBe("1 500,5kg");
  // Strip the unit and feed the digits back: parse(format(v)) === v (spec §10).
  const reparsed = parseNumber(formatted.replace("kg", ""), custom.language);
  expect(reparsed?.times(1000).toFixed()).toBe(canonical.toFixed());
});

test("never emits exponential notation, above or below Decimal's window", () => {
  // Decimal.toString() flips to exponential outside toExpNeg/toExpPos. Such a
  // string is neither grouped nor re-parseable, so the digit path uses toFixed.
  const big = formatValue(value("1e41", "g"), registry, en);
  expect(big).not.toContain("e");
  expect(big).toBe("100,000,000,000,000,000,000,000,000,000,000,000,000,000g");
  expect(parseNumber(big.replace("g", ""), en.language)?.toFixed()).toBe(
    new Decimal("1e41").toFixed(),
  );

  const small = formatValue(value("1e-22", "g"), registry, en);
  expect(small).not.toContain("e");
  expect(small).toBe("0.0000000000000000000001g");
  expect(parseNumber(small.replace("g", ""), en.language)?.toFixed()).toBe(
    new Decimal("1e-22").toFixed(),
  );
});

test("a kind's own format hook wins over the default rendering", () => {
  const shouty = defineKind({
    id: "mass",
    value: { mode: "ratio", canonical: "g", units: { g: 1, kg: 1000 } },
    format: (v) => `<<${v.canonical.toFixed()}>>`,
  });
  const r = buildRegistry([number, shouty], [en]);
  expect(formatValue(value("1500", "kg"), r, en)).toBe("<<1500>>");
});

test("groups a 28-significant-digit value without losing a digit", () => {
  // Guard-digit rounding (see format.ts) rounds the default display to 26
  // significant digits, so exercising the full 28 the grouping regex must
  // handle requires opting back in to the un-rounded precision explicitly.
  const digits = "1234567890123456789012345678";
  const out = formatValue(value(digits, "g"), registry, en, { precision: 28 });
  expect(out).toBe("1,234,567,890,123,456,789,012,345,678g");
  expect(parseNumber(out.replace("g", ""), en.language)?.toFixed()).toBe(digits);
});

test("guard-digit rounding removes one-ulp noise from a round trip", () => {
  const noisy = new Decimal("0.4999999999999999999999999998");
  expect(formatNumber(noisy, en.language)).toBe("0.5");
  expect(formatNumber(new Decimal("799.9999999999999999999999996"), en.language)).toBe(
    "800",
  );
  expect(formatNumber(new Decimal("1.00000000000000000000000001"), en.language)).toBe(
    "1",
  );
});

test("guard-digit rounding leaves an exactly-representable value alone", () => {
  // 21 significant digits, all meaningful: 1 GB expressed in GiB.
  expect(formatNumber(new Decimal("0.931322574615478515625"), en.language)).toBe(
    "0.931322574615478515625",
  );
});

test("precision is configurable per call", () => {
  const pi = new Decimal("3.14159265358979323846264338328");
  expect(formatNumber(pi, en.language, { precision: 5 })).toBe("3.1416");
});

test("grouping still applies after rounding", () => {
  expect(
    formatNumber(new Decimal("1234567.8999999999999999999999999"), en.language),
  ).toBe("1,234,567.9");
});

test("minFractionDigits pads a value with no fraction at all", () => {
  // A Decimal has no notion of a trailing zero — 30 and 30.00 are the same
  // Decimal — so this is the one lever that can produce "30.00" from it.
  expect(formatNumber(new Decimal("30"), en.language, { minFractionDigits: 2 })).toBe(
    "30.00",
  );
});

test("minFractionDigits pads a fraction shorter than requested", () => {
  expect(formatNumber(new Decimal("1.5"), en.language, { minFractionDigits: 2 })).toBe(
    "1.50",
  );
});

test("minFractionDigits leaves a longer fraction alone", () => {
  expect(formatNumber(new Decimal("1.234"), en.language, { minFractionDigits: 2 })).toBe(
    "1.234",
  );
});

test("minFractionDigits pads a negative value without moving the sign", () => {
  expect(formatNumber(new Decimal("-30"), en.language, { minFractionDigits: 2 })).toBe(
    "-30.00",
  );
});

test("minFractionDigits pads after grouping, not instead of it", () => {
  expect(formatNumber(new Decimal("1234"), en.language, { minFractionDigits: 2 })).toBe(
    "1,234.00",
  );
});

test("minFractionDigits of 0 adds no separator", () => {
  expect(formatNumber(new Decimal("5000"), en.language, { minFractionDigits: 0 })).toBe(
    "5,000",
  );
});

test("the language chooses the form key, not Intl", () => {
  const shouty = defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    // Deliberately not a CLDR category: proves the engine indexes whatever key
    // it is handed rather than enumerating categories of its own.
    selectForm: ({ count }) => (count?.eq(1) ? "singular" : "plural"),
  });
  const vocab = defineVocabulary({
    locale: "en",
    kind: "mass",
    units: {
      kg: {
        aliases: ["kg"],
        symbol: "kg",
        forms: { singular: "kilogram", plural: "kilogrammes" },
      },
    },
  });
  const engine = createEngine({
    locales: [composeLocale(shouty, [vocab])],
    kinds: [mass, number],
  });
  expect(engine.evaluate("2 kg").formatted).toBe("2 kilogrammes");
  expect(engine.evaluate("1 kg").formatted).toBe("1 kilogram");
});

test("a unit with no words at all degrades to its key (I10)", () => {
  const bare = composeLocale(english);
  const engine = createEngine({ locales: [bare], kinds: [mass, number] });
  expect(engine.evaluate("2 kg").formatted).toBe("2 kg");
});

test("the slot reaches selectForm", () => {
  const slots: string[] = [];
  const spy = defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    selectForm: ({ slot }) => {
      slots.push(slot);
      return "other";
    },
  });
  const massEn = defineVocabulary({
    locale: "en",
    kind: "mass",
    units: { kg: { aliases: ["kg"], symbol: "kg", forms: { other: "kilograms" } } },
  });
  const engine = createEngine({
    locales: [composeLocale(spy, [massEn])],
    kinds: [mass, number],
  });
  engine.evaluate("2 kg");
  expect(slots).toContain("bare");
});
