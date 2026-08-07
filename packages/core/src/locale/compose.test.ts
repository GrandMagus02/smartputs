import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { LocaleMismatchError, VocabularyConflictError } from "../errors";
import { composeLocale } from "./compose";
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
