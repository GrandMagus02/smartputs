import { expect, test } from "bun:test";
import { defineLocale } from "./define";
import { numberSymbols, parseNumber } from "./number";

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: {} });
const de = defineLocale({ id: "de", numberFormat: "intl", keywords: {} });

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
  const custom = defineLocale({
    id: "xx",
    numberFormat: { group: " ", decimal: "," },
    keywords: {},
  });
  expect(parseNumber("1 500,25", custom)?.toString()).toBe("1500.25");
});

test("returns null for non-numeric text", () => {
  expect(parseNumber("kg", en)).toBeNull();
});
