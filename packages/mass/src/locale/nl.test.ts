import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massNl from "./nl";

const engine = () =>
  createEngine({
    locales: [composeLocale(dutch, [massNl])],
    kinds: [mass],
  });

/** The two keys `dutch.selectForm` can produce, sorted. */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Dutch word", () => {
    // Only the nouns, and there is no second sweep to back them up: Dutch is
    // written in plain ASCII, so the umlaut-and-`ß` check that catches a stray
    // German word in `de.test.ts` has no Dutch equivalent. Naming the words is
    // the whole check here.
    expect(JSON.stringify(mass)).not.toMatch(/kilogram|grammen|tonnen|pond|ounce/i);
  });

  test("`ons` is refused rather than approximated", () => {
    // A Dutch `ons` is 100 g — the legal metric one, not a colloquialism — and
    // this unit is the 28.35 g avoirdupois ounce. Claiming the word would answer
    // 3.5× wrong for what a Dutch cook types, and the kind has no 100 g unit for
    // the right reading to land on, so the engine refuses the word instead.
    for (const words of Object.values(massNl.units)) {
      expect(words.aliases).not.toContain("ons");
    }
    expect(() => engine().evaluate("5 ons")).toThrow();
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows two is all `dutch.selectForm` can ever ask for. The
    // slot loop is the load-bearing half here — Dutch reads `slot` and discards
    // it, so a language that had grown a case axis would show up as a third key
    // (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          dutch.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(massNl.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs. Dutch
    // capitalises no noun, so the table prints `gram` and the alias index holds
    // `gram` — the two halves of this file are the same strings, and asserting
    // that is the point rather than an oversight.
    for (const [unit, words] of Object.entries(massNl.units)) {
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
      assertLocaleContract(composeLocale(dutch, [massNl]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so `Intl.PluralRules("nl")` answers
    // from the integer side alone and the fractional reading of `other` is never
    // reached. 1.5 is what makes the contract sample it — and in Dutch that row
    // is the same invariant noun as every other count ("1,5 kilogram"), where
    // German's is a plural and Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(dutch, [massNl]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("no mass noun moves on the number axis", () => {
    // The Dutch measure rule: a unit of weight stays singular after a numeral.
    // Both rows of every table are therefore one word, which is the language and
    // not an unfinished table — compare `@smartput/angle/locale/nl`, where
    // `graad`/`graden` does move because an angle is counted.
    for (const unit of ["mg", "g", "kg", "t", "oz", "lb"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2));
      expect(word(unit, 1), unit).toBe(word(unit, 1.5));
    }
    expect(word("kg", 5)).toBe("kilogram");
    expect(word("g", 2)).toBe("gram");
    expect(word("t", 3)).toBe("ton");
    expect(word("lb", 5)).toBe("pond");
  });

  test("a conversion target is spelled like a bare quantity", () => {
    // The substantive difference from German: `in` governs nothing in Dutch, so
    // the count-free target (ruling R5 sends it to `other`) is the same word as
    // every other row. `de.ts` needs `dat-other` to hold "Tonnen" here.
    for (const unit of ["mg", "g", "kg", "t", "oz", "lb"]) {
      expect(word(unit, undefined, "conversion-target"), unit).toBe(word(unit, 1));
    }
    expect(word("g", undefined, "conversion-target")).toBe("gram");
    expect(word("t", undefined, "conversion-target")).toBe("ton");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // `compoundSplitter` finds `gram` inside `kilogram` at -3 and the alias
    // written out in the vocabulary is weight 0, so the kilogram wins. That
    // ordering is the only reason the head list may contain a morpheme as
    // productive as `gram` at all.
    const e = engine();
    expect(e.evaluate("10 kilogram").value.unit).toBe("kg");
    expect(e.evaluate("10 milligram").value.unit).toBe("mg");
    expect(e.evaluate("10 gram").value.unit).toBe("g");
    // And the compound no vocabulary would list, which is what the split is for.
    expect(e.evaluate("10 kaasgram").value.unit).toBe("g");
  });

  test("an engine built from it reads and writes Dutch mass", () => {
    const e = engine();
    expect(e.evaluate("1 gram").formatted).toBe("1 gram");
    expect(e.evaluate("5 gram").formatted).toBe("5 gram");
    // The plural a reader may type, answered with the invariant measure noun.
    expect(e.evaluate("5 grammen").value.unit).toBe("g");
    expect(e.evaluate("2 kilo's").value.unit).toBe("kg");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun does not move.
    expect(e.evaluate("1 kg + 500 g").formatted).toBe("1,5 kilogram");
    // A conversion written with a Dutch keyword. "in" and "naar" reach the same
    // `in` keyword, which is `dutch.keywords`' doing and not this file's.
    expect(e.evaluate("0,5 kg in gram").formatted).toBe("500 gram");
    expect(e.evaluate("500 g naar kilogram").formatted).toBe("0,5 kilogram");
    // `pond` reads as the avoirdupois pound, which is the ambiguity the
    // vocabulary documents: a Dutch cook means 500 g by it, and this kind has no
    // 500 g unit for that sense to resolve to.
    expect(e.evaluate("2 pond").value.unit).toBe("lb");
    expect(e.evaluate("2 pond").formatted).toBe("2 pond");
    // Latin input still reads, and answers in Dutch.
    expect(e.evaluate("2 kg").formatted).toBe("2 kilogram");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("2 kg in gram").formatted).toBe("2.000 gram");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: Dutch groups with ".", which the lexer does not
    // read back as a group, so a grouped output is asserted above as a string
    // instead.
    const e = engine();
    for (const input of [
      "1 kg + 500 g",
      "0,5 kg in gram",
      "5 ounce",
      "3 ton",
      "1,5 pond",
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
