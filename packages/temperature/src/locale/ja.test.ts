import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureJa from "./ja";

const [readingJa, deltaJa] = temperatureJa;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(japanese, temperatureJa);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/**
 * Anything only Japanese would write: hiragana, katakana and the two CJK
 * ideograph blocks a modern Japanese text draws on. A kanji is shared with
 * Chinese, so what this catches is "a CJK word leaked into the language-free
 * half" rather than "a *Japanese* word did" — the only claim a script test can
 * honestly make.
 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/u;

describe("temperature ja vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureJa.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureJa) expect(vocabulary.locale).toBe("ja");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingJa?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaJa?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureJa) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.length,
          `${vocabulary.kind}:${unit} has no aliases`,
        ).toBeGreaterThan(0);
        expect(words.symbol, `${vocabulary.kind}:${unit} has no symbol`).toBeDefined();
      }
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets 「20摂氏 + 5華氏」 read its right
  // operand as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, both scripts included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaJa?.units[unit]?.aliases).toEqual(
        readingJa?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a Japanese engine still reads "212 F"; the Japanese half is
    // appended.
    expect(readingJa?.units.c?.aliases).toContain("c");
    expect(readingJa?.units.c?.aliases).toContain("celsius");
    expect(readingJa?.units.c?.aliases).toContain("摂氏");
    expect(deltaJa?.units.k?.aliases).toContain("ケルビン");
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no script but ASCII may reach it.
  // Kana or kanji anywhere in either descriptor would mean a translation had
  // leaked into the half of the package that is supposed to be language-free.
  test("the kinds themselves carry no Japanese word", () => {
    expect(JSON.stringify(temperature)).not.toMatch(JAPANESE);
    expect(JSON.stringify(tempdelta)).not.toMatch(JAPANESE);
  });

  // The per-unit decision is `en`'s and it is re-taken here rather than copied,
  // because Japanese has a reason of its own that English does not: a `forms`
  // entry is printed *after* the number, and 摂氏 goes in front of it — 摂氏20度,
  // never 20摂氏. So a table here would print a word order no Japanese text uses.
  // Asserting it against `en` rather than against `undefined` is what makes the
  // mirror the thing under test: if a later phase gives an English temperature
  // unit words, this fails until Japanese faces the question again.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [ja, en] of [
      [readingJa, readingEn],
      [deltaJa, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(ja?.units[unit]?.forms, `${ja?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(ja?.units[unit]?.forms, `${ja?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `ja` a fraction cannot select a different key — there
    // is only one — so this call confirms the shape rather than a new row, and it
    // can only confirm the absence of a `forms` table besides, since a unit with
    // none is skipped before any key is asked for. That is the honest shape of
    // this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese temperature", () => {
    const e = engine();
    // Japanese in, Latin symbol out, set tight against the number because
    // `japanese.renderQuantity` closes the gap on every branch — which for this
    // kind is what the default would have done anyway, since a symbol was always
    // set tight. The unit that moves is the *word* branch, and this kind has none.
    expect(e.evaluate("20摂氏").formatted).toBe("20°C");
    expect(e.evaluate("100華氏").formatted).toBe("100°F");
    expect(e.evaluate("20セルシウス").formatted).toBe("20°C");
    // The plural boundary, and the point of a symbol-only kind twice over: no
    // `forms` table exists to index, *and* Japanese would have printed the same
    // noun on both sides of it if one did.
    expect(e.evaluate("2ケルビン").formatted).toBe("2K");
    expect(e.evaluate("5ケルビン").formatted).toBe("5K");
    // The fractional row, which in Ukrainian is a genitive singular and here is
    // again just the symbol — with `ja`'s decimal point, which CLDR makes the
    // same "." English uses.
    expect(e.evaluate("1.5ケルビン").formatted).toBe("1.5K");
    // A conversion, read with を — the Japanese `in` keyword, and a postposition
    // on the *left* operand, which is exactly where an infix operator goes. Both
    // operands' words come from this file; the offsets come from the kind.
    expect(e.evaluate("300Kを摂氏").formatted).toBe("26.85°C");
    expect(e.evaluate("212Fを摂氏").formatted).toBe("100°C");
    // から is the other spelling of `in` this language lists — it means "from",
    // and marks the source, which is why it lands in the same infix position.
    expect(e.evaluate("20摂氏から華氏").formatted).toBe("68°F");
    // A conversion whose result groups. Unlike Ukrainian's U+00A0 this survives
    // NFKC, so the grouped string reads straight back (the round-trip below
    // includes it).
    expect(e.evaluate("5000摂氏を華氏").formatted).toBe("9,032°F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30摂氏 - 20摂氏");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // The single commonest Japanese spelling of a temperature, and this file adds
  // no word for it: 「20℃」 is U+2103, whose NFKC decomposition is `°C`, and
  // `normalize()` runs NFKC before the lexer sees a word. `parse/lex.ts` then
  // skips `°` and offers the bare "c", which `units.ts` already lists. Pinned
  // rather than trusted, because the tempting "fix" is to add a `℃` alias that
  // could never be produced.
  test("℃ and ℉ read through NFKC, not through an alias", () => {
    const aliases = readingJa?.units.c?.aliases ?? [];
    expect(aliases).not.toContain("℃");
    expect(aliases).not.toContain("°c摂氏");
    expect(engine().evaluate("20℃").formatted).toBe("20°C");
    expect(engine().evaluate("20℉").formatted).toBe("20°F");
  });

  // Two Japanese spellings this vocabulary deliberately does not claim, recorded
  // as live assertions rather than left in a comment — following
  // `@smartput/power`'s "к.с." precedent: an alias the lexer cannot produce is
  // dead weight that reads as coverage, and an alias two kinds want is worse.
  test("records the Japanese spellings it will not claim", () => {
    const aliases = readingJa?.units.c?.aliases ?? [];
    // 度 is what a Japanese speaker actually says — 「20度」 is a temperature to
    // any reader — and it is `@smartput/angle`'s word for the angular degree in
    // the identical spelling. One token, no context to separate them, and the
    // ambiguity is real in the source language too. Left to angle rather than
    // made a temperature candidate in every composed Japanese engine.
    expect(aliases).not.toContain("度");
    expect(() => engine().evaluate("20度")).toThrow();
    // ファーレンハイト is the katakana transcription of Fahrenheit, and ICU cuts it
    // into three: an alias for it could never be produced by `japanese.segment`.
    // 華氏 is whole, and is what a Japanese reader writes anyway.
    expect(japanese.segment?.("ファーレンハイト")).toEqual(["ファーレン", "ハイ", "ト"]);
    expect(readingJa?.units.f?.aliases).not.toContain("ファーレンハイト");
    expect(japanese.segment?.("摂氏")).toEqual(["摂氏"]);
    expect(japanese.segment?.("セルシウス")).toEqual(["セルシウス"]);
  });

  // `japanese.selectForm` still answers for these units — it is a function of the
  // slot and the count, and knows nothing about which units have tables — so the
  // reason no grammar is exercised here is the missing `forms`, not a missing
  // key. Pinning that keeps the output assertions above honest: they say the
  // printed string does not move across the plural boundary, and this says why.
  test("selectForm still produces the one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      japanese.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
          key(undefined, "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(["other"]);
    expect(readingJa?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is included, unlike Ukrainian's: `ja` groups with
    // "," and NFKC leaves it alone, so "9,032°F" reaches `lex` intact where
    // "9 032°F" would have arrived as two numbers.
    for (const input of [
      "20摂氏",
      "1.5ケルビン",
      "100華氏",
      "300Kを摂氏",
      "5000摂氏を華氏",
      "30摂氏 - 20摂氏",
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
