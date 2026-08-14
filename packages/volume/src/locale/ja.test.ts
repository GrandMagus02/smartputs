import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeJa from "./ja";

const engine = () =>
  createEngine({
    locales: [composeLocale(japanese, [volumeJa])],
    kinds: [volume],
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
    kind: "volume",
    unit,
    slot,
  });
  return (volumeJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name `liter` and `gallone`
    // before it can sweep for umlauts; every Japanese word is written in a
    // script no ratio, unit id or magnitude band can contain, so the script
    // class *is* the assertion. Hiragana, Katakana and the CJK ideographs, the
    // same three `japanese.segment` declares.
    expect(JSON.stringify(volume)).not.toMatch(/[぀-ヿ一-鿿]/u);
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
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // All five, `m3` included — which is the difference from `en` and `uk`,
    // where the cubic metre carries no `forms` at all.
    for (const [unit, words] of Object.entries(volumeJa.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and neither kana nor Han has a
    // case for that to change, so the string this table prints is
    // byte-for-byte the string the index holds.
    for (const [unit, words] of Object.entries(volumeJa.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU keeps 立方メートル whole rather than cutting at the script change", () => {
    // The measurement this file's one interesting decision rests on, and the
    // assumption that could plausibly have gone the other way: 立方メートル
    // changes script in the middle and `Intl.Segmenter` is free to break there.
    // It does not — and it does cut ラジアン into ラジ + アン, which is why
    // `@smartput/angle/locale/ja` cannot print the word for a radian. So this
    // is what licenses `forms` on `m3`, where `en` and `uk` must fall back to
    // the superscript symbol.
    expect(japanese.segment?.("立方メートル")).toEqual(["立方メートル"]);
    for (const [unit, words] of Object.entries(volumeJa.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(japanese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // And the run a conversion actually hands over, with the particle in it.
    expect(japanese.segment?.("立方メートルからリットル")).toEqual([
      "立方メートル",
      "から",
      "リットル",
    ]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [volumeJa]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Japanese that row is the same word as every other row, where German's
    // is a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [volumeJa]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("l", 1)).toBe("リットル");
    expect(word("l", 2)).toBe("リットル");
    expect(word("l", 1.5)).toBe("リットル");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Litern") and Ukrainian to the locative ("в літрах").
    expect(word("l", undefined, "conversion-target")).toBe("リットル");
    expect(word("m3", undefined, "conversion-target")).toBe("立方メートル");
    expect(word("gal", 5)).toBe("ガロン");
  });

  test("立米 reads as a cubic metre and is never printed back", () => {
    // The colloquial reading of the same unit — what a Japanese builder writes
    // where an engineer writes 立方メートル. Listing it and not printing it is
    // the ordinary split: reading a word and printing it are separate
    // decisions, and only printing has to round-trip.
    const e = engine();
    expect(e.evaluate("1立米").value.unit).toBe("m3");
    expect(e.evaluate("1立米").formatted).toBe("1立方メートル");
  });

  test("an engine built from it reads and writes Japanese volume", () => {
    const e = engine();
    // No space anywhere: `japanese.renderQuantity` closes the gap on every
    // branch, so a Japanese engine answers 1リットル where an English one
    // answers "1 litre".
    expect(e.evaluate("1リットル").formatted).toBe("1リットル");
    expect(e.evaluate("500ミリリットル").formatted).toBe("500ミリリットル");
    expect(e.evaluate("2ガロン").formatted).toBe("2ガロン");
    expect(e.evaluate("1パイント").formatted).toBe("1パイント");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // both come from CLDR through `numberFormat: "intl"`, and are the same pair
    // English produces — which is why `ja` reads its own grouped output back
    // where `de` cannot.
    expect(e.evaluate("1l + 500ml").formatted).toBe("1.5リットル");
    // The two particles, and the whole reason they are the `in` keyword: both
    // mark the *source*, so they attach to the left operand and land exactly
    // where an infix operator goes.
    expect(e.evaluate("1立方メートルをリットル").formatted).toBe("1,000リットル");
    expect(e.evaluate("500ミリリットルからリットル").formatted).toBe("0.5リットル");
    // Latin input still reads, and answers in Japanese.
    expect(e.evaluate("2l").formatted).toBe("2リットル");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which `de.test.ts` deliberately cannot do: `ja`
    // groups with "," and the lexer reads that back as a group separator. The
    // superscript symbol is deliberately absent from this list: `³` is not a
    // letter, so `lex` never builds a word token out of `m³` — which is why
    // this vocabulary prints the katakana compound and not the symbol.
    const e = engine();
    for (const input of [
      "1l + 500ml",
      "1立方メートルをリットル",
      "2ガロン",
      "1.5パイント",
      "500ミリリットル",
      "1立米",
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
