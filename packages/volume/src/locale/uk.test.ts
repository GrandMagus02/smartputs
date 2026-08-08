import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeUk from "./uk";

const engine = () =>
  createEngine({
    locales: [composeLocale(ukrainian, [volumeUk])],
    kinds: [volume],
  });

/** The key `ukrainian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  ukrainian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "volume",
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

describe("volume uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and magnitude bands, so no script but ASCII may
  // reach it. Cyrillic anywhere in the descriptor would mean a translation had
  // leaked into the half of the package that is supposed to be language-free.
  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(volume)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("the declined units carry all eight grammatical keys, and m3 carries none", () => {
    for (const unit of ["l", "ml", "gal", "pint"]) {
      expect(Object.keys(volumeUk.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
    // `m3` is the row where both languages agree there is no word to print:
    // "кубічних метрів" is two words, and the printer only emits what the parser
    // reads back. It renders through `м³` instead.
    expect(volumeUk.units.m3?.forms).toBeUndefined();
    expect(volumeUk.units.m3?.symbol).toBe("м³");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `ukrainian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 л в літрі" resolved, and
  // nothing failed, while the vocabulary quietly relied on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(volumeUk.units)) {
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
      assertLocaleContract(composeLocale(ukrainian, [volumeUk]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all. A fractional count is what makes the contract check the
    // `nom-other`/`loc-other` rows this vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [volumeUk]), [volume], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Ukrainian volume", () => {
    const e = engine();
    // The plural boundary, both sides of it: 2 takes `nom-few` (nominative
    // plural) and 5 takes `nom-many` (genitive plural).
    expect(e.evaluate("2 літри").formatted).toBe("2 літри");
    expect(e.evaluate("5 літрів").formatted).toBe("5 літрів");
    // 21 is `one` in CLDR's Ukrainian rules, not `other`: the category follows
    // the last digit, so "21 літр" is singular where "21 litres" is not.
    expect(e.evaluate("21 літр").formatted).toBe("21 літр");
    // The fractional row — genitive *singular*. This is the assertion that would
    // read "1,5 літрів" if `nom-other` held a plural, and it is the same sum
    // `en.test.ts` pins as "1.5 litres".
    expect(e.evaluate("1 л + 500 мл").formatted).toBe("1,5 літра");
    // `пінта` is feminine, so its endings are not the masculine ones above: the
    // genitive plural is a bare stem, and the fractional row ends in -и.
    expect(e.evaluate("2 пінти").formatted).toBe("2 пінти");
    expect(e.evaluate("5 пінт").formatted).toBe("5 пінт");
    expect(e.evaluate("1,5 пінти").formatted).toBe("1,5 пінти");
    // A conversion whose result stays under one, so no U+00A0 group separator
    // lands in it. The result is a finished quantity rather than a target, so it
    // prints nominative — genitive singular, the fractional row again.
    expect(e.evaluate("500 мл в літрах").formatted).toBe("0,5 літра");
    // A conversion whose result does group: Ukrainian groups thousands with
    // U+00A0, written here as an escape because a literal NBSP is invisible in
    // source and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("2 л в мілілітрах").formatted).toBe("2\u00A0000 мілілітрів");
    // `m3` has no words to print, so it renders through its symbol, tight
    // against the number exactly as `en` renders "3m³" — but it still *reads*
    // the declined "кубометр", which is the one-word name Ukrainians type.
    expect(e.evaluate("3 м³").formatted).toBe("3м³");
    expect(e.evaluate("5 кубометрів").formatted).toBe("5м³");
    // Both scripts read: a Ukrainian engine still takes the Latin aliases the
    // one alias map in `units.ts` declares, and prints them back in Ukrainian.
    expect(e.evaluate("2 gal").formatted).toBe("2 галони");
    expect(e.evaluate("500 мл").formatted).toBe("500 мілілітрів");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "в літрах", the row a one-dimensional plural table
    // had no cell for.
    const l = volumeUk.units.l?.forms;
    expect(l?.[key("l", "after-number", 5)]).toBe("літрів");
    expect(l?.[key("l", "conversion-target", 5)]).toBe("літрах");
    expect(key("l", "conversion-target")).toBe("loc-other");
    expect(l?.[key("l", "conversion-target")]).toBe("літрах");
    // The feminine locative singular is its own ending, so the slot axis is not
    // one suffix applied to every stem: "в 1 пінті", not "в 1 пінтах".
    expect(volumeUk.units.pint?.forms?.[key("pint", "conversion-target", 1)]).toBe(
      "пінті",
    );
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Inputs whose output carries no thousands group: Ukrainian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "2 000 мілілітрів" comes back as
    // two numbers. That is a core-level gap between the group separator and the
    // normalizer, not something a vocabulary can express its way out of, which
    // is why the grouped conversion above is asserted as a string instead.
    for (const input of ["1,5 літра", "5 пінт", "500 мл в літрах", "3 м³", "2 галони"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
