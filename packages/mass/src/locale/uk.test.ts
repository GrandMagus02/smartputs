import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massUk from "./uk";

const engine = () =>
  createEngine({
    locales: [composeLocale(ukrainian, [massUk])],
    kinds: [mass],
  });

/** The key `ukrainian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  ukrainian.selectForm({
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

describe("mass uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios and unit ids, so no script but ASCII may reach it. Cyrillic
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(mass)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("every unit carries all eight grammatical keys", () => {
    // Unlike `area` next door, mass has no symbol-only unit: all six are nouns a
    // Ukrainian speaker writes out, exactly as all six carry `forms` in `en`. So
    // the assertion is unconditional — eight keys on every one of them, which is
    // what `ukrainian.selectForm` can produce and therefore what it may index.
    for (const unit of Object.keys(massUk.units)) {
      expect(Object.keys(massUk.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `ukrainian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 кг в кілограмі" resolved, and
  // nothing failed, while the vocabulary quietly relied on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(massUk.units)) {
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
      assertLocaleContract(composeLocale(ukrainian, [massUk]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all. A fractional count is what makes the contract check the
    // `nom-other`/`loc-other` rows this vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [massUk]), [mass], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Ukrainian mass", () => {
    const e = engine();
    // The plural boundary, both sides of it: 2 takes `nom-few` (nominative
    // plural) and 5 takes `nom-many` (genitive plural).
    expect(e.evaluate("2 кілограми").formatted).toBe("2 кілограми");
    expect(e.evaluate("5 кілограмів").formatted).toBe("5 кілограмів");
    // 21 is `one` in CLDR's Ukrainian rules, not `other`: the category follows
    // the last digit, so "21 кілограм" is singular where "21 kilograms" is not.
    expect(e.evaluate("21 кілограм").formatted).toBe("21 кілограм");
    // The fractional row — genitive *singular*. This is the assertion that would
    // read "1,5 кілограмів" if `nom-other` held a plural, and it is the same
    // sum `en.test.ts` pins as "1.5 kilograms".
    expect(e.evaluate("1 кг + 500 г").formatted).toBe("1,5 кілограма");
    // The feminine units decline differently from the three grams: "5 тонн" is a
    // bare stem and "5 унцій" ends in -ій, neither of them the masculine -ів.
    expect(e.evaluate("2 т").formatted).toBe("2 тонни");
    expect(e.evaluate("5 т").formatted).toBe("5 тонн");
    expect(e.evaluate("1,5 т").formatted).toBe("1,5 тонни");
    expect(e.evaluate("5 унцій").formatted).toBe("5 унцій");
    // A conversion, and one whose result stays under a thousand so no U+00A0
    // group separator lands in it. "1 фунт" is 16 ounces, and the result is a
    // finished quantity rather than a target, so it prints nominative.
    expect(e.evaluate("1 фунт в унціях").formatted).toBe("16 унцій");
    // A conversion whose result does group: Ukrainian groups thousands with
    // U+00A0, written here as an escape because a literal NBSP is invisible in
    // source and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("2 кг в г").formatted).toBe("2\u00A0000 грамів");
    // Both scripts read: a Ukrainian engine still takes the Latin aliases the
    // one alias map in `units.ts` declares, and prints them back in Ukrainian.
    expect(e.evaluate("2 kg").formatted).toBe("2 кілограми");
    expect(e.evaluate("500 мг").formatted).toBe("500 міліграмів");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "в грамах", the row a one-dimensional plural table
    // had no cell for.
    const g = massUk.units.g?.forms;
    expect(g?.[key("g", "after-number", 5)]).toBe("грамів");
    expect(g?.[key("g", "conversion-target", 5)]).toBe("грамах");
    expect(key("g", "conversion-target")).toBe("loc-other");
    expect(g?.[key("g", "conversion-target")]).toBe("грамах");
    // The feminine locative singular is its own ending, so the slot axis is not
    // one suffix applied to every stem: "в 1 тонні", not "в 1 тоннах".
    expect(massUk.units.t?.forms?.[key("t", "conversion-target", 1)]).toBe("тонні");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose. Ukrainian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "2\u00A0000 грамів" used to come back
    // as two numbers. `lex` now accepts that folded separator when the language's
    // own separator is a non-breaking space, which is what lets a Ukrainian engine
    // read the one input it is guaranteed to be handed: its own output.
    for (const input of [
      "1,5 кілограма",
      "5 тонн",
      "1 фунт в унціях",
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
