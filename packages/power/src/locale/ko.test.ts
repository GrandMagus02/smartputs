import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerKo from "./ko";

const locale = () => composeLocale(korean, [powerKo]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `korean.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        korean.selectForm({
          count: new Decimal(count),
          kind: "power",
          unit: "kw",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(SLOTS.map((slot) => korean.selectForm({ kind: "power", unit: "kw", slot }))),
);

/** Hangul — the one script Korean writes its own words in. */
const HANGUL = /\p{Script=Hangul}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = korean.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

const WATTS = ["w", "kw", "mw", "gw"] as const;

describe("power ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // The script as a class rather than a list of the words: the kind is five
    // ratios, five unit ids and the magnitude bands, so any Hangul syllable
    // reaching it is the failure.
    expect(JSON.stringify(power)).not.toMatch(HANGUL);
  });

  test("one key, and exactly that key on every unit that declares a table", () => {
    // The contract the language author pinned: Korean marks number nowhere on a
    // noun, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants a
    // `forms` table to hold exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    for (const unit of WATTS) {
      expect(Object.keys(powerKo.units[unit]?.forms ?? {}), unit).toEqual([...KEYS]);
    }
    // 마력 is at once the word and the abbreviation, so `symbol` carries both and
    // a form row would be the same string twice — with identical output, since
    // `korean.renderQuantity` puts nothing between a number and its label.
    expect(powerKo.units.hp?.forms).toBeUndefined();
    expect(powerKo.units.hp?.symbol).toBe("마력");
  });

  test("one word covers every count", () => {
    // The whole of Korean number agreement, in four assertions. English needs
    // "kilowatt" beside "kilowatts" and Ukrainian needs four nominative rows and
    // four locative ones; Korean needs one word, and the count-free conversion
    // target takes the same one.
    expect(word("kw", 1)).toBe("킬로와트");
    expect(word("kw", 21)).toBe("킬로와트");
    expect(word("kw", 1.5)).toBe("킬로와트");
    expect(word("kw", undefined, "conversion-target")).toBe("킬로와트");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(powerKo.units)) {
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

  test("기가와트 is claimable here and is not in `ja.ts`, which is the whole difference", () => {
    // `ja.ts` next door prints the SI symbols for its entire watt family for one
    // reason: ICU's Japanese dictionary cuts ギガワット into ギガ + ワット, and a
    // family spells itself out only when every member survives. Korean is
    // spaced, `korean.segment` is undefined, and `lex` has already cut at every
    // space — so no dictionary is consulted and none can veto a row.
    expect(korean.segment).toBeUndefined();
    const icu = new Intl.Segmenter("ko", { granularity: "word" });
    for (const surface of ["와트", "킬로와트", "메가와트", "기가와트", "마력"]) {
      expect([...icu.segment(surface)].map((s) => s.segment)).toEqual([surface]);
    }
    expect(word("gw", 1)).toBe("기가와트");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Korean folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean power", () => {
    // Nothing between the number and the word: `korean.renderQuantity` closes
    // the gap on every branch, which is 한글 맞춤법 §43's proviso for a unit
    // after Arabic numerals.
    expect(engine.evaluate("60와트").formatted).toBe("60와트");
    expect(engine.evaluate("1.5기가와트").formatted).toBe("1.5기가와트");
    expect(engine.evaluate("150마력").formatted).toBe("150마력");
    // Latin in, Hangul out: the form outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("2 kw").formatted).toBe("2킬로와트");
    // A conversion. 와트 ends in an open syllable, so 로 is the grammatical
    // shape of the directional particle and `particleStripper` peels it back to
    // the unit; 마력 ends in ㄱ and takes 으로 instead. Both are computed from
    // the syllable's codepoint rather than from a list, and the crossed
    // spellings are refused.
    expect(engine.evaluate("1kw를 와트로").formatted).toBe("1,000와트");
    expect(() => engine.evaluate("1kw를 와트으로")).toThrow();
    expect(() => engine.evaluate("1kw를 마력로")).toThrow();
    // A sum landing on a fraction. Korean groups with "," and marks the decimal
    // with "." — the same visible pair as English, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1킬로와트 + 500와트").formatted).toBe("1.5킬로와트");
    // The Sino-Korean numerals: 육십 is sixty, parsed by `koreanNumerals` and not
    // by any digit rule. The space before the unit is not optional — a numeral
    // written up against its unit is one letter run and therefore one word
    // token, which is a limitation of `lex` rather than of this vocabulary.
    expect(engine.evaluate("육십 와트").formatted).toBe("60와트");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "60와트",
      "1.5기가와트",
      "150마력",
      "2 kw",
      "1kw를 와트로",
      "1킬로와트 + 500와트",
      "육십 와트",
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
