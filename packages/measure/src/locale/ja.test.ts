import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureJa from "./ja";

const engine = () =>
  createEngine({
    locales: [composeLocale(japanese, [measureJa])],
    kinds: [measure],
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
    kind: "measure",
    unit,
    slot,
  });
  return (measureJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name `punkt` and `pixel`
    // before it can sweep for umlauts; every Japanese word is written in a
    // script no ratio, unit id, `px` closure or magnitude band can contain, so
    // the script class *is* the assertion. Hiragana, Katakana and the CJK
    // ideographs, the same three `japanese.segment` declares.
    expect(JSON.stringify(measure)).not.toMatch(/[぀-ヿ一-鿿]/u);
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
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(measureJa.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and katakana has no case for that
    // to change, so the string this table prints is byte-for-byte the string
    // the index holds.
    for (const [unit, words] of Object.entries(measureJa.units)) {
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
    for (const [unit, words] of Object.entries(measureJa.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(japanese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // And the run a conversion actually hands over, with the particle in it.
    expect(japanese.segment?.("ピクセルをポイント")).toEqual([
      "ピクセル",
      "を",
      "ポイント",
    ]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [measureJa]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Japanese that row is the same word as every other row, where German's
    // is a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [measureJa]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("px", 1)).toBe("ピクセル");
    expect(word("px", 2)).toBe("ピクセル");
    expect(word("px", 1.5)).toBe("ピクセル");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Pixeln") and Ukrainian to the locative.
    expect(word("px", undefined, "conversion-target")).toBe("ピクセル");
    expect(word("pt", undefined, "conversion-target")).toBe("ポイント");
    expect(word("inch", 5)).toBe("インチ");
  });

  test("級 and 歯 are not claimed by any unit", () => {
    // The Japanese typographic units this kind has no ratio for: 級 (Q) and 歯
    // (H) are both a quarter of a millimetre, which is not a point, not a pica
    // and not a pixel. A `NoCandidateError` says "this engine does not know
    // 級"; bending the word onto the nearest unit would say nothing at all. The
    // same refusal `@smartput/measure/locale/de` makes for `Cicero`.
    const claimed = Object.values(measureJa.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("級");
    expect(claimed).not.toContain("歯");
    expect(() => engine().evaluate("12級")).toThrow();
  });

  test("an engine built from it reads and writes Japanese typography", () => {
    const e = engine();
    // No space anywhere: `japanese.renderQuantity` closes the gap on every
    // branch, so a Japanese engine answers 72ポイント where an English one
    // answers "72 points".
    expect(e.evaluate("72ポイント").formatted).toBe("72ポイント");
    expect(e.evaluate("1インチ").formatted).toBe("1インチ");
    expect(e.evaluate("10パイカ").formatted).toBe("10パイカ");
    expect(e.evaluate("25.4ミリメートル").formatted).toBe("25.4ミリメートル");
    // Arithmetic landing on a fraction, in the unit a Japanese designer sets
    // type in.
    expect(e.evaluate("1インチ + 36pt").formatted).toBe("1.5インチ");
    // The two particles, and the whole reason they are the `in` keyword: both
    // mark the *source*, so they attach to the left operand and land exactly
    // where an infix operator goes. The pixel conversion goes through the
    // kind's default 96 dpi, which is a fact about pixels and stays in
    // `units.ts`.
    expect(e.evaluate("1インチをポイント").formatted).toBe("72ポイント");
    expect(e.evaluate("96ピクセルからインチ").formatted).toBe("1インチ");
    // Latin input still reads, and answers in Japanese.
    expect(e.evaluate("1920px").formatted).toBe("1,920ピクセル");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which `de.test.ts` deliberately cannot do: `ja`
    // groups with "," and the lexer reads that back as a group separator.
    const e = engine();
    for (const input of [
      "1インチ + 36pt",
      "1インチをポイント",
      "96ピクセルからインチ",
      "1920px",
      "10パイカ",
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
