import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureZh from "./zh";

const [readingZh, deltaZh] = temperatureZh;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(chinese, temperatureZh);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/**
 * Han, the only script this language writes its words in. A Han character is
 * shared with Japanese and Korean, so what this catches is "a CJK word leaked
 * into the language-free half" rather than "a *Chinese* word did" — the only
 * claim a script test can honestly make.
 */
const CHINESE = /\p{Script=Han}/u;

describe("temperature zh vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureZh.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureZh) expect(vocabulary.locale).toBe("zh");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingZh?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaZh?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureZh) {
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
  // same words on purpose — that is what lets 「20摄氏 + 5华氏」 read its right
  // operand as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, both scripts included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaZh?.units[unit]?.aliases).toEqual(
        readingZh?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a Chinese engine still reads "212 F"; the Chinese half is
    // appended.
    expect(readingZh?.units.c?.aliases).toContain("c");
    expect(readingZh?.units.c?.aliases).toContain("celsius");
    expect(readingZh?.units.c?.aliases).toContain("摄氏");
    expect(deltaZh?.units.k?.aliases).toContain("开");
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no script but ASCII may reach it. A
  // Han character anywhere in either descriptor would mean a translation had
  // leaked into the half of the package that is supposed to be language-free.
  test("the kinds themselves carry no Chinese word", () => {
    expect(JSON.stringify(temperature)).not.toMatch(CHINESE);
    expect(JSON.stringify(tempdelta)).not.toMatch(CHINESE);
  });

  // The per-unit decision is `en`'s and it is re-taken here rather than copied,
  // because Chinese has a reason of its own that English does not: a `forms`
  // entry is printed *after* the number, and 摄氏 goes in front of it — 摄氏20度,
  // never 20摄氏. Asserting it against `en` rather than against `undefined` is
  // what makes the mirror the thing under test: if a later phase gives an English
  // temperature unit words, this fails until Chinese faces the question again.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [zh, en] of [
      [readingZh, readingEn],
      [deltaZh, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(zh?.units[unit]?.forms, `${zh?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(zh?.units[unit]?.forms, `${zh?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // 开 is the one Chinese word here that legitimately follows a number, so it is
  // the one entry that *could* have carried a `forms` row — and it deliberately
  // does not. Giving kelvin alone a table would print 「300开」 beside 「20°C」 and
  // 「68°F」, one unit of a three-unit scale family answering in a different
  // register from its siblings. Pinned separately from the blanket assertion
  // above, because this is the row where the decision was actually taken.
  test("kelvin's post-numeral word is still not a printed form", () => {
    expect(readingZh?.units.k?.aliases).toContain("开");
    expect(readingZh?.units.k?.forms).toBeUndefined();
    expect(engine().evaluate("300开").formatted).toBe("300K");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `zh` a fraction cannot select a different key — there
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

  test("an engine built from it reads and writes Chinese temperature", () => {
    const e = engine();
    // Chinese in, Latin symbol out, set tight against the number because
    // `chinese.renderQuantity` closes the gap on every branch — which for this
    // kind is what the default would have done anyway, since a symbol was always
    // set tight. The branch that moves is the *word* branch, and this kind has
    // none.
    expect(e.evaluate("20摄氏").formatted).toBe("20°C");
    expect(e.evaluate("100华氏").formatted).toBe("100°F");
    // The plural boundary, and the point of a symbol-only kind twice over: no
    // `forms` table exists to index, *and* Chinese would have printed the same
    // noun on both sides of it if one did.
    expect(e.evaluate("2开").formatted).toBe("2K");
    expect(e.evaluate("5开").formatted).toBe("5K");
    // The fractional row, which in Ukrainian is a genitive singular and here is
    // again just the symbol — with `zh`'s decimal point, which CLDR makes the
    // same "." English uses.
    expect(e.evaluate("1.5开").formatted).toBe("1.5K");
    // A conversion, read with 到 — one of the four `in` words this language
    // declares, and an ordinary infix particle rather than Japanese's
    // postposition. Both operands' words come from this file; the offsets come
    // from the kind.
    expect(e.evaluate("300K到摄氏").formatted).toBe("26.85°C");
    expect(e.evaluate("212F到摄氏").formatted).toBe("100°C");
    // 为 is the second particle, and 换算 the verb that introduces a conversion on
    // its own — a unit has to be reachable through each.
    expect(e.evaluate("20摄氏为华氏").formatted).toBe("68°F");
    expect(e.evaluate("20摄氏换算华氏").formatted).toBe("68°F");
    // A conversion whose result groups. Unlike Ukrainian's U+00A0 this survives
    // NFKC, so the grouped string reads straight back (the round-trip below
    // includes it).
    expect(e.evaluate("5000摄氏到华氏").formatted).toBe("9,032°F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30摄氏 - 20摄氏");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // A sum written the way Chinese is actually typed — no space anywhere, and the
  // operand spelled in Han numerals. This is the shape `core/locale/zh.test.ts`
  // records as the workaround for the lexer's trailing-digit rule: 「20摄氏加5摄氏」
  // lexes 加5 as one word and never parses, while spelling the operand keeps the
  // whole expression inside one Han run that `chinese.segment` cuts correctly.
  test("an unspaced Chinese sum works whether the operand is spelled or digits", () => {
    // The digits row threw until the lexer learned to end a word at a digit run
    // followed by a letter: 减20 was one word and no operator reached the
    // parser. Both spellings read now, and the spaced form is kept beside them
    // because the fix is additive.
    const e = engine();
    expect(e.evaluate("三十摄氏减二十摄氏").formatted).toBe("10°C");
    expect(e.evaluate("30摄氏减20摄氏").formatted).toBe("10°C");
    expect(e.evaluate("30摄氏 减 20摄氏").formatted).toBe("10°C");
  });

  // The single commonest Chinese spelling of a temperature, and this file adds no
  // word for it: 「20℃」 is U+2103, whose NFKC decomposition is `°C`, and
  // `normalize()` runs NFKC before the lexer sees a word. `parse/lex.ts` then
  // skips `°` and offers the bare "c", which `units.ts` already lists. Pinned
  // rather than trusted, because the tempting "fix" is to add a `℃` alias that
  // could never be produced.
  test("℃ and ℉ read through NFKC, not through an alias", () => {
    const aliases = readingZh?.units.c?.aliases ?? [];
    expect(aliases).not.toContain("℃");
    expect(engine().evaluate("20℃").formatted).toBe("20°C");
    expect(engine().evaluate("20℉").formatted).toBe("20°F");
  });

  // Four Chinese spellings this vocabulary deliberately does not claim, recorded
  // as live assertions rather than left in a comment — following
  // `@smartput/power`'s "к.с." precedent: an alias the lexer cannot produce is
  // dead weight that reads as coverage, and an alias two kinds want is worse.
  test("records the Chinese spellings it will not claim", () => {
    const aliases = readingZh?.units.c?.aliases ?? [];
    // 度 is what a Chinese speaker actually says — 「20度」 is a temperature to any
    // reader — and it is `@smartput/angle`'s word for the angular degree in the
    // identical spelling. One token, no context to separate them, and the
    // ambiguity is real in the source language too. Left to angle rather than
    // made a temperature candidate in every composed Chinese engine.
    expect(aliases).not.toContain("度");
    expect(() => engine().evaluate("20度")).toThrow();
    // 摄氏度 and 华氏度 are the full unit names, degree included, and ICU cuts both
    // after the scale name — so an alias for either could never be produced as a
    // lookup key. The bare scale name is what survives whole.
    expect(chinese.segment?.("摄氏度")).toEqual(["摄氏", "度"]);
    expect(chinese.segment?.("华氏度")).toEqual(["华氏", "度"]);
    expect(aliases).not.toContain("摄氏度");
    // 开尔文 is the full transliteration of Kelvin and the first thing a
    // dictionary offers; ICU shreds it into three. GB 3102 writes the Chinese
    // name as 开[尔文], the brackets meaning the tail is optional, so the bare 开
    // this file lists is the standard's own abbreviation and not a shortening
    // invented here.
    expect(chinese.segment?.("开尔文")).toEqual(["开", "尔", "文"]);
    expect(readingZh?.units.k?.aliases).not.toContain("开尔文");
    expect(() => engine().evaluate("300开尔文")).toThrow();
    // And the two that do survive whole, which is what makes the omissions above
    // segmenter facts rather than opinions about Chinese.
    expect(chinese.segment?.("摄氏")).toEqual(["摄氏"]);
    expect(chinese.segment?.("华氏")).toEqual(["华氏"]);
  });

  // `chinese.selectForm` still answers for these units — it is a function of the
  // slot and the count, and knows nothing about which units have tables — so the
  // reason no grammar is exercised here is the missing `forms`, not a missing
  // key. Pinning that keeps the output assertions above honest: they say the
  // printed string does not move across the plural boundary, and this says why.
  test("selectForm still produces the one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      chinese.selectForm({
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
    // The claim behind the one-key table, measured rather than asserted.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(readingZh?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is included, unlike Ukrainian's: `zh` groups with
    // "," and NFKC leaves it alone, so "9,032°F" reaches `lex` intact where
    // "9 032°F" would have arrived as two numbers.
    for (const input of [
      "20摄氏",
      "1.5开",
      "100华氏",
      "300K到摄氏",
      "5000摄氏到华氏",
      "30摄氏 - 20摄氏",
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
