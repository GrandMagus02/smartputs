import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [datasizeRu])],
    kinds: [datasize],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "datasize",
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

describe("datasize ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios and unit ids, so no script but ASCII may reach it. Cyrillic
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(datasize)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("every unit carries all eight grammatical keys", () => {
    // All nine units are nouns a Russian speaker writes out — none of them is a
    // symbol-only unit the way `speed`'s compounds are — so the assertion is
    // unconditional. Eight keys is exactly what `russian.selectForm` can produce
    // and therefore exactly what it may index.
    for (const unit of Object.keys(datasizeRu.units)) {
      expect(Object.keys(datasizeRu.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 кБ в килобайте" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(datasizeRu.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(russian, [datasizeRu]), [datasize]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Russian that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [datasizeRu]), [datasize], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four decisions, two of which coincide", () => {
    // Masculine measure noun. `nom-few` is a genitive *singular* rather than the
    // nominative plural Ukrainian writes there, so it coincides with the
    // fractional row; and `nom-many` is the counting form, which for a measure
    // noun is the bare stem, so it coincides with the nominative singular. Two
    // pairs, four decisions — and neither coincidence is derivable from the
    // other language's table.
    const b = datasizeRu.units.b?.forms;
    expect(b?.[key("b", "after-number", 1)]).toBe("байт");
    expect(b?.[key("b", "after-number", 2)]).toBe("байта");
    expect(b?.[key("b", "after-number", 5)]).toBe("байт");
    expect(b?.[key("b", "after-number", 1.5)]).toBe("байта");
    // The two counts that catch a hand-written plural rule: 21 is `one` in
    // Russian and 11 is `many`, because the category follows the last digit
    // except in the teens.
    expect(b?.[key("b", "after-number", 21)]).toBe("байт");
    expect(b?.[key("b", "after-number", 11)]).toBe("байт");
    // ...which is why the fractional row is the only one that proves the point
    // on its own: it is the one cell no integer can reach.
    expect(key("b", "after-number", 1.5)).toBe("nom-other");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // prepositional one as a conversion target, and a target with no count at
    // all lands on `loc-other` — "в байтах", the row a one-dimensional plural
    // table had no cell for.
    const b = datasizeRu.units.b?.forms;
    expect(b?.[key("b", "after-number", 5)]).toBe("байт");
    expect(b?.[key("b", "conversion-target", 5)]).toBe("байтах");
    expect(key("b", "conversion-target")).toBe("loc-other");
    expect(b?.[key("b", "conversion-target")]).toBe("байтах");
    // The prepositional singular is its own ending, so the case axis is not one
    // suffix applied to every count: "в 1 байте", not "в 1 байтах".
    expect(b?.[key("b", "conversion-target", 1)]).toBe("байте");
  });

  test("an engine built from it reads and writes Russian datasize", () => {
    const e = engine();
    // The numeral boundary, both sides of it, and the collapse Russian makes
    // there: 2 takes the genitive singular and 5 the bare counting form.
    expect(e.evaluate("1 байт").formatted).toBe("1 байт");
    expect(e.evaluate("2 байта").formatted).toBe("2 байта");
    expect(e.evaluate("5 байт").formatted).toBe("5 байт");
    expect(e.evaluate("21 байт").formatted).toBe("21 байт");
    // A sum that lands on a fraction — the input that would read
    // "1,5 килобайтов" if `nom-other` held a plural instead of the genitive
    // singular it is.
    expect(e.evaluate("1 кб + 500 б").formatted).toBe("1,5 килобайта");
    // A conversion whose result groups: Russian groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("1 кб в байтах").formatted).toBe("1\u00A0000 байт");
    // The binary family is a different unit, never a second name for the decimal
    // one, and 1024 is `few` in CLDR's Russian rules because the category
    // follows the last digit.
    expect(e.evaluate("1 киб в байтах").formatted).toBe("1\u00A0024 байта");
    // Both scripts read: a Russian engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Russian.
    expect(e.evaluate("5 kb").formatted).toBe("5 килобайт");
    expect(e.evaluate("5 гб").formatted).toBe("5 гигабайт");
    // The -ов genitive plural a reader who has not read Rosenthal will type is
    // listed as an alias, and prints back as the counting form.
    expect(e.evaluate("5 килобайтов").formatted).toBe("5 килобайт");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversions are in this list on purpose. Russian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "1\u00A0000 байт" would come back as
    // two numbers if `lex` did not accept that folded separator for a language
    // whose own separator is a non-breaking space. This is the one input a
    // Russian engine is guaranteed to be handed: its own output.
    for (const input of [
      "1 байт",
      "2 байта",
      "5 байт",
      "1 кб + 500 б",
      "1 кб в байтах",
      "1 киб в байтах",
      "5 гб",
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
