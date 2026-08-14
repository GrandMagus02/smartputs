import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyKo from "./ko";

const locale = () => composeLocale(korean, [energyKo]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `korean.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        korean.selectForm({
          count: new Decimal(count),
          kind: "energy",
          unit: "kwh",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => korean.selectForm({ kind: "energy", unit: "kwh", slot })),
    ),
);

/** Hangul — the one script Korean writes its own words in. */
const HANGUL = /\p{Script=Hangul}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = korean.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** The families that print a Korean word, and the ones that print a symbol. */
const SPELLED = ["wh", "kwh", "mwh", "cal", "kcal"] as const;
const SYMBOLIC = ["j", "kj", "mj", "btu"] as const;

describe("energy ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // The script as a class rather than a list of the words: the kind is nine
    // ratios, nine unit ids, the magnitude bands and four bridge signatures, so
    // any Hangul syllable reaching it is the failure.
    expect(JSON.stringify(energy)).not.toMatch(HANGUL);
  });

  test("one key, and exactly that key on every unit that declares a table", () => {
    // The contract the language author pinned: Korean marks number nowhere on a
    // noun, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants a
    // `forms` table to hold exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    for (const unit of SPELLED) {
      expect(Object.keys(energyKo.units[unit]?.forms ?? {}), unit).toEqual([...KEYS]);
    }
    // The joule family prints its SI symbols because 줄 is also "line", and
    // `btu` because Korean has no word for it that anyone types.
    for (const unit of SYMBOLIC) {
      expect(energyKo.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("one word covers every count", () => {
    // The whole of Korean number agreement, in four assertions. English needs
    // "calorie" beside "calories" and Ukrainian needs four nominative rows and
    // four locative ones; Korean needs one word, and the count-free conversion
    // target takes the same one.
    expect(word("kcal", 1)).toBe("킬로칼로리");
    expect(word("kcal", 21)).toBe("킬로칼로리");
    expect(word("kcal", 1.5)).toBe("킬로칼로리");
    expect(word("kcal", undefined, "conversion-target")).toBe("킬로칼로리");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(energyKo.units)) {
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

  test("the watt-hour family is one token, which is what Ukrainian and Japanese lost", () => {
    // The row worth measuring rather than remembering. 킬로와트시 has no space in
    // it and no segmenter is consulted, so `lex` hands the alias index one word
    // token and the unit resolves by lookup — no interpunct, no multiplication,
    // no second kind needed. `uk.ts` must print "кВт·год", whose round trip
    // closes only because `* | power | duration` exists, and `ja.ts` cannot
    // print 「メガワット時」 at all because ICU cuts it at the 時.
    expect(korean.segment).toBeUndefined();
    const icu = new Intl.Segmenter("ko", { granularity: "word" });
    for (const surface of ["와트시", "킬로와트시", "메가와트시", "킬로칼로리"]) {
      expect([...icu.segment(surface)].map((s) => s.segment)).toEqual([surface]);
    }
    for (const unit of ["wh", "kwh", "mwh"] as const) {
      const symbol = energyKo.units[unit]?.symbol as string;
      expect(symbol, `${unit}'s symbol needs arithmetic to re-read`).not.toMatch(
        /[/*·×⋅]/,
      );
    }
  });

  test("줄 reads and never prints", () => {
    // The homograph that decides the joule family. 줄 is the Korean for a joule
    // and also a line, a cord and a queue — so it is a fine thing to accept and
    // a bad thing to emit, which is exactly the asymmetry `symbol` exists for.
    expect(energyKo.units.j?.aliases).toContain("줄");
    expect(energyKo.units.j?.symbol).toBe("J");
    expect(energyKo.units.j?.forms).toBeUndefined();
    expect(engine.evaluate("5줄").formatted).toBe("5J");
    expect(engine.evaluate("2킬로줄").formatted).toBe("2kJ");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [energy])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Korean folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean energy", () => {
    // Nothing between the number and the word: `korean.renderQuantity` closes
    // the gap on every branch, which is 한글 맞춤법 §43's proviso for a unit
    // after Arabic numerals.
    expect(engine.evaluate("200킬로칼로리").formatted).toBe("200킬로칼로리");
    expect(engine.evaluate("1.5킬로와트시").formatted).toBe("1.5킬로와트시");
    // Latin in, Hangul out: the form outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("5 kwh").formatted).toBe("5킬로와트시");
    expect(engine.evaluate("500 cal").formatted).toBe("500칼로리");
    // A conversion, and the ㄹ exception that makes the euphonic rule more than
    // a consonant test: 줄 ends in ㄹ, the one 받침 that takes 로 rather than
    // 으로 — 서울로, never 서울으로 — so 메가줄로 is grammatical and
    // 메가줄으로 is not. `particleStripper` computes that from the syllable's
    // codepoint rather than from a list.
    expect(engine.evaluate("2kwh를 메가줄로").formatted).toBe("7.2MJ");
    expect(() => engine.evaluate("2kwh를 메가줄으로")).toThrow();
    // A sum landing on a fraction. Korean groups with "," and marks the decimal
    // with "." — the same visible pair as English, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1킬로와트시 + 500와트시").formatted).toBe("1.5킬로와트시");
    // The Sino-Korean numerals: 이백 is two hundred, parsed by `koreanNumerals`
    // and not by any digit rule. The space before the unit is not optional — a
    // numeral written up against its unit is one letter run and therefore one
    // word token, which is a limitation of `lex` rather than of this vocabulary.
    expect(engine.evaluate("이백 킬로칼로리").formatted).toBe("200킬로칼로리");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "200킬로칼로리",
      "1.5킬로와트시",
      "5 kwh",
      "5줄",
      "2킬로줄",
      "2kwh를 메가줄로",
      "1킬로와트시 + 500와트시",
      "이백 킬로칼로리",
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
