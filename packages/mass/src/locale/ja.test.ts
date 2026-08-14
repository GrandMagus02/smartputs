import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massJa from "./ja";

const engine = () =>
  createEngine({
    locales: [composeLocale(japanese, [massJa])],
    kinds: [mass],
  });

/** The only key `japanese.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = japanese.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name `gramm` and `tonnen`
    // before it can sweep for umlauts; every Japanese word is written in a
    // script no ratio, unit id or magnitude band can contain, so the script
    // class *is* the assertion. Hiragana, Katakana and the CJK ideographs, the
    // same three `japanese.segment` declares.
    expect(JSON.stringify(mass)).not.toMatch(/[぀-ヿ一-鿿]/u);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `japanese.selectForm` can ever ask
    // for, which is what makes the exact-match assertion on each table mean
    // something (rule 6). The counts deliberately include the shapes that move
    // `en` and `uk` — 1, the 2/5/21 Slavic boundaries, a fraction, and zero —
    // and none of them moves Japanese.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000]) {
        produced.add(
          japanese.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(massJa.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and katakana has no case for that
    // to change, so the string this table prints is byte-for-byte the string
    // the index holds.
    for (const [unit, words] of Object.entries(massJa.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU returns every katakana unit name as one word", () => {
    // The check that stands where a spaced language's "is there a space in it?"
    // stands. Japanese puts no space between words, so `japanese.segment` is
    // the only thing between a letter run and the alias index: a name ICU cuts
    // reaches `lex` as two word tokens and can never be read back. Measured
    // rather than assumed — ICU cuts ラジアン into ラジ + アン, which is why
    // `@smartput/angle/locale/ja` cannot print the word for a radian.
    for (const [unit, words] of Object.entries(massJa.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(japanese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // And the run a conversion actually hands over, with the particle in it.
    expect(japanese.segment?.("キログラムをグラム")).toEqual([
      "キログラム",
      "を",
      "グラム",
    ]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [massJa]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Japanese that row is the same word as every other row, where German's
    // is a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [massJa]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // The mirror image of both other tested languages: English marks number
    // always, German marks it on the feminine nouns, Ukrainian marks number and
    // case at once, and Japanese marks nothing. One string per unit is the
    // language and not an unfinished table.
    expect(word("kg", 1)).toBe("キログラム");
    expect(word("kg", 2)).toBe("キログラム");
    expect(word("kg", 1.5)).toBe("キログラム");
    expect(word("kg", 5)).toBe("キログラム");
    // Ruling R5's count-free row, and the slot German would send to the dative.
    expect(word("kg", undefined, "conversion-target")).toBe("キログラム");
    expect(word("g", undefined, "conversion-target")).toBe("グラム");
    expect(word("t", 1000)).toBe("トン");
  });

  test("an engine built from it reads and writes Japanese mass", () => {
    const e = engine();
    // No space anywhere: `japanese.renderQuantity` closes the gap on every
    // branch, so a Japanese engine answers 5グラム where an English one answers
    // "5 grams".
    expect(e.evaluate("1グラム").formatted).toBe("1グラム");
    expect(e.evaluate("5グラム").formatted).toBe("5グラム");
    expect(e.evaluate("2ポンド").formatted).toBe("2ポンド");
    expect(e.evaluate("3オンス").formatted).toBe("3オンス");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // both come from CLDR through `numberFormat: "intl"`, and are the same pair
    // English produces — which is why `ja` reads its own grouped output back
    // where `de` cannot.
    expect(e.evaluate("1kg + 500g").formatted).toBe("1.5キログラム");
    expect(e.evaluate("1.5トン").formatted).toBe("1.5トン");
    // The two particles, and the whole reason they are the `in` keyword: both
    // mark the *source*, so they attach to the left operand and land exactly
    // where an infix operator goes.
    expect(e.evaluate("0.5kgをグラム").formatted).toBe("500グラム");
    expect(e.evaluate("500グラムからキログラム").formatted).toBe("0.5キログラム");
    // Latin input still reads, and answers in Japanese — the two registers of
    // one language this vocabulary declares side by side.
    expect(e.evaluate("2kg").formatted).toBe("2キログラム");
    expect(e.evaluate("2kgをグラム").formatted).toBe("2,000グラム");
    // The colloquial clipping, claimed for the kilogram exactly as `units.ts`
    // claims the English "kilo".
    expect(e.evaluate("3キロ").value.unit).toBe("kg");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which `de.test.ts` deliberately cannot do: `ja`
    // groups with "," and the lexer reads that back as a group separator.
    const e = engine();
    for (const input of [
      "1kg + 500g",
      "0.5kgをグラム",
      "2kgをグラム",
      "3オンス",
      "1.5トン",
      "1000ミリグラム",
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
