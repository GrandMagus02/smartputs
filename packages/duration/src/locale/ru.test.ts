import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [durationRu])],
    kinds: [duration],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "duration",
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

describe("duration ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios and unit ids, so no script but ASCII may reach it. Cyrillic
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(duration)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("every unit carries all eight grammatical keys", () => {
    // All six units are nouns a Russian speaker writes out — none of them is a
    // symbol-only compound the way `speed`'s "км/ч" is — so the assertion is
    // unconditional. Eight keys is exactly what `russian.selectForm` can produce
    // and therefore exactly what it may index.
    for (const unit of Object.keys(durationRu.units)) {
      expect(Object.keys(durationRu.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 ч в часе" resolves and nothing
  // fails, while the vocabulary quietly relies on a guess for a word it had
  // itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step, and
  // it is the check that catches a fill-vowel form ("дней", "недель") the
  // stripper could never have produced from the nominative singular.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(durationRu.units)) {
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
      assertLocaleContract(composeLocale(russian, [durationRu]), [duration]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Russian that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [durationRu]), [duration], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine hard stem. `nom-few` is a genitive *singular*, so it coincides
    // with the fractional row — the opposite grouping to Ukrainian's, where the
    // same cell holds a nominative plural and stands apart from it.
    const h = durationRu.units.h?.forms;
    expect(h?.[key("h", "after-number", 1)]).toBe("час");
    expect(h?.[key("h", "after-number", 2)]).toBe("часа");
    expect(h?.[key("h", "after-number", 5)]).toBe("часов");
    expect(h?.[key("h", "after-number", 1.5)]).toBe("часа");
    // The two counts that catch a hand-written plural rule: 21 is `one` in
    // Russian and 11 is not, because the category follows the last digit except
    // in the teens.
    expect(h?.[key("h", "after-number", 21)]).toBe("час");
    expect(h?.[key("h", "after-number", 11)]).toBe("часов");
    // The feminines drop their ending entirely in the genitive plural, and the
    // soft-stemmed `неделя` inserts a fill vowel to do it.
    expect(durationRu.units.min?.forms?.[key("min", "after-number", 5)]).toBe("минут");
    expect(durationRu.units.wk?.forms?.[key("wk", "after-number", 5)]).toBe("недель");
    // `день` drops its own fill vowel the other way round — everywhere but the
    // nominative singular — and takes the soft -ей plural.
    expect(durationRu.units.d?.forms?.[key("d", "after-number", 1)]).toBe("день");
    expect(durationRu.units.d?.forms?.[key("d", "after-number", 2)]).toBe("дня");
    expect(durationRu.units.d?.forms?.[key("d", "after-number", 5)]).toBe("дней");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // prepositional one as a conversion target, and a target with no count at
    // all lands on `loc-other` — "в часах", the row a one-dimensional plural
    // table had no cell for.
    const h = durationRu.units.h?.forms;
    expect(h?.[key("h", "after-number", 5)]).toBe("часов");
    expect(h?.[key("h", "conversion-target", 5)]).toBe("часах");
    expect(key("h", "conversion-target")).toBe("loc-other");
    expect(h?.[key("h", "conversion-target")]).toBe("часах");
    // The prepositional singular is its own ending, so the case axis is not one
    // suffix applied to every count: "в 1 часе", not "в 1 часах". This is also
    // the cell where Russian has a second locative it must *not* use — "в первом
    // часу" is the time of day, not a container of sixty minutes.
    expect(h?.[key("h", "conversion-target", 1)]).toBe("часе");
    expect(durationRu.units.wk?.forms?.[key("wk", "conversion-target", 1)]).toBe(
      "неделе",
    );
  });

  test("an engine built from it reads and writes Russian duration", () => {
    const e = engine();
    // The numeral boundary, both sides of it: 2 takes `nom-few` (genitive
    // singular) and 5 takes `nom-many` (genitive plural in -ов).
    expect(e.evaluate("1 час").formatted).toBe("1 час");
    expect(e.evaluate("2 часа").formatted).toBe("2 часа");
    expect(e.evaluate("5 часов").formatted).toBe("5 часов");
    // 21 is `one` in CLDR's Russian rules, not `other`: the category follows the
    // last digit, so "21 час" is singular where "21 hours" is not.
    expect(e.evaluate("21 час").formatted).toBe("21 час");
    // A sum that lands on a fraction — the assertion that would read
    // "1,5 часов" if `nom-other` held a plural instead of the genitive singular
    // it is.
    expect(e.evaluate("1 ч + 30 мин").formatted).toBe("1,5 часа");
    // The same fraction reached by a conversion rather than a sum.
    expect(e.evaluate("90 мин в часах").formatted).toBe("1,5 часа");
    // Two conversions across the units whose stems change: "дн" is the dotless
    // abbreviation Russian writes with a dot, and a week in days shows the soft
    // -ей plural.
    expect(e.evaluate("2 дн в часах").formatted).toBe("48 часов");
    expect(e.evaluate("1 нед в днях").formatted).toBe("7 дней");
    // The feminine bare-stem genitive plural.
    expect(e.evaluate("500 мс").formatted).toBe("500 миллисекунд");
    expect(e.evaluate("5 недель").formatted).toBe("5 недель");
    // "сутки" is a synonym rather than an inflection, listed because
    // recognition is many-to-one; generation stays the one `forms` table, so it
    // comes back as "дня".
    expect(e.evaluate("2 суток").formatted).toBe("2 дня");
    // Both scripts read: a Russian engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Russian.
    expect(e.evaluate("2 h").formatted).toBe("2 часа");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose. Russian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "3\u00A0600 секунд" would come back
    // as two numbers if `lex` did not accept that folded separator for a
    // language whose own separator is a non-breaking space. This is the one
    // input a Russian engine is guaranteed to be handed: its own output.
    for (const input of [
      "1 час",
      "5 часов",
      "1 ч + 30 мин",
      "2 дн в часах",
      "1 нед в днях",
      "500 мс",
      "1 ч в секундах",
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
