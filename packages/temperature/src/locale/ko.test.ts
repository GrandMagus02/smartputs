import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureKo from "./ko";

const [readingKo, deltaKo] = temperatureKo;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(korean, temperatureKo);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/**
 * Hangul, and nothing else. Where the Japanese regex in the sibling file can only
 * claim "a CJK word leaked into the language-free half" — a kanji is shared with
 * Chinese — a Hangul test is exact: the script writes Korean and no other living
 * language, so a match here really is a Korean word in the wrong half.
 */
const HANGUL = /\p{Script=Hangul}/u;

describe("temperature ko vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureKo.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureKo) expect(vocabulary.locale).toBe("ko");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingKo?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaKo?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureKo) {
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
  // same words on purpose — that is what lets 「20섭씨 더하기 5화씨」 read its right
  // operand as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written against.
  // Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, both scripts included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaKo?.units[unit]?.aliases).toEqual(
        readingKo?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a Korean engine still reads "212 F"; the Korean half is appended.
    expect(readingKo?.units.c?.aliases).toContain("c");
    expect(readingKo?.units.c?.aliases).toContain("celsius");
    expect(readingKo?.units.c?.aliases).toContain("섭씨");
    expect(deltaKo?.units.k?.aliases).toContain("켈빈");
  });

  test("the kinds themselves carry no Korean word", () => {
    expect(JSON.stringify(temperature)).not.toMatch(HANGUL);
    expect(JSON.stringify(tempdelta)).not.toMatch(HANGUL);
  });

  // The per-unit decision is `en`'s and it is re-taken here rather than copied,
  // because Korean has a reason of its own that English does not — the same one
  // Japanese has, and for the same shared history: a `forms` entry is printed
  // *after* the number, and 섭씨 goes in front of it. 섭씨 20도, never 20섭씨.
  // Asserting it against `en` rather than against `undefined` is what makes the
  // mirror the thing under test: if a later phase gives an English temperature unit
  // words, this fails until Korean faces the question again.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [ko, en] of [
      [readingKo, readingEn],
      [deltaKo, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(ko?.units[unit]?.forms, `${ko?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(ko?.units[unit]?.forms, `${ko?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional reading
    // at all. Under `ko` a fraction cannot select a different key — there is only
    // one — so this call confirms the shape rather than a new row, and it can only
    // confirm the absence of a `forms` table besides, since a unit with none is
    // skipped before any key is asked for. That is the honest shape of this kind's
    // coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean temperature", () => {
    const e = engine();
    // Korean in, Latin symbol out, set tight against the number because
    // `korean.renderQuantity` closes the gap on every branch — which for this kind
    // is what the default would have done anyway, since a symbol was always set
    // tight. The branch that moves is the *word* one, and this kind has none.
    expect(e.evaluate("20섭씨").formatted).toBe("20°C");
    expect(e.evaluate("100화씨").formatted).toBe("100°F");
    // The plural boundary, and the point of a symbol-only kind twice over: no
    // `forms` table exists to index, *and* Korean would have printed the same noun
    // on both sides of it if one did.
    expect(e.evaluate("2켈빈").formatted).toBe("2K");
    expect(e.evaluate("5켈빈").formatted).toBe("5K");
    // The fractional row, which in Ukrainian is a genitive singular and here is
    // again just the symbol — with `ko`'s decimal point, which CLDR makes the same
    // "." English uses.
    expect(e.evaluate("1.5켈빈").formatted).toBe("1.5K");
    // A conversion. 를/을 is Korean's `in` keyword — the accusative particle on the
    // *left* operand, which is exactly where an infix operator goes — and it splits
    // off a Latin stem by itself, because the script boundary ends the word token.
    expect(e.evaluate("300K를 섭씨").formatted).toBe("26.85°C");
    expect(e.evaluate("212F를 섭씨").formatted).toBe("100°C");
    // 에서 is another spelling of `in` this language lists — it means "from", and
    // marks the source, which is why it lands in the same infix position.
    expect(e.evaluate("20섭씨 에서 화씨").formatted).toBe("68°F");
    // A conversion whose result groups. Unlike Ukrainian's U+00A0 this survives
    // NFKC, so the grouped string reads straight back (the round-trip below
    // includes it).
    expect(e.evaluate("5000섭씨 를 화씨").formatted).toBe("9,032°F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30섭씨 - 20섭씨");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
    // A sum that lands on a fraction, across the two scales — the case the shared
    // alias list exists for, since the right operand has to read as a difference.
    expect(e.evaluate("20섭씨 더하기 5화씨").value?.canonical.toFixed(4)).toBe("22.7778");
  });

  // The single commonest Korean spelling of a temperature, and this file adds no
  // word for it: 「20℃」 is U+2103, whose NFKC decomposition is `°C`, and
  // `normalize()` runs NFKC before the lexer sees a word. `parse/lex.ts` then skips
  // `°` and offers the bare "c", which `units.ts` already lists. Pinned rather than
  // trusted, because the tempting "fix" is to add a `℃` alias that could never be
  // produced.
  test("℃ and ℉ read through NFKC, not through an alias", () => {
    const aliases = readingKo?.units.c?.aliases ?? [];
    expect(aliases).not.toContain("℃");
    expect(engine().evaluate("20℃").formatted).toBe("20°C");
    expect(engine().evaluate("20℉").formatted).toBe("20°F");
  });

  // The directional particle, glued to the target the way Korean writes it, and
  // the euphonic conditional doing real work: 쿄-like open syllables take 로 and
  // closed ones take 으로. 씨 is open, 빈 closes in ㄴ, and each refuses the other's
  // shape — which a flat suffix list would have stripped happily.
  test("a glued target particle is stripped, on the euphonic condition", () => {
    const e = engine();
    expect(e.evaluate("20 c를 화씨로").formatted).toBe("68°F");
    expect(e.evaluate("100 c를 켈빈으로").formatted).toBe("373.15K");
    // 켈빈 ends in a consonant, so 로 alone is not Korean after it.
    expect(() => e.evaluate("20섭씨 를 켈빈로")).toThrow();
    // And the shape that is Korean, spaced source particle and glued target one.
    expect(e.evaluate("20섭씨 를 켈빈으로").formatted).toBe("293.15K");
  });

  // Two Korean spellings this vocabulary deliberately does not claim, recorded as
  // live assertions rather than left in a comment — following `@smartput/power`'s
  // "к.с." precedent: an alias the lexer cannot produce is dead weight that reads
  // as coverage, and an alias two kinds want is worse.
  test("records the Korean spellings it will not claim", () => {
    const aliases = readingKo?.units.c?.aliases ?? [];
    // 도 is what a Korean speaker actually says — 「20도」 is a temperature to any
    // reader — and it is `@smartput/angle`'s word for the angular degree in the
    // identical spelling. One token, no context to separate them, and the ambiguity
    // is real in the source language too. Left to angle rather than made a
    // temperature candidate in every composed Korean engine.
    expect(aliases).not.toContain("도");
    expect(() => engine().evaluate("20도")).toThrow();
    // 섭씨 20도 is the ordinary written form and it is three tokens with the number
    // in the middle, which is why no alias and no `forms` entry can carry it. This
    // is the word-order fact the file's "no forms" decision rests on, asserted so
    // it cannot quietly stop being true.
    expect(() => engine().evaluate("섭씨 20도")).toThrow();
  });

  // Unlike `ja`, this table needed no segmenter check before a word could be
  // written down: Korean is spaced, `lex` has already cut at every space, and ICU
  // hands a Hangul run back whole. So the limit on a Korean alias is the space, and
  // the two-word names are the ones that cannot be listed — not the ones ICU
  // happens to dislike. Pinned, because it is the assumption a reader arriving from
  // `ja.ts` or `zh.ts` will carry over wrongly.
  test("Korean needs no segmenter, so a one-word alias is always listable", () => {
    expect(korean.segment).toBeUndefined();
    const words = (run: string) =>
      [...new Intl.Segmenter("ko", { granularity: "word" }).segment(run)]
        .filter((s) => s.isWordLike)
        .map((s) => s.segment);
    expect(words("섭씨")).toEqual(["섭씨"]);
    expect(words("켈빈")).toEqual(["켈빈"]);
  });

  // `korean.selectForm` still answers for these units — it is a function of the
  // slot and the count, and knows nothing about which units have tables — so the
  // reason no grammar is exercised here is the missing `forms`, not a missing key.
  // Pinning that keeps the output assertions above honest: they say the printed
  // string does not move across the plural boundary, and this says why.
  test("selectForm still produces the one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      korean.selectForm({
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
    expect(readingKo?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is included, unlike Ukrainian's: `ko` groups with ","
    // and NFKC leaves it alone, so "9,032°F" reaches `lex` intact where "9 032°F"
    // would have arrived as two numbers.
    for (const input of [
      "20섭씨",
      "1.5켈빈",
      "100화씨",
      "300K를 섭씨",
      "5000섭씨 를 화씨",
      "30섭씨 - 20섭씨",
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
