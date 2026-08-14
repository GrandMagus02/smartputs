import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [massRu])],
    kinds: [mass],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "mass",
    unit,
    slot,
  });

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

describe("mass ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios and unit ids, so no script but ASCII may reach it. Cyrillic
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(mass)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("every unit carries all eight grammatical keys", () => {
    // All six mass units are nouns Russian writes out — none of them is a
    // symbol-only unit the way `area`'s squared metres are — so the assertion is
    // unconditional. Eight keys is exactly what `russian.selectForm` can produce
    // and therefore exactly what it may index.
    for (const unit of Object.keys(massRu.units)) {
      expect(Object.keys(massRu.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 кг в килограмме" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(massRu.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(russian, [massRu]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Russian that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [massRu]), [mass], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine hard stem. Unlike Ukrainian, the 2/3/4 row is a genitive
    // *singular* and not a nominative plural, so it coincides with the
    // fractional row and differs from the 5+ row — the opposite grouping to
    // "2 кілограми" / "1,5 кілограма" next door.
    const kg = massRu.units.kg?.forms;
    expect(kg?.[key("kg", "after-number", 1)]).toBe("килограмм");
    expect(kg?.[key("kg", "after-number", 2)]).toBe("килограмма");
    expect(kg?.[key("kg", "after-number", 5)]).toBe("килограммов");
    expect(kg?.[key("kg", "after-number", 1.5)]).toBe("килограмма");
    // The two counts that catch a hand-written plural rule: 21 is singular in
    // Russian and 11 is not.
    expect(kg?.[key("kg", "after-number", 21)]).toBe("килограмм");
    expect(kg?.[key("kg", "after-number", 11)]).toBe("килограммов");
    // Feminine hard stem: the genitive plural has no ending at all.
    const t = massRu.units.t?.forms;
    expect(t?.[key("t", "after-number", 2)]).toBe("тонны");
    expect(t?.[key("t", "after-number", 5)]).toBe("тонн");
    expect(t?.[key("t", "after-number", 1.5)]).toBe("тонны");
  });

  test("an engine built from it reads and writes Russian mass", () => {
    const e = engine();
    // The numeral boundary, both sides of it: 2 takes `nom-few` (genitive
    // singular) and 5 takes `nom-many` (genitive plural in -ов).
    expect(e.evaluate("2 килограмма").formatted).toBe("2 килограмма");
    expect(e.evaluate("5 килограммов").formatted).toBe("5 килограммов");
    // 21 is `one` in CLDR's Russian rules, not `other`: the category follows the
    // last digit, so "21 килограмм" is singular where "21 kilograms" is not.
    expect(e.evaluate("21 килограмм").formatted).toBe("21 килограмм");
    // The fractional row — genitive *singular*. This is the assertion that would
    // read "1,5 килограммов" if `nom-other` held a plural, and it is the same sum
    // `en.test.ts` pins as "1.5 kilograms".
    expect(e.evaluate("1 кг + 500 г").formatted).toBe("1,5 килограмма");
    // The feminine units decline differently from the three grams: "5 тонн" is a
    // bare stem and "5 унций" ends in -ий, neither of them the masculine -ов.
    expect(e.evaluate("2 т").formatted).toBe("2 тонны");
    expect(e.evaluate("5 т").formatted).toBe("5 тонн");
    expect(e.evaluate("1,5 т").formatted).toBe("1,5 тонны");
    expect(e.evaluate("5 унций").formatted).toBe("5 унций");
    // A conversion, and one whose result stays under a thousand so no U+00A0
    // group separator lands in it. "1 фунт" is 16 ounces, and the result is a
    // finished quantity rather than a target, so it prints nominative.
    expect(e.evaluate("1 фунт в унциях").formatted).toBe("16 унций");
    // A conversion whose result does group: Russian groups thousands with
    // U+00A0, written here as an escape because a literal NBSP is invisible in
    // source and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("2 кг в г").formatted).toBe("2\u00A0000 граммов");
    // The colloquial zero-ending genitive plural reads without an entry of its
    // own — it is spelled like the nominative singular — and prints back as the
    // written norm.
    expect(e.evaluate("5 килограмм").formatted).toBe("5 килограммов");
    // Both scripts read: a Russian engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Russian.
    expect(e.evaluate("2 kg").formatted).toBe("2 килограмма");
    expect(e.evaluate("500 мг").formatted).toBe("500 миллиграммов");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // prepositional one as a conversion target, and a target with no count at
    // all lands on `loc-other` — "в граммах", the row a one-dimensional plural
    // table had no cell for.
    const g = massRu.units.g?.forms;
    expect(g?.[key("g", "after-number", 5)]).toBe("граммов");
    expect(g?.[key("g", "conversion-target", 5)]).toBe("граммах");
    expect(key("g", "conversion-target")).toBe("loc-other");
    expect(g?.[key("g", "conversion-target")]).toBe("граммах");
    // The feminine prepositional singular is its own ending, so the slot axis is
    // not one suffix applied to every stem: "в 1 тонне", not "в 1 тоннах".
    expect(massRu.units.t?.forms?.[key("t", "conversion-target", 1)]).toBe("тонне");
    // And the -ия paradigm collapses it back onto the genitive: "в 1 унции" is
    // the same string as "1,5 унции", which is why an ending table alone cannot
    // generate this vocabulary.
    expect(massRu.units.oz?.forms?.[key("oz", "conversion-target", 1)]).toBe("унции");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose. Russian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "2\u00A0000 граммов" would come back
    // as two numbers if `lex` did not accept that folded separator for a language
    // whose own separator is a non-breaking space. This is the one input a
    // Russian engine is guaranteed to be handed: its own output.
    for (const input of [
      "1,5 килограмма",
      "5 тонн",
      "1 фунт в унциях",
      "500 мг",
      "2 кг в г",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
