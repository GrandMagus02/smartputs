import { expect, test } from "bun:test";
import { defineLanguage } from "./define";
import { numberSymbols, parseNumber } from "./number";

const en = defineLanguage({
  id: "en",
  numberFormat: "intl",
  keywords: {},
  selectForm: () => "other",
});
const de = defineLanguage({
  id: "de",
  numberFormat: "intl",
  keywords: {},
  selectForm: () => "other",
});

test("discovers group and decimal symbols from Intl", () => {
  expect(numberSymbols(en)).toEqual({ group: ",", decimal: "." });
  expect(numberSymbols(de)).toEqual({ group: ".", decimal: "," });
});

test("parses grouped numbers per locale", () => {
  expect(parseNumber("1,500.25", en)?.toString()).toBe("1500.25");
  expect(parseNumber("1.500,25", de)?.toString()).toBe("1500.25");
});

test("parses a bare integer and decimal", () => {
  expect(parseNumber("42", en)?.toString()).toBe("42");
  expect(parseNumber("0.5", en)?.toString()).toBe("0.5");
});

test("an explicit NumberFormatSpec overrides Intl", () => {
  const custom = defineLanguage({
    id: "xx",
    numberFormat: { group: " ", decimal: "," },
    keywords: {},
    selectForm: () => "other",
  });
  expect(parseNumber("1 500,25", custom)?.toString()).toBe("1500.25");
});

test("strips non-breaking and narrow no-break spaces", () => {
  // Written as escapes on purpose: these characters are invisible in source.
  // U+00A0 arrives via pasted text; U+202F is French ICU's group separator.
  expect(parseNumber("1\u00A0500.25", en)?.toString()).toBe("1500.25");
  expect(parseNumber("1\u202F500.25", en)?.toString()).toBe("1500.25");
});

test("a space-like separator also accepts the plain space it folds to", () => {
  // `normalize()` collapses every whitespace run before `lex()` runs, so a
  // language that groups with U+00A0 — Ukrainian — is handed its own printed
  // "2\u00A0000" back as "2 000". Reading that is what makes its output
  // round-trip.
  const uk = defineLanguage({
    id: "uk",
    numberFormat: { group: "\u00A0", decimal: "," },
    keywords: {},
    selectForm: () => "other",
  });
  expect(parseNumber("2\u00A0000", uk)?.toString()).toBe("2000");
  expect(parseNumber("2 000", uk)?.toString()).toBe("2000");
  expect(parseNumber("1 234 567,5", uk)?.toString()).toBe("1234567.5");
  // Gated on the separator, not unconditional: in `en` a space inside a number
  // is a word boundary and must stay unparseable, or `lex` would have no reason
  // to split "1 500 kg" into two numbers and a word.
  expect(parseNumber("1 500", en)).toBeNull();
});

test("returns null for non-numeric text", () => {
  expect(parseNumber("kg", en)).toBeNull();
});
