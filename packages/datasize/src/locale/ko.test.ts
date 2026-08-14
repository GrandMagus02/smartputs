import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeKo from "./ko";

const locale = () => composeLocale(korean, [datasizeKo]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `korean.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        korean.selectForm({
          count: new Decimal(count),
          kind: "datasize",
          unit: "gb",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => korean.selectForm({ kind: "datasize", unit: "gb", slot })),
    )
    .concat(
      // The binary family declares no forms at all, so sweep the key set on a
      // unit that does and on one that does not — `selectForm` is handed the
      // unit id and could in principle branch on it.
      SLOTS.map((slot) => korean.selectForm({ kind: "datasize", unit: "kib", slot })),
    ),
);

/** Hangul — the one script Korean writes its own words in. */
const HANGUL = /\p{Script=Hangul}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = korean.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "datasize",
    unit,
    slot,
  });
  return (datasizeKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

const DECIMAL = ["b", "kb", "mb", "gb", "tb"] as const;
const BINARY = ["kib", "mib", "gib", "tib"] as const;

describe("datasize ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // The script as a class rather than a list of the words: the kind is nine
    // ratios, nine unit ids and the magnitude bands, so any Hangul syllable
    // reaching it is the failure.
    expect(JSON.stringify(datasize)).not.toMatch(HANGUL);
  });

  test("one key, and exactly that key on every unit that declares a table", () => {
    // The contract the language author pinned: Korean marks number nowhere on a
    // noun, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants a
    // `forms` table to hold exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    for (const unit of DECIMAL) {
      expect(Object.keys(datasizeKo.units[unit]?.forms ?? {}), unit).toEqual([...KEYS]);
    }
    // And the binary family declares none, which is the register split the file
    // argues: the IEC prefixes exist to be told apart from the decimal ones, and
    // the Latin symbol is where Korean keeps that visible.
    for (const unit of BINARY) {
      expect(datasizeKo.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("one word covers every count", () => {
    // The whole of Korean number agreement, in four assertions. English needs
    // "gigabyte" beside "gigabytes" and Ukrainian needs four nominative rows and
    // four locative ones; Korean needs one word, and the count-free conversion
    // target takes the same one.
    expect(word("gb", 1)).toBe("기가바이트");
    expect(word("gb", 21)).toBe("기가바이트");
    expect(word("gb", 1.5)).toBe("기가바이트");
    expect(word("gb", undefined, "conversion-target")).toBe("기가바이트");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(datasizeKo.units)) {
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

  test("no segmenter stands between these words and the index", () => {
    // The measurement `ja.ts` spends most of its length on, and its Korean
    // answer: there is nothing to measure. Korean is spaced, `lex` has already
    // cut at every space, and `korean.segment` is undefined — so a compound
    // written as one word reaches the alias index as one token by construction.
    // This is why 테라바이트 is a printed form here and had to be dropped from
    // `ja.ts` even as an alias.
    expect(korean.segment).toBeUndefined();
    const icu = new Intl.Segmenter("ko", { granularity: "word" });
    for (const word of ["테라바이트", "키비바이트", "기가바이트"]) {
      expect([...icu.segment(word)].map((s) => s.segment)).toEqual([word]);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Korean folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean datasize", () => {
    // Nothing between the number and the word: `korean.renderQuantity` closes
    // the gap on every branch, which is 한글 맞춤법 §43's proviso for a unit
    // after Arabic numerals and what every Korean product page prints.
    expect(engine.evaluate("2기가바이트").formatted).toBe("2기가바이트");
    expect(engine.evaluate("1.5기가바이트").formatted).toBe("1.5기가바이트");
    // Latin in, Hangul out: the form outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("512 mb").formatted).toBe("512메가바이트");
    // The binary family goes the other way — the calque reads, the IEC symbol
    // prints.
    expect(engine.evaluate("1024키비바이트").formatted).toBe("1,024KiB");
    // A conversion, with the source particle on a Latin stem (where it reaches
    // the parser as its own token) and the target particle glued to a Hangul one
    // (where `particleStripper` peels it). 메가바이트 ends in an open syllable,
    // so 로 is the grammatical shape and 으로 is not.
    expect(engine.evaluate("2gb를 메가바이트로").formatted).toBe("2,000메가바이트");
    expect(() => engine.evaluate("2gb를 메가바이트으로")).toThrow();
    // A sum landing on a fraction. Korean groups with "," and marks the decimal
    // with "." — the same visible pair as English, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1기가바이트 + 500메가바이트").formatted).toBe(
      "1.5기가바이트",
    );
    // The Sino-Korean numerals: 삼 is three, parsed by `koreanNumerals` and not
    // by any digit rule. The space is not optional — a numeral written up
    // against its unit is one letter run and therefore one word token, which is
    // a limitation of `lex` rather than of this vocabulary.
    expect(engine.evaluate("삼 기가바이트").formatted).toBe("3기가바이트");
    // And the myriad grouping, which is the shape Korean spells a large number
    // in: 한글 맞춤법 §44 breaks at 만 rather than at every thousand.
    expect(engine.evaluate("일억 이천삼백사십오만 육천칠백팔십구 바이트").formatted).toBe(
      "123,456,789바이트",
    );
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "2기가바이트",
      "1.5기가바이트",
      "512 mb",
      "1024키비바이트",
      "2gb를 메가바이트로",
      "1기가바이트 + 500메가바이트",
      "삼 기가바이트",
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
