import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationKo from "./ko";

const locale = () => composeLocale(korean, [durationKo]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `korean.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        korean.selectForm({
          count: new Decimal(count),
          kind: "duration",
          unit: "h",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => korean.selectForm({ kind: "duration", unit: "h", slot })),
    ),
);

/** Hangul — the one script Korean writes its own words in. */
const HANGUL = /\p{Script=Hangul}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = korean.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("duration ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // The script as a class rather than a list of the words: the kind is six
    // ratios, six unit ids and the magnitude bands, so any Hangul syllable
    // reaching it is the failure.
    expect(JSON.stringify(duration)).not.toMatch(HANGUL);
  });

  test("every unit declares exactly the one key `korean` can ask for", () => {
    // The contract the language author pinned: Korean marks number nowhere on a
    // noun, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants a
    // `forms` table to hold exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    for (const [unit, words] of Object.entries(durationKo.units)) {
      expect(Object.keys(words.forms ?? {}), `${unit}`).toEqual([...KEYS]);
    }
  });

  test("one word covers every count", () => {
    // The whole of Korean number agreement, in four assertions. English needs
    // "hour" beside "hours" and Ukrainian needs four nominative rows and four
    // locative ones; Korean needs one word, and the count-free conversion target
    // takes the same one.
    expect(word("h", 1)).toBe("시간");
    expect(word("h", 21)).toBe("시간");
    expect(word("h", 1.5)).toBe("시간");
    expect(word("h", undefined, "conversion-target")).toBe("시간");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(durationKo.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("일 is the Sino-Korean 1 before it is a day, measured rather than remembered", () => {
    // The reason `d` prints 일간 and not the plain 일 that a Korean would write.
    // 일 is a row in `ko-cardinals.ts`'s digit table, and `foldNumerals` runs
    // over the token stream before the alias index is ever consulted: a word
    // token made of nothing but numeral syllables is rewritten into a number.
    expect(korean.numerals?.(["일"])).toEqual({ value: new Decimal(1), consumed: 1 });
    // So 「3일」 lexes as 3 and then as 1 — two adjacent numbers, which the
    // parser refuses. An alias of 일 would pass `assertLocaleContract`, since the
    // alias index has no idea the numeral pass exists, and would still be
    // unreachable from any input.
    expect(() => engine.evaluate("3일")).toThrow();
    const claimed = Object.values(durationKo.units).flatMap((w) => [...w.aliases]);
    expect(claimed, "일 is claimed but unreachable").not.toContain("일");
    // 간 is no numeral, so the span spelling survives the same pass whole.
    expect(korean.numerals?.(["일간"])).toBeNull();
    expect(engine.evaluate("3일간").formatted).toBe("3일간");
  });

  test("no segmenter stands between these words and the index", () => {
    // The measurement `ja.ts` spends a paragraph on for its own `ms`, and its
    // Korean answer: there is nothing to measure. Korean is spaced, `lex` has
    // already cut at every space, and `korean.segment` is undefined. Japanese
    // has the same word for the millisecond — 「ミリ秒」 — and cannot use it,
    // because ICU cuts it at the prefix and the tail reads as seconds; ICU has
    // no Korean dictionary to cut 밀리초 with.
    expect(korean.segment).toBeUndefined();
    const icu = new Intl.Segmenter("ko", { granularity: "word" });
    for (const surface of ["밀리초", "시간", "일간"]) {
      expect([...icu.segment(surface)].map((s) => s.segment)).toEqual([surface]);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Korean folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean duration", () => {
    // Nothing between the number and the word: `korean.renderQuantity` closes
    // the gap on every branch, which is 한글 맞춤법 §43's proviso for a unit
    // after Arabic numerals.
    expect(engine.evaluate("5초").formatted).toBe("5초");
    expect(engine.evaluate("1.5시간").formatted).toBe("1.5시간");
    expect(engine.evaluate("500밀리초").formatted).toBe("500밀리초");
    expect(engine.evaluate("3주").formatted).toBe("3주");
    // The two suffixed week spellings read and the bare one prints.
    expect(engine.evaluate("3주일").formatted).toBe("3주");
    expect(engine.evaluate("2주간").formatted).toBe("2주");
    // Latin in, Hangul out: the form outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("90 min").formatted).toBe("90분");
    // A sum landing on a fraction. Korean groups with "," and marks the decimal
    // with "." — the same visible pair as English, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1시간 + 30분").formatted).toBe("1.5시간");
    // The Sino-Korean numerals: 이십이 is twenty-two, one word to `lex` and one
    // number to `koreanNumerals`. The space before the unit is not optional — a
    // numeral written up against its unit is one letter run and therefore one
    // word token, which is a limitation of `lex` rather than of this vocabulary.
    expect(engine.evaluate("이십이 초").formatted).toBe("22초");
  });

  test("the euphonic conditional decides a conversion, and refuses two", () => {
    // The one place in this repo where a grammatical *condition* is load-bearing
    // at runtime. Korean's directional particle has two shapes: 으로 after a
    // consonant, 로 after a vowel or after ㄹ. `particleStripper` computes which
    // from the 받침 of the syllable in front of it, so the target of a conversion
    // is recognised exactly when it is spelled the way Korean spells it.
    //
    // 분 ends in ㄴ, so it takes 으로 …
    expect(engine.evaluate("2h를 분으로").formatted).toBe("120분");
    // … and 초 ends in a vowel, so it takes 로.
    expect(engine.evaluate("2h를 초로").formatted).toBe("7,200초");
    // The two crossed spellings are ungrammatical and are refused rather than
    // stripped, which is precisely what a flat suffix list could not do.
    expect(() => engine.evaluate("2h를 분로")).toThrow();
    expect(() => engine.evaluate("2h를 초으로")).toThrow();
    // The source particle is the one that has to reach the parser as a token of
    // its own, and it does so only because the stem in front of it is Latin —
    // the seam `ko.ts` reports as core's to widen, since 「2시간을 분으로」 is
    // what a Korean would actually type and lexes as two glued words with no
    // operator between them.
    expect(() => engine.evaluate("2시간을 분으로")).toThrow();
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5초",
      "1.5시간",
      "500밀리초",
      "3일간",
      "3주",
      "90 min",
      "1시간 + 30분",
      "2h를 분으로",
      "이십이 초",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
