import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [powerRu])],
    kinds: [power],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "power",
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

describe("power ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and magnitude bands. Cyrillic anywhere in the
  // descriptor would mean a translation had leaked into the language-free half
  // of the package.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(power)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("the watt family carries all eight keys and `hp` carries none", () => {
    // Four of the five units are nouns Russian declines, so each needs exactly
    // what `russian.selectForm` can produce. `hp` is the exception and the entry
    // in `ru.ts` says why at length: "лошадиная сила" is two inflecting words and
    // a space ends a unit token, so a `forms` table there would print eight rows
    // no input could read back.
    for (const [unit, words] of Object.entries(powerRu.units)) {
      if (unit === "hp") {
        expect(words.forms, "hp declares a form").toBeUndefined();
        continue;
      }
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(EIGHT_KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 кВт в киловатте" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(powerRu.units)) {
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
      assertLocaleContract(composeLocale(russian, [powerRu]), [power]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Russian that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [powerRu]), [power], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the genitive plural of `ватт` is `ватт`", () => {
    // The row that makes this kind worth reading. A unit named after a person
    // takes a zero-ending counting form after a numeral, so `nom-one` and
    // `nom-many` are one string here — "1 ватт" and "5 ватт" — while `nom-few`
    // and the fractional row take the ordinary genitive singular "ватта".
    // `mass` makes the opposite call for the same-looking cell ("5 килограммов",
    // where the bare stem is the colloquialism), which is why neither file can
    // be generated from the other by an ending table.
    const w = powerRu.units.w?.forms;
    expect(w?.[key("w", "after-number", 1)]).toBe("ватт");
    expect(w?.[key("w", "after-number", 2)]).toBe("ватта");
    expect(w?.[key("w", "after-number", 5)]).toBe("ватт");
    expect(w?.[key("w", "after-number", 1.5)]).toBe("ватта");
    // The two counts that catch a hand-written plural rule: 21 is `one` in
    // Russian and 11 is `many`, and here both of them spell "ватт" — for two
    // different grammatical reasons.
    expect(key("w", "after-number", 21)).toBe("nom-one");
    expect(key("w", "after-number", 11)).toBe("nom-many");
    // Which is why the fractional row is the only one that proves the point on
    // its own: it is the one cell no integer can reach.
    expect(key("w", "after-number", 1.5)).toBe("nom-other");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // prepositional one as a conversion target, and a target with no count at
    // all lands on `loc-other` — "в ваттах", the row a one-dimensional plural
    // table had no cell for.
    const w = powerRu.units.w?.forms;
    expect(w?.[key("w", "after-number", 5)]).toBe("ватт");
    expect(w?.[key("w", "conversion-target", 5)]).toBe("ваттах");
    expect(key("w", "conversion-target")).toBe("loc-other");
    expect(w?.[key("w", "conversion-target")]).toBe("ваттах");
    // The prepositional singular is its own ending, so the case axis is not one
    // suffix applied to every count: "в 1 ватте", not "в 1 ваттах".
    expect(w?.[key("w", "conversion-target", 1)]).toBe("ватте");
    // `hp` is asked the same question and has no table to answer it from, which
    // is what "symbol-only" costs: the case axis is simply invisible there.
    expect(key("hp", "conversion-target")).toBe("loc-other");
    expect(powerRu.units.hp?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Russian power", () => {
    const e = engine();
    // The numeral boundary, both sides of it, and the collapse Russian makes
    // there.
    expect(e.evaluate("1 ватт").formatted).toBe("1 ватт");
    expect(e.evaluate("2 ватта").formatted).toBe("2 ватта");
    expect(e.evaluate("5 ватт").formatted).toBe("5 ватт");
    expect(e.evaluate("21 ватт").formatted).toBe("21 ватт");
    // A sum that lands on a fraction — the assertion that would read
    // "1,5 киловатт" if `nom-other` held the counting form instead of the
    // genitive singular it is.
    expect(e.evaluate("1 кВт + 500 Вт").formatted).toBe("1,5 киловатта");
    // A conversion, and the U+00A0 group separator Russian uses. Written as an
    // escape deliberately: a literal NBSP is invisible in source and degrades to
    // a plain space the moment someone retypes the line.
    expect(e.evaluate("1 квт в ваттах").formatted).toBe("1\u00A0000 ватт");
    // The -ов genitive plural a reader reaches for when the noun is not being
    // counted is listed as an alias, and prints back as the counting form.
    expect(e.evaluate("5 ваттов").formatted).toBe("5 ватт");
    // Both scripts read: a Russian datasheet writes "2 kW" and a Russian
    // keyboard writes "2 кВт", and both print back in Russian.
    expect(e.evaluate("2 мвт").formatted).toBe("2 мегаватта");
    expect(e.evaluate("5 kw").formatted).toBe("5 киловатт");
    // `hp` renders through its symbol, tight against the number, because the
    // phrase Russian actually says cannot be read back as one token.
    expect(e.evaluate("150 hp").formatted).toBe("150лс");
    expect(e.evaluate("150 лс").formatted).toBe("150лс");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose. Russian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "1\u00A0000 ватт" would come back as
    // two numbers if `lex` did not accept that folded separator for a language
    // whose own separator is a non-breaking space. `hp` is here too: it
    // round-trips through its symbol rather than through a `forms` table, which
    // is the other half of the same rule.
    for (const input of [
      "5 ватт",
      "1 кВт + 500 Вт",
      "1 квт в ваттах",
      "2 мвт",
      "150 hp",
      "1,5 гвт",
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
