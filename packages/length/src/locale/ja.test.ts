import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthJa from "./ja";

const engine = () =>
  createEngine({
    locales: [composeLocale(japanese, [lengthJa])],
    kinds: [length],
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
    kind: "length",
    unit,
    slot,
  });
  return (lengthJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name `meter` and `meile`
    // before it can sweep for umlauts; every Japanese word is written in a
    // script no ratio, unit id or magnitude band can contain, so the script
    // class *is* the assertion. Hiragana, Katakana and the CJK ideographs, the
    // same three `japanese.segment` declares.
    expect(JSON.stringify(length)).not.toMatch(/[぀-ヿ一-鿿]/u);
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
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(lengthJa.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and katakana has no case for that
    // to change, so the string this table prints is byte-for-byte the string
    // the index holds.
    for (const [unit, words] of Object.entries(lengthJa.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU returns every katakana compound as one word", () => {
    // The check that stands where a spaced language's "is there a space in it?"
    // stands, and it matters most in this package: ミリメートル, センチメートル
    // and キロメートル are built out of the same prefixes German compounds with,
    // and Japanese has no `compoundSplitter` to fall back on. They reach the
    // alias index whole or not at all. Measured rather than assumed — ICU cuts
    // ラジアン into ラジ + アン, which is why `@smartput/angle/locale/ja` cannot
    // print the word for a radian.
    for (const [unit, words] of Object.entries(lengthJa.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(japanese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // And the run a conversion actually hands over, with the particle in it.
    expect(japanese.segment?.("メートルをキロメートル")).toEqual([
      "メートル",
      "を",
      "キロメートル",
    ]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [lengthJa]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Japanese that row is the same word as every other row, where German's
    // is a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [lengthJa]), [length], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("m", 1)).toBe("メートル");
    expect(word("m", 2)).toBe("メートル");
    expect(word("m", 1.5)).toBe("メートル");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Metern") and Ukrainian to the locative ("в метрах").
    expect(word("m", undefined, "conversion-target")).toBe("メートル");
    expect(word("km", undefined, "conversion-target")).toBe("キロメートル");
    expect(word("mi", 5)).toBe("マイル");
  });

  test("the inch is read and printed by its katakana name, never by `in`", () => {
    // `in` is filtered out of this unit's aliases for the reason the file
    // documents: `registry.aliasIndex` is one flat map that
    // `MatchCtx.isUnitAlias` reads without consulting a locale, so a Japanese
    // entry would break `@smartput/datetime`'s accept-gate for any engine that
    // also speaks English.
    expect(lengthJa.units.in?.aliases).not.toContain("in");
    expect(lengthJa.units.in?.symbol).toBe("インチ");
    const e = engine();
    expect(e.evaluate("5インチ").value.unit).toBe("in");
    expect(e.evaluate("5インチ").formatted).toBe("5インチ");
  });

  test("an engine built from it reads and writes Japanese length", () => {
    const e = engine();
    // No space anywhere: `japanese.renderQuantity` closes the gap on every
    // branch, so a Japanese engine answers 1メートル where an English one
    // answers "1 metre".
    expect(e.evaluate("1メートル").formatted).toBe("1メートル");
    expect(e.evaluate("100センチメートル").formatted).toBe("100センチメートル");
    expect(e.evaluate("3フィート").formatted).toBe("3フィート");
    expect(e.evaluate("2ヤード").formatted).toBe("2ヤード");
    expect(e.evaluate("1マイル").formatted).toBe("1マイル");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // both come from CLDR through `numberFormat: "intl"`, and are the same pair
    // English produces — which is why `ja` reads its own grouped output back
    // where `de` cannot.
    expect(e.evaluate("1km + 500m").formatted).toBe("1.5キロメートル");
    // The two particles, and the whole reason they are the `in` keyword: both
    // mark the *source*, so they attach to the left operand and land exactly
    // where an infix operator goes.
    expect(e.evaluate("0.5kmをメートル").formatted).toBe("500メートル");
    expect(e.evaluate("1メートルからセンチメートル").formatted).toBe("100センチメートル");
    // Latin input still reads, and answers in Japanese.
    expect(e.evaluate("2km").formatted).toBe("2キロメートル");
    expect(e.evaluate("2kmをメートル").formatted).toBe("2,000メートル");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which `de.test.ts` deliberately cannot do: `ja`
    // groups with "," and the lexer reads that back as a group separator.
    const e = engine();
    for (const input of [
      "1km + 500m",
      "0.5kmをメートル",
      "2kmをメートル",
      "5インチ",
      "1.5マイル",
      "25.4ミリメートル",
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
