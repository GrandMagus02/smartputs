import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthNl from "./nl";

const engine = () =>
  createEngine({
    locales: [composeLocale(dutch, [lengthNl])],
    kinds: [length],
  });

/** The two keys `dutch.selectForm` can produce, sorted. */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "length",
    unit,
    slot,
  });
  return (lengthNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Dutch word", () => {
    // Only the nouns, and there is no second sweep to back them up: Dutch is
    // written in plain ASCII, so the umlaut-and-`ß` check that catches a stray
    // German word in `de.test.ts` has no Dutch equivalent. Naming the words is
    // the whole check here.
    expect(JSON.stringify(length)).not.toMatch(/meter|duim|voet|yard|mijl/i);
  });

  // `in` is a Dutch conversion keyword too — `dutch.keywords.in` is in/naar —
  // so `lex` emits it as a keyword token here exactly as it does in English,
  // and the alias would be unreachable on the engine path even before the
  // cross-language `isUnitAlias` argument applies. See the vocabulary's own
  // comment.
  test("`in` is left to the conversion keyword here too", () => {
    for (const words of Object.values(lengthNl.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthNl.units.in?.aliases).toContain("duim");
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows two is all `dutch.selectForm` can ever ask for. The
    // slot loop is the load-bearing half here — Dutch reads `slot` and discards
    // it, so a language that had grown a case axis (German's, which needs four
    // keys for this same kind) would show up as a third key (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          dutch.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(lengthNl.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs. Dutch
    // capitalises no noun, so the table prints `meter` and the alias index holds
    // `meter` — the two halves of this file are the same strings, and asserting
    // that is the point rather than an oversight.
    for (const [unit, words] of Object.entries(lengthNl.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(dutch, [lengthNl]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so `Intl.PluralRules("nl")` answers
    // from the integer side alone and the fractional reading of `other` is never
    // reached. 1.5 is what makes the contract sample it — and in Dutch that row
    // holds the same invariant noun as every other count ("1,5 meter"), where
    // German's is a plural on the feminine `Meile` and Ukrainian's is a genitive
    // singular.
    expect(() =>
      assertLocaleContract(composeLocale(dutch, [lengthNl]), [length], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("no length noun moves on the number axis", () => {
    // The Dutch measure rule: a unit of length stays singular after a numeral,
    // "tien meter" and "vijf mijl". Both rows of every table are therefore one
    // word. `@smartput/length/locale/de` gives the opposite answer on the last
    // of these — `die Meile` is feminine and does take `Meilen` — which is the
    // one unit where the two languages disagree about the same measure.
    for (const unit of ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2));
      expect(word(unit, 1), unit).toBe(word(unit, 1.5));
    }
    expect(word("m", 10)).toBe("meter");
    expect(word("km", 5)).toBe("kilometer");
    expect(word("mi", 5)).toBe("mijl");
    expect(word("ft", 6)).toBe("voet");
    expect(word("in", 12)).toBe("inch");
  });

  test("a conversion target is spelled like a bare quantity", () => {
    // The substantive difference from German. `in` and `naar` govern nothing in
    // Dutch, so the count-free target (ruling R5 sends it to `other`) is the
    // bare noun — "in meter", not the dative "in Metern" that `de.ts` needs a
    // second axis to hold.
    for (const unit of ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"]) {
      expect(word(unit, undefined, "conversion-target"), unit).toBe(word(unit, 1));
    }
    expect(word("m", undefined, "conversion-target")).toBe("meter");
    expect(word("cm", undefined, "conversion-target")).toBe("centimeter");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // The whole reason the compounds are listed. `compoundSplitter` finds
    // `meter` inside `centimeter` at -3; the alias is weight 0, and the
    // centimetre wins. Flip that ordering and this answers ten metres.
    const e = engine();
    expect(e.evaluate("10 centimeter").value.unit).toBe("cm");
    expect(e.evaluate("10 kilometer").value.unit).toBe("km");
    // And the compound no vocabulary would ever list, which is what the split is
    // for: a bandmeter is a measuring tape, and it is a metre by its head.
    expect(e.evaluate("10 bandmeter").value.unit).toBe("m");
  });

  test("an engine built from it reads and writes Dutch length", () => {
    const e = engine();
    // The invariant measure noun, on both sides of the CLDR boundary.
    expect(e.evaluate("1 meter").formatted).toBe("1 meter");
    expect(e.evaluate("7 meter").formatted).toBe("7 meter");
    // The free-noun plural a reader may type, answered with the measure form.
    expect(e.evaluate("5 mijlen").formatted).toBe("5 mijl");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun does not move.
    expect(e.evaluate("1 km + 500 m").formatted).toBe("1,5 kilometer");
    // Conversions written with both Dutch keywords, which is `dutch.keywords`'
    // doing and not this file's.
    expect(e.evaluate("3 voet in duim").formatted).toBe("36 inch");
    expect(e.evaluate("1 mijl naar kilometer").formatted).toBe("1,6093 kilometer");
    expect(e.evaluate("1 voet in centimeter").formatted).toBe("30,48 centimeter");
    // Latin input still reads: a Dutch developer types "2 km" and a Dutch engine
    // answers in Dutch.
    expect(e.evaluate("2 km").formatted).toBe("2 kilometer");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("10 kilometer in meter").formatted).toBe("10.000 meter");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: Dutch groups with ".", which the lexer does not
    // read back as a group, so a grouped output is asserted above as a string
    // instead.
    const e = engine();
    for (const input of [
      "1 km + 500 m",
      "3 voet in duim",
      "5 mijlen",
      "10 centimeter",
      "1,5 m",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
    }
  });
});
