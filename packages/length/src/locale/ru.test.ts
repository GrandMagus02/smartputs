import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthRu from "./ru";

const engine = createEngine({
  locales: [composeLocale(russian, [lengthRu])],
  kinds: [length],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = russian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "length",
    unit,
    slot,
  });
  return (lengthRu.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

describe("length ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Russian word", () => {
    // The Cyrillic block, not a list of the eight nouns: the point is that the
    // kind holds ratios and magnitude bands and no language at all, so any
    // Cyrillic letter reaching it is the failure.
    expect(JSON.stringify(length)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("every unit carries exactly the eight keys Russian can ask for", () => {
    for (const [unit, words] of Object.entries(lengthRu.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(EIGHT_KEYS);
    }
  });

  // A printed form that is not a listed alias still round-trips, because
  // `russian`'s suffix stripper recovers it — at `weight: -2`. Asserting the
  // containment is what keeps the two halves of a unit's entry, what it writes
  // and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(lengthRu.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  // `in` is not a Russian keyword — `russian.keywords.in` is в/у/до — so nothing
  // in this language's own lexer would shadow the alias. It is left out because
  // `registry.aliasIndex` is one flat map that `isUnitAlias` reads without a
  // locale, so a Russian entry for `in` would put it back in front of
  // `@smartput/datetime`'s accept-gate for any engine speaking both languages.
  // See the vocabulary's own comment.
  test("`in` is left to the conversion keyword here too", () => {
    for (const words of Object.values(lengthRu.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthRu.units.in?.aliases).toContain("дюйм");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    assertLocaleContract(composeLocale(russian, [lengthRu]), [length]);
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Russian spells with a genitive *singular*. 1.5 is added
    // so `nom-other` and `loc-other` are actually sampled rather than merely
    // written down.
    assertLocaleContract(composeLocale(russian, [lengthRu]), [length], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine (seven of the eight units): the 2/3/4 row is a genitive
    // *singular*, so it is the same word as the fractional row and a different
    // word from the nominative singular. Ukrainian groups these cells the other
    // way round ("2 метри" against "1,5 метра"), which is what makes a
    // stem-swapped port of `uk.ts` wrong on two rows at once.
    expect(word("m", 1)).toBe("метр");
    expect(word("m", 2)).toBe("метра");
    expect(word("m", 5)).toBe("метров");
    expect(word("m", 1.5)).toBe("метра");
    // The two counts that catch a hand-written plural rule: 21 is singular in
    // Russian and 11 is not.
    expect(word("m", 21)).toBe("метр");
    expect(word("m", 11)).toBe("метров");
    // Feminine: `мили` fills the nominative plural and the genitive singular
    // alike, and the genitive plural is the bare stem, not an `-ов` ending.
    // Pasting the masculine paradigm here would produce "5 милей", which reads
    // as an instrumental and is not a count.
    expect(word("mi", 1)).toBe("миля");
    expect(word("mi", 2)).toBe("мили");
    expect(word("mi", 5)).toBe("миль");
    expect(word("mi", 1.5)).toBe("мили");
  });

  test("a conversion target is prepositional, with or without a count", () => {
    // "в 1 метре", "в 2 метрах", "в 5 метрах" — and the row no one-dimensional
    // plural model could express: "в метрах", chosen with no count in hand.
    expect(word("m", 1, "conversion-target")).toBe("метре");
    expect(word("m", 2, "conversion-target")).toBe("метрах");
    expect(word("m", 5, "conversion-target")).toBe("метрах");
    expect(word("m", undefined, "conversion-target")).toBe("метрах");
    // The feminine prepositional singular is `миле`, which is neither the
    // masculine `-е` on a `мил-` stem nor the `мили` of the genitive.
    expect(word("mi", 1, "conversion-target")).toBe("миле");
    expect(word("mi", undefined, "conversion-target")).toBe("милях");
  });

  test("an engine built from it reads and writes Russian length", () => {
    // The numeral boundary, in both directions across it, masculine and
    // feminine.
    expect(engine.evaluate("2 метра").formatted).toBe("2 метра");
    expect(engine.evaluate("5 метров").formatted).toBe("5 метров");
    expect(engine.evaluate("2 мили").formatted).toBe("2 мили");
    expect(engine.evaluate("5 миль").formatted).toBe("5 миль");
    // Arithmetic landing on a fraction: the genitive singular, not the plural.
    // "1,5 километров" would be the wrong answer no other test here sees.
    expect(engine.evaluate("1 км + 500 м").formatted).toBe("1,5 километра");
    // A conversion, written with "в" and read in Cyrillic.
    expect(engine.evaluate("3 фута в дюймах").formatted).toBe("36 дюймов");
    // The colloquial zero-ending genitive plural reads without an entry of its
    // own — it is spelled like the nominative singular — and prints back as the
    // written norm.
    expect(engine.evaluate("5 фут").formatted).toBe("5 футов");
    // Latin input still reads: a Russian keyboard produces "км", a Russian
    // developer types "km", and both are the same unit.
    expect(engine.evaluate("2 km").formatted).toBe("2 километра");
    // Grouping comes from CLDR through `numberFormat: "intl"`. U+00A0 as an
    // escape, never a literal — a literal is invisible here and degrades to a
    // plain space the moment the line is retyped.
    expect(engine.evaluate("2000 м").formatted).toBe("2\u00A0000 метров");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 км + 500 м",
      "3 фута в дюймах",
      "5 миль",
      "10 см",
      "1,5 м",
      "2000 м",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
