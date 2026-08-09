import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { Slot } from "../types";
import { numberSymbols } from "./number";
import { ukrainian } from "./uk";

const form = (n: number, slot: Slot = "bare") =>
  ukrainian.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

describe("ukrainian", () => {
  test("keys are case x plural category", () => {
    expect(ukrainian.id).toBe("uk");
    expect(form(1)).toBe("nom-one");
    expect(form(2)).toBe("nom-few");
    expect(form(5)).toBe("nom-many");
    expect(form(2000)).toBe("nom-many");
    // 21 and 22 are the pair that proves the category is not "look at the last
    // digit of a small number": 21 agrees like 1, 22 like 2.
    expect(form(21)).toBe("nom-one");
    expect(form(22)).toBe("nom-few");
    // Fractional. "other" here is genitive *singular* — "1,5 кілограма" — not a
    // plural, which is the row a vocabulary is likeliest to get wrong.
    expect(form(1.5)).toBe("nom-other");
    expect(form(5, "conversion-target")).toBe("loc-many");
  });

  test("a count-free conversion target still names a key", () => {
    // The row the one-dimensional `display` model could not express: no count
    // to select a number by, and a case the slot alone decides.
    expect(
      ukrainian.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("loc-other");
  });

  test("reads cardinals, in both apostrophe spellings", () => {
    expect(ukrainian.numerals?.(["двадцять", "два"])).toEqual({
      value: new Decimal(22),
      consumed: 2,
    });
    // U+2019 and ASCII "'" — the same word, and no way to know which one a
    // keyboard produced.
    expect(ukrainian.numerals?.(["п’ять"])).toEqual({
      value: new Decimal(5),
      consumed: 1,
    });
    expect(ukrainian.numerals?.(["п'ять"])).toEqual({
      value: new Decimal(5),
      consumed: 1,
    });
    // Feminine agreement and an inflected scale word, which is how a Ukrainian
    // sentence writes 2000. Both are extra keys on the same values.
    expect(ukrainian.numerals?.(["дві", "тисячі"])).toEqual({
      value: new Decimal(2000),
      consumed: 2,
    });
    // A numeral connector is skipped, never claimed on its own.
    expect(ukrainian.numerals?.(["сто", "і", "п’ять"])).toEqual({
      value: new Decimal(105),
      consumed: 3,
    });
  });

  test("spells back through the same table", () => {
    expect(ukrainian.spell?.(new Decimal(22))).toBe("двадцять два");
    expect(ukrainian.spell?.(new Decimal(0))).toBe("нуль");
    // Known limitation, asserted as a shape rather than a string: the shared
    // `cardinalSpeller` has no inflection machinery, so a scale word gets no
    // agreement — 2000 comes back with the masculine "два" where Ukrainian
    // wants the feminine "дві тисячі". The scale word itself is whichever of
    // the equal-valued тисяча/тисячі/тисяч keys the speller's descending sort
    // reaches first, so this deliberately does not pin it; see
    // `uk-cardinals.ts`. Reading is unaffected — all three forms parse.
    expect(ukrainian.spell?.(new Decimal(2000))).toMatch(/^два тисяч/);
  });

  test("claims the conversion keyword", () => {
    expect(ukrainian.keywords.in).toContain("в");
  });

  test("takes its number symbols from CLDR", () => {
    // An escape, not a literal: U+00A0 is invisible in source and degrades to a
    // plain space the moment anyone retypes the line, which is the same point
    // `parseNumber` makes about the same character.
    expect(numberSymbols(ukrainian)).toEqual({ group: "\u00A0", decimal: "," });
  });
});
