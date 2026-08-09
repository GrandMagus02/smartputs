import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import {
  KeywordConflictError,
  LocaleMismatchError,
  VocabularyConflictError,
} from "../errors";
import { buildKeywords, composeLocale } from "./compose";
import { defineLanguage } from "./define";
import { defineVocabulary } from "./vocabulary";

const english = defineLanguage({
  id: "en",
  numberFormat: "intl",
  keywords: { in: ["in", "to", "as"] },
  selectForm: ({ count }) =>
    count === undefined ? "other" : new Intl.PluralRules("en").select(count.toNumber()),
});

const massEn = defineVocabulary({
  locale: "en",
  kind: "mass",
  units: {
    kg: {
      aliases: ["kg", "kilogram"],
      symbol: "kg",
      forms: { one: "kilogram", other: "kilograms" },
    },
  },
});

describe("composeLocale", () => {
  test("carries the language's id and the vocabularies given", () => {
    const en = composeLocale(english, [massEn]);
    expect(en.id).toBe("en");
    expect(en.language).toBe(english);
    expect(en.vocabularies).toEqual([massEn]);
  });

  test("a vocabulary for another language is a wiring error", () => {
    const massUk = defineVocabulary({ locale: "uk", kind: "mass", units: {} });
    expect(() => composeLocale(english, [massUk])).toThrow(LocaleMismatchError);
  });

  test("two vocabularies for one kind name both", () => {
    const other = defineVocabulary({ locale: "en", kind: "mass", units: {} });
    expect(() => composeLocale(english, [massEn, other])).toThrow(
      VocabularyConflictError,
    );
  });

  test("composes with no vocabularies at all", () => {
    expect(composeLocale(english).vocabularies).toEqual([]);
  });

  test("the composed locale is frozen", () => {
    const en = composeLocale(english, [massEn]);
    expect(Object.isFrozen(en)).toBe(true);
    expect(Object.isFrozen(en.vocabularies)).toBe(true);
  });

  test("selectForm answers with the CLDR generic category when there is no count", () => {
    expect(
      english.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
    expect(
      english.selectForm({
        count: new Decimal(1),
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("one");
  });
});

/**
 * The en/uk pair cannot exercise any of this: measured over both keyword
 * tables there are 22 distinct folded surfaces and **zero** collisions — the
 * two are Latin and Cyrillic throughout. So these languages are invented on
 * purpose, and they are the only honest way to reach the conflict branch.
 */
const a = defineLanguage({
  id: "aa",
  numberFormat: "intl",
  keywords: { in: ["do", "IN"] },
  selectForm: () => "other",
});

describe("buildKeywords", () => {
  test("folds every installed language's keywords into one map", () => {
    const b = defineLanguage({
      id: "ab",
      numberFormat: "intl",
      keywords: { of: ["od"], in: ["u"] },
      selectForm: () => "other",
    });
    const map = buildKeywords([composeLocale(a), composeLocale(b)]);
    expect(map.get("do")).toBe("in");
    expect(map.get("u")).toBe("in");
    expect(map.get("od")).toBe("of");
    // Folded on the way in, so the lexer's own fold is all the lookup needs.
    expect(map.get("in")).toBe("in");
  });

  test("a surface meaning two different keywords across languages is a wiring error", () => {
    const b = defineLanguage({
      id: "ab",
      numberFormat: "intl",
      keywords: { of: ["do"] },
      selectForm: () => "other",
    });
    expect(() => buildKeywords([composeLocale(a), composeLocale(b)])).toThrow(
      KeywordConflictError,
    );
  });

  test("the conflict names both keywords and both locales", () => {
    const b = defineLanguage({
      id: "ab",
      numberFormat: "intl",
      keywords: { of: ["do"] },
      selectForm: () => "other",
    });
    // An error a reader cannot act on is a worse failure than the collision:
    // fixing this needs all four facts, so all four are in the message.
    let thrown: KeywordConflictError | undefined;
    try {
      buildKeywords([composeLocale(a), composeLocale(b)]);
    } catch (e) {
      thrown = e as KeywordConflictError;
    }
    expect(thrown).toBeInstanceOf(KeywordConflictError);
    expect(thrown?.surface).toBe("do");
    expect(thrown?.keywords).toEqual(["in", "of"]);
    expect(thrown?.locales).toEqual(["aa", "ab"]);
    for (const fragment of ["do", "in", "of", "aa", "ab"]) {
      expect(thrown?.message).toContain(fragment);
    }
  });

  test("the same keyword in several languages is fine and common", () => {
    const one = defineLanguage({
      id: "qa",
      numberFormat: "intl",
      keywords: { in: ["in"] },
      selectForm: () => "other",
    });
    const two = defineLanguage({
      id: "qb",
      numberFormat: "intl",
      keywords: { in: ["in", "u"] },
      selectForm: () => "other",
    });
    const map = buildKeywords([composeLocale(one), composeLocale(two)]);
    expect(map.get("in")).toBe("in");
    expect(map.get("u")).toBe("in");
  });

  test("one language's own table is folded the same way", () => {
    expect(buildKeywords([composeLocale(english)]).get("as")).toBe("in");
  });
});
