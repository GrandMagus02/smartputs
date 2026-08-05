import { expect, test } from "bun:test";
import { defineLocale } from "../locale/define";
import enLocale from "../locale/en";
import { leadingCount, trailingFragment } from "./fragment";

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: {} });

test("extracts the trailing word fragment with its span", () => {
  expect(trailingFragment("30 ho")).toEqual({ text: "ho", span: { start: 3, end: 5 } });
  expect(trailingFragment("10 kg + 5 gr")).toEqual({
    text: "gr",
    span: { start: 10, end: 12 },
  });
  expect(trailingFragment("ho")).toEqual({ text: "ho", span: { start: 0, end: 2 } });
});

test("a fragment may contain digits after its first letter", () => {
  // M2 ships m2, cm2 and km2. A letters-only rule would return null here and
  // silently make every area unit uncompletable.
  expect(trailingFragment("10 m2")).toEqual({ text: "m2", span: { start: 3, end: 5 } });
});

test("a fragment must begin with a letter", () => {
  expect(trailingFragment("30")).toBeNull();
  expect(trailingFragment("10.5")).toBeNull();
  expect(trailingFragment("")).toBeNull();
});

test("no fragment when the input does not end in one", () => {
  expect(trailingFragment("10 kg + ")).toBeNull();
  expect(trailingFragment("10 kg +")).toBeNull();
  expect(trailingFragment("(1 + 2)")).toBeNull();
});

test("a fragment attached to its number still splits correctly", () => {
  expect(trailingFragment("2km")).toEqual({ text: "km", span: { start: 1, end: 3 } });
});

test("reads the count that precedes the fragment", () => {
  expect(leadingCount("30 ho", 3, en)?.toString()).toBe("30");
  expect(leadingCount("1.5 ho", 4, en)?.toString()).toBe("1.5");
  expect(leadingCount("1,500 ho", 6, en)?.toString()).toBe("1500");
  expect(leadingCount("2km", 1, en)?.toString()).toBe("2");
});

test("reads the nearest count in an expression, not the first", () => {
  expect(leadingCount("10 kg + 5 gr", 10, en)?.toString()).toBe("5");
});

test("a minus separated by a space is an operator, not a sign", () => {
  // "10 kg - 5 mil": the run before the fragment is " - 5 ". Parsing that whole
  // run yields null, so the last whitespace-delimited token wins.
  expect(leadingCount("10 kg - 5 mil", 10, en)?.toString()).toBe("5");
});

test("a minus attached to its digits is a sign", () => {
  expect(leadingCount("-5 km", 3, en)?.toString()).toBe("-5");
});

test("returns null when there is no count", () => {
  expect(leadingCount("ho", 0, en)).toBeNull();
  expect(leadingCount("kg + gr", 5, en)).toBeNull();
});

test("honours a locale whose group separator is a space", () => {
  const fr = defineLocale({
    id: "fr",
    numberFormat: { group: " ", decimal: "," },
    keywords: {},
  });
  expect(leadingCount("1 500,5 ho", 8, fr)?.toString()).toBe("1500.5");
});

const count = (input: string, upto: number) => {
  const d = leadingCount(input, upto, enLocale);
  return d === null ? null : d.toString();
};

test("leadingCount still reads digits", () => {
  expect(count("20 k", 3)).toBe("20");
});

test("leadingCount still strips a binary operator's minus", () => {
  expect(count("10 kg - 5 mil", 10)).toBe("5");
});

test("leadingCount reads a single spelled count", () => {
  expect(count("twenty k", 7)).toBe("20");
});

test("leadingCount reads a hyphenated spelled count", () => {
  expect(count("twenty-two k", 11)).toBe("22");
});

test("leadingCount reads a multi-word spelled count after other text", () => {
  expect(count("5 kg + one thousand thirty two k", 31)).toBe("1032");
});

test("leadingCount ignores words that are not a count", () => {
  expect(count("kg + mil", 6)).toBeNull();
});

test("a locale without numerals still reads digits and nothing else", () => {
  // The file's bare `en` stub declares no `numerals`, so the spelled branch
  // must degrade to null rather than throw.
  expect(leadingCount("20 k", 3, en)?.toString()).toBe("20");
  expect(leadingCount("twenty k", 7, en)).toBeNull();
});
