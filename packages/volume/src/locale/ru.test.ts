import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [volumeRu])],
    kinds: [volume],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
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

describe("volume ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and magnitude bands, so no script but ASCII may
  // reach it. Cyrillic anywhere in the descriptor would mean a translation had
  // leaked into the half of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(volume)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("the declined units carry all eight grammatical keys, and m3 carries none", () => {
    for (const unit of ["l", "ml", "gal", "pint"]) {
      expect(Object.keys(volumeRu.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
    // `m3` is the row where both languages agree there is no word to print:
    // "кубических метров" is two words, and the printer only emits what the
    // parser reads back. It renders through `м³` instead.
    expect(volumeRu.units.m3?.forms).toBeUndefined();
    expect(volumeRu.units.m3?.symbol).toBe("м³");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 л в литре" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(volumeRu.units)) {
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
      assertLocaleContract(composeLocale(russian, [volumeRu]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — Russian reaches it only through a fraction. 1.5 is what
    // makes the contract check the `nom-other`/`loc-other` rows this vocabulary
    // is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [volumeRu]), [volume], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine hard stem: the 2/3/4 row is a genitive *singular*, so it is the
    // same word as the fractional row and a different word from the nominative
    // singular — the opposite grouping to Ukrainian's "2 літри" / "1,5 літра".
    const l = volumeRu.units.l?.forms;
    expect(l?.[key("l", "after-number", 1)]).toBe("литр");
    expect(l?.[key("l", "after-number", 2)]).toBe("литра");
    expect(l?.[key("l", "after-number", 5)]).toBe("литров");
    expect(l?.[key("l", "after-number", 1.5)]).toBe("литра");
    // 21 is singular in Russian and 11 is not.
    expect(l?.[key("l", "after-number", 21)]).toBe("литр");
    expect(l?.[key("l", "after-number", 11)]).toBe("литров");
    // Feminine: the genitive plural has no ending at all.
    const pint = volumeRu.units.pint?.forms;
    expect(pint?.[key("pint", "after-number", 2)]).toBe("пинты");
    expect(pint?.[key("pint", "after-number", 5)]).toBe("пинт");
    expect(pint?.[key("pint", "after-number", 1.5)]).toBe("пинты");
  });

  test("an engine built from it reads and writes Russian volume", () => {
    const e = engine();
    // The numeral boundary, both sides of it.
    expect(e.evaluate("2 литра").formatted).toBe("2 литра");
    expect(e.evaluate("5 литров").formatted).toBe("5 литров");
    // 21 is `one` in CLDR's Russian rules, not `other`: the category follows the
    // last digit, so "21 литр" is singular where "21 litres" is not.
    expect(e.evaluate("21 литр").formatted).toBe("21 литр");
    // The fractional row — genitive *singular*. This is the assertion that would
    // read "1,5 литров" if `nom-other` held a plural, and it is the same sum
    // `en.test.ts` pins as "1.5 litres".
    expect(e.evaluate("1 л + 500 мл").formatted).toBe("1,5 литра");
    // `пинта` is feminine, so its endings are not the masculine ones above: the
    // genitive plural is a bare stem, and the fractional row ends in -ы.
    expect(e.evaluate("2 пинты").formatted).toBe("2 пинты");
    expect(e.evaluate("5 пинт").formatted).toBe("5 пинт");
    expect(e.evaluate("1,5 пинты").formatted).toBe("1,5 пинты");
    // A conversion whose result stays under one, so no U+00A0 group separator
    // lands in it. The result is a finished quantity rather than a target, so it
    // prints nominative — genitive singular, the fractional row again.
    expect(e.evaluate("500 мл в литрах").formatted).toBe("0,5 литра");
    // A conversion whose result does group: Russian groups thousands with
    // U+00A0, written here as an escape because a literal NBSP is invisible in
    // source and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("2 л в миллилитрах").formatted).toBe("2\u00A0000 миллилитров");
    // `m3` has no words to print, so it renders through its symbol, tight
    // against the number exactly as `en` renders "3m³" — but it still *reads*
    // the declined "кубометр", which is the one-word name Russians type.
    expect(e.evaluate("3 м³").formatted).toBe("3м³");
    expect(e.evaluate("5 кубометров").formatted).toBe("5м³");
    // Both scripts read: a Russian engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Russian.
    expect(e.evaluate("2 gal").formatted).toBe("2 галлона");
    expect(e.evaluate("500 мл").formatted).toBe("500 миллилитров");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // prepositional one as a conversion target, and a target with no count at
    // all lands on `loc-other` — "в литрах", the row a one-dimensional plural
    // table had no cell for.
    const l = volumeRu.units.l?.forms;
    expect(l?.[key("l", "after-number", 5)]).toBe("литров");
    expect(l?.[key("l", "conversion-target", 5)]).toBe("литрах");
    expect(key("l", "conversion-target")).toBe("loc-other");
    expect(l?.[key("l", "conversion-target")]).toBe("литрах");
    // The feminine prepositional singular is its own ending, so the slot axis is
    // not one suffix applied to every stem: "в 1 пинте", not "в 1 пинтах".
    expect(volumeRu.units.pint?.forms?.[key("pint", "conversion-target", 1)]).toBe(
      "пинте",
    );
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "1,5 литра",
      "5 пинт",
      "500 мл в литрах",
      "3 м³",
      "2 галлона",
      "2 л в миллилитрах",
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
