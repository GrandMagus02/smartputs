import { expect, test } from "bun:test";
import { createAnalyzerChain } from "./analyze";
import { defineLanguage, defineLocalePack } from "./define";
import { identity, suffixStripper, tableAnalyzer } from "./helpers";

const uk = defineLanguage({
  id: "uk",
  numberFormat: "intl",
  analyze: [identity(), suffixStripper({ suffixes: ["ів"], minStem: 3, weight: -2 })],
  keywords: { in: ["в"] },
  selectForm: () => "other",
});

test("the chain returns every analyzer's forms, exact match first", () => {
  const analyze = createAnalyzerChain(uk, []);
  expect(analyze("кілограмів")).toEqual([
    { form: "кілограмів", weight: 0 },
    { form: "кілограм", weight: -2 },
  ]);
});

test("duplicate forms keep the highest weight only", () => {
  const locale = defineLanguage({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), tableAnalyzer({ кг: "кг" }, -5)],
    keywords: {},
    selectForm: () => "other",
  });
  expect(createAnalyzerChain(locale, [])("кг")).toEqual([{ form: "кг", weight: 0 }]);
});

test("pack analyzers are appended to the locale chain", () => {
  const pack = defineLocalePack({
    locale: "uk",
    contributes: {},
    analyze: [tableAnalyzer({ бит: "біткоїн" }, -1)],
  });
  expect(createAnalyzerChain(uk, [pack])("бит")).toEqual([
    { form: "бит", weight: 0 },
    { form: "біткоїн", weight: -1 },
  ]);
});

test("packs for another locale do not contribute analyzers", () => {
  const pack = defineLocalePack({
    locale: "de",
    contributes: {},
    analyze: [tableAnalyzer({ бит: "біткоїн" }, -1)],
  });
  expect(createAnalyzerChain(uk, [pack])("бит")).toEqual([{ form: "бит", weight: 0 }]);
});

test("results are memoized: the same surface is analyzed once", () => {
  let calls = 0;
  const counting = defineLanguage({
    id: "uk",
    numberFormat: "intl",
    analyze: [
      (s) => {
        calls += 1;
        return [{ form: s, weight: 0 }];
      },
    ],
    keywords: {},
    selectForm: () => "other",
  });
  const analyze = createAnalyzerChain(counting, []);
  analyze("кг");
  analyze("кг");
  expect(calls).toBe(1);
});

test("a locale with no analyzers still returns the surface form", () => {
  const bare = defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    selectForm: () => "other",
  });
  expect(createAnalyzerChain(bare, [])("kg")).toEqual([{ form: "kg", weight: 0 }]);
});
