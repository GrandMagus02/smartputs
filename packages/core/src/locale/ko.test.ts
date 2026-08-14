import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { AnalyzeCtx, Slot } from "../types";
import { korean } from "./ko";
import { koreanSpeller, parseKoreanNumeral } from "./ko-cardinals";
import { numberSymbols } from "./number";

const form = (n?: number, slot: Slot = "bare") =>
  korean.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and the count-free
    // row of ruling R5 is the absent one.
    ...(n === undefined ? {} : { count: new Decimal(n) }),
    kind: "mass",
    unit: "kg",
    slot,
  });

const spell = (n: number) => korean.spell?.(new Decimal(n));
const read = (...words: string[]) => korean.numerals?.(words);

/** Every form the analyzer chain produces for one word, in chain order. */
const forms = (surface: string): string[] => {
  const ctx: AnalyzeCtx = { locale: "ko", words: [surface], index: 0 };
  return (korean.analyze ?? []).flatMap((a) => a(surface, ctx)).map((f) => f.form);
};

describe("korean", () => {
  test("has exactly one form key, for every count and every slot", () => {
    expect(korean.id).toBe("ko");
    // The contract three vocabularies will be keyed off, written out rather
    // than described: a `ko` vocabulary needs a `forms` table of one row, keyed
    // "other", and there is no count and no slot that can ask it for a second.
    // The count column is deliberately exhaustive of the shapes that move `en`
    // and `uk`: singular, the 2/5/21/22 boundaries Slavic grammar cares about, a
    // fraction, and zero.
    const keys = new Set(
      [0, 1, 1.5, 2, 5, 21, 22, 100, 2000].flatMap((n) => [
        form(n),
        form(n, "after-number"),
        form(n, "conversion-target"),
      ]),
    );
    expect([...keys]).toEqual(["other"]);
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    expect(form(undefined, "conversion-target")).toBe("other");
    expect(form(undefined)).toBe("other");
  });

  test('CLDR agrees that "other" is the only category ko has', () => {
    // Why `selectForm` returns a constant instead of calling `Intl.PluralRules`
    // the way `en` and `uk` do. Pinned rather than trusted: if a runtime ever
    // gave `ko` a second category, this is the line that would say so.
    expect(new Intl.PluralRules("ko").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("takes its number symbols from CLDR", () => {
    // Both visible ASCII here, unlike `uk`'s U+00A0 group separator, so there is
    // nothing to escape — and they are the same pair `en` and `ja` produce,
    // which is exactly why this is pinned rather than transcribed into a
    // hand-written `NumberFormatSpec`.
    expect(numberSymbols(korean)).toEqual({ group: ",", decimal: "." });
  });

  test("ships no segmenter, because Korean is spaced", () => {
    // The assumption a reader arriving from `ja.ts` or `zh.ts` carries over
    // wrongly, pinned as an absence.
    expect(korean.segment).toBeUndefined();
    // And the measurement behind it: with no hook installed `lex` falls back to
    // `Intl.Segmenter`, which has no Korean dictionary and returns a Hangul run
    // whole — so a hook could only ask ICU to invent breaks it does not have.
    const segmenter = new Intl.Segmenter("ko", { granularity: "word" });
    const cut = (text: string) => [...segmenter.segment(text)].map((s) => s.segment);
    expect(cut("킬로그램을")).toEqual(["킬로그램을"]);
    expect(cut("이십이")).toEqual(["이십이"]);
    expect(cut("일억이천삼백사십오만육천칠백팔십구")).toEqual([
      "일억이천삼백사십오만육천칠백팔십구",
    ]);
    // The one break it does make, and this language depends on it twice: the
    // script boundary. A particle glued to a Latin symbol arrives as its own
    // token, which is what lets `keywords.in` claim it.
    expect(cut("kg를")).toEqual(["kg", "를"]);
    expect(cut("kg으로")).toEqual(["kg", "으로"]);
  });

  test("strips a bound particle, and honours the euphonic conditional", () => {
    // 램 ends in ㅁ, so it takes the consonant shapes: 으로 and 을.
    expect(forms("킬로그램으로")).toContain("킬로그램");
    expect(forms("킬로그램을")).toContain("킬로그램");
    // 터 ends in its vowel, so it takes the vowel shapes: 로 and 를.
    expect(forms("미터로")).toContain("미터");
    expect(forms("미터를")).toContain("미터");
    // The refusals — the whole point of implementing the alternation rather
    // than listing the four surfaces flat. Neither of these is Korean, and
    // without the condition both would strip to a stem that resolves.
    expect(forms("미터으로")).not.toContain("미터");
    expect(forms("킬로그램로")).not.toContain("킬로그램");
    expect(forms("미터을")).not.toContain("미터");
    expect(forms("킬로그램를")).not.toContain("킬로그램");
    // ㄹ is the one 받침 that behaves like a vowel: 서울로, never 서울으로.
    expect(forms("서울로")).toContain("서울");
    expect(forms("서울으로")).not.toContain("서울");
    // A single-syllable unit noun survives, which is why there is no `minStem`
    // floor: 원, 초, 분 and 도 are all real Korean units.
    expect(forms("분으로")).toContain("분");
    expect(forms("초로")).toContain("초");
    expect(forms("원으로")).toContain("원");
    // A stem with no Hangul in it has no written final consonant to test, so
    // every particle is accepted after it — real input writes both.
    expect(forms("kg를")).toContain("kg");
    expect(forms("kg을")).toContain("kg");
    // The chain always offers the surface itself first, which is how an
    // unparticled word reaches its own alias at all.
    expect(forms("킬로그램")[0]).toBe("킬로그램");
    // Every matching particle yields a form, so a word ending in 으로 also
    // yields the stem 로 alone would have left. The junk form is harmless — the
    // resolver only keeps forms that hit a registered alias — and it is pinned
    // here so the choice reads as deliberate rather than accidental.
    expect(forms("그램으로")).toEqual(["그램으로", "그램", "그램으"]);
    // A bare particle never strips to an empty stem.
    expect(forms("으로")).not.toContain("");
  });

  test("claims the source particles and nothing that marks a target", () => {
    // 을/를/에서 attach to the left operand, so they land where an infix
    // operator goes. 로/으로 attach to the target and would arrive after it,
    // where the parser leaves them unconsumed — see the keyword table's comment.
    expect(korean.keywords.in).toEqual(["을", "를", "에서"]);
    expect(korean.keywords.in).not.toContain("로");
    expect(korean.keywords.in).not.toContain("으로");
    // Refused on the other ground: 은/는 and 이/가 are among the commonest
    // particles in the language. The stripper still removes them.
    expect(korean.keywords.in).not.toContain("는");
    expect(korean.keywords.in).not.toContain("가");
    // Head-final word order puts the base in front of the percentage in both
    // 50의 20% and 50달러에서 20% 할인, which is the operand order this engine's
    // `of`/`off` cannot express. Declared absent rather than left to drift.
    expect(korean.keywords.of).toBeUndefined();
    expect(korean.keywords.off).toBeUndefined();
    expect(korean.keywords.by).toBeUndefined();
    // Arithmetic is the fortunate exception: these nominalised verbs are infix.
    expect(korean.keywords.times).toEqual(["곱하기"]);
    expect(korean.keywords.plus).toContain("더하기");
  });

  test("reads Sino-Korean numerals", () => {
    expect(read("이십이")).toEqual({ value: new Decimal(22), consumed: 1 });
    // A bare sub-myriad scale means one, at every position and not only at the
    // head: 십 is 10, 백십오 is 115, 천백 is 1100.
    expect(read("십")).toEqual({ value: new Decimal(10), consumed: 1 });
    expect(read("백십오")).toEqual({ value: new Decimal(115), consumed: 1 });
    expect(read("천백")).toEqual({ value: new Decimal(1100), consumed: 1 });
    // Myriad grouping, the thing the shared `cardinalNumerals` could not do: 만
    // is 10⁴, so 십만 is a hundred thousand and not "ten myriad" in thousands.
    expect(read("만")).toEqual({ value: new Decimal(10_000), consumed: 1 });
    expect(read("십만")).toEqual({ value: new Decimal(100_000), consumed: 1 });
    expect(read("일억")).toEqual({ value: new Decimal(100_000_000), consumed: 1 });
    // 한글 맞춤법 §44 spaces a long number at the myriad boundary, so the run
    // arrives as three words and is claimed as one number.
    expect(read("일억", "이천삼백사십오만", "육천칠백팔십구")).toEqual({
      value: new Decimal(123_456_789),
      consumed: 3,
    });
    // The unspaced spelling a casual writer produces reads back just as well.
    expect(read("일억이천삼백사십오만육천칠백팔십구")).toEqual({
      value: new Decimal(123_456_789),
      consumed: 1,
    });
    // 영 is the word for zero; 공 is the read-aloud digit of a phone number.
    expect(read("영")).toEqual({ value: new Decimal(0), consumed: 1 });
    expect(read("공")).toEqual({ value: new Decimal(0), consumed: 1 });
    // 륙 is 6 for reading only — the North Korean spelling and the one that
    // survives in fixed compounds, which a reader cannot rule out.
    expect(read("륙십")).toEqual({ value: new Decimal(60), consumed: 1 });
    // Claims a prefix and stops: a unit word is not made of numeral syllables.
    expect(read("오", "킬로그램")).toEqual({ value: new Decimal(5), consumed: 1 });
    expect(read("킬로그램")).toBeNull();
  });

  test("refuses what is spelled out of numeral syllables but is not a number", () => {
    // Two digits in a row. Korean has no positional numeral writing — there is
    // no Hangul 二〇二五 — so 이이 is a read-aloud digit string, not 22.
    expect(parseKoreanNumeral("이이")).toBeNull();
    expect(parseKoreanNumeral("공일공")).toBeNull();
    // A sub-myriad scale that does not descend.
    expect(parseKoreanNumeral("십백")).toBeNull();
    expect(parseKoreanNumeral("십십")).toBeNull();
    // A bare myriad scale anywhere but the head: 만억 and 억조 are not Korean.
    expect(parseKoreanNumeral("만억")).toBeNull();
    expect(parseKoreanNumeral("억조")).toBeNull();
    // But a myriad scale with its own multiplier is fine after another.
    expect(parseKoreanNumeral("이억삼만")).toEqual(new Decimal(200_030_000));
  });

  test("spells back through the same table", () => {
    expect(spell(22)).toBe("이십이");
    expect(spell(0)).toBe("영");
    // The elision Korean does not share with either neighbour: the 일 goes in
    // front of all three sub-myriad scales, wherever they fall. Chinese writes
    // 一千一百一十一 here and Japanese 千百十一.
    expect(spell(1111)).toBe("천백십일");
    expect(spell(10)).toBe("십");
    expect(spell(115)).toBe("백십오");
    // And the one place it does *not* elide above the group: 만 alone opens a
    // number (만 원 is a ten-thousand-won note), 억 and 조 never stand bare.
    expect(spell(10_000)).toBe("만");
    expect(spell(100_000)).toBe("십만");
    expect(spell(100_000_000)).toBe("일억");
    expect(spell(1_000_000_000_000)).toBe("일조");
    // 한글 맞춤법 §44: groups are spaced at the myriad boundary.
    expect(spell(15_000)).toBe("만 오천");
    expect(spell(123_456_789)).toBe("일억 이천삼백사십오만 육천칠백팔십구");
    // A group of one that is *not* leading keeps its 일.
    expect(spell(100_010_000)).toBe("일억 일만");
    // The three documented declines, mirroring `cardinalSpeller`'s.
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(koreanSpeller(new Decimal("1e16"))).toBeNull();
  });

  test("round-trips every spelled value back through the parser", () => {
    // The property the one-table-two-directions arrangement exists to hold. The
    // sample crosses every boundary in the algorithm: the sub-myriad scales, the
    // 일-dropping rule at both levels, and all three myriad closures.
    for (const n of [
      0, 1, 5, 10, 11, 15, 20, 22, 99, 100, 105, 115, 999, 1000, 1100, 1111, 9999, 10_000,
      10_001, 15_000, 100_000, 100_010_000, 123_456_789, 1_000_000_000_000,
    ]) {
      const written = spell(n);
      expect(written).not.toBeNull();
      // Spelled output is spaced at the myriad boundary, so it re-enters the
      // parser as the several words `lex` would hand over.
      const words = (written as string).split(" ");
      expect(read(...words)).toEqual({
        value: new Decimal(n),
        consumed: words.length,
      });
    }
  });

  test("sets a unit tight against its number", () => {
    const render = korean.renderQuantity;
    expect(
      render?.({
        number: "5",
        form: "킬로그램",
        symbol: "kg",
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("5킬로그램");
    // A Latin symbol is set the same way, which is what the default already did
    // — the override is about the *word* branch.
    expect(
      render?.({ number: "5", symbol: "kg", kind: "mass", unit: "kg", slot: "bare" }),
    ).toBe("5kg");
    // The caller's own separator still wins: `Printer`'s `spacing` is a
    // typographic choice belonging to the caller, not to the language.
    expect(
      render?.({
        number: "5",
        form: "킬로그램",
        gap: " ",
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("5 킬로그램");
    // I10's degradation, for a half-translated vocabulary.
    expect(render?.({ number: "5", kind: "mass", unit: "kg", slot: "bare" })).toBe("5kg");
  });

  test("leaves expression rendering to the default, because Korean spaces words", () => {
    // Where `ja.ts` overrides — 10たす5 closes up — Korean writes 십 더하기 오,
    // which is what `defaultRenderExpression` already produces.
    expect(korean.renderExpression).toBeUndefined();
  });
});
