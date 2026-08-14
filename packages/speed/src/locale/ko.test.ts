import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { speed } from "../index";
import speedKo from "./ko";

const locale = () => composeLocale(korean, [speedKo]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `korean.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        korean.selectForm({
          count: new Decimal(count),
          kind: "speed",
          unit: "knot",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => korean.selectForm({ kind: "speed", unit: "knot", slot })),
    ),
);

/** Hangul — the one script Korean writes its own words in. */
const HANGUL = /\p{Script=Hangul}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = korean.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("speed ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // The script as a class rather than a list of the words: the kind is four
    // ratios, four unit ids, the magnitude bands and one bridge signature, so
    // any Hangul syllable reaching it is the failure.
    expect(JSON.stringify(speed)).not.toMatch(HANGUL);
  });

  test("only `knot` declares a form, and it declares exactly one", () => {
    // The contract the language author pinned: Korean marks number nowhere on a
    // noun, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants
    // exactly this set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(Object.keys(speedKo.units.knot?.forms ?? {})).toEqual([...KEYS]);
    // The other three are phrases in Korean as in English — 「미터 매 초」,
    // 「킬로미터 매 시」 — so they print their symbols.
    expect(speedKo.units.mps?.forms).toBeUndefined();
    expect(speedKo.units.kph?.forms).toBeUndefined();
    expect(speedKo.units.mph?.forms).toBeUndefined();
  });

  test("one word covers every count", () => {
    // The whole of Korean number agreement, in four assertions. English needs
    // "knot" beside "knots" and Ukrainian needs four nominative rows and four
    // locative ones; Korean needs one word, and the count-free conversion target
    // takes the same one.
    expect(word("knot", 1)).toBe("노트");
    expect(word("knot", 20)).toBe("노트");
    expect(word("knot", 1.5)).toBe("노트");
    expect(word("knot", undefined, "conversion-target")).toBe("노트");
  });

  test("the three compounds leave the Korean head nouns to `length`", () => {
    // Not an omission, and the same argument `uk.ts` and `ja.ts` make. The alias
    // index is one flat map with no kind in the key, so claiming 킬로미터 here
    // would give 「5킬로미터」 two readings in any engine that installs both
    // kinds — which is exactly what the `@smartput/kinds` barrel does.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedKo.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Korean head noun`).not.toMatch(HANGUL);
      }
    }
    expect(speedKo.units.knot?.aliases).toContain("노트");
  });

  test("the prefix Korean puts on the wrong side of the number", () => {
    // The decision behind the three empty `forms` tables that is *not* about the
    // lexer's spaces, recorded rather than asserted from memory. 「시속」 is the
    // ordinary Korean way to say a road speed — 「시속 100킬로미터」 — and 「초속」
    // is its per-second twin. Both are single tokens, perfectly readable, and
    // still unusable: they arrive *before* the number, where `lex` can never
    // bind them, since a unit word attaches to the number on its left. A
    // vocabulary entry cannot move a word to the other side of its own quantity.
    //
    // And the fact that separates this file from `ja.ts`: there is no segmenter
    // in the way, so nothing here was ruled out by a dictionary.
    expect(korean.segment).toBeUndefined();
    const claimed = Object.values(speedKo.units).flatMap((w) => [...w.aliases]);
    for (const word of ["시속", "초속", "킬로미터", "미터", "마일"]) {
      expect(claimed, `"${word}" is claimed`).not.toContain(word);
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Two of the symbols here carry "/" and are outside what an alias
    // index can decide at all — they re-read as `length ÷ duration`, the route
    // English's own "m/s" takes — so those are named and left to the engine
    // test below rather than checked here.
    const arithmetic = new Set(["mps", "kph"]);
    for (const [unit, words] of Object.entries(speedKo.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      if (arithmetic.has(unit)) {
        expect(symbol, `${unit}'s symbol "${symbol}" is not a compound`).toMatch(/\//);
        continue;
      }
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
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

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [speed])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Korean folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean speed", () => {
    // The one unit that prints as a word, at three counts that would move
    // English and Ukrainian and do not move Korean. Nothing separates the number
    // from the word: `korean.renderQuantity` closes the gap on every branch,
    // which is 한글 맞춤법 §43's proviso for a unit after Arabic numerals.
    expect(engine.evaluate("20노트").formatted).toBe("20노트");
    expect(engine.evaluate("1노트").formatted).toBe("1노트");
    expect(engine.evaluate("1.5노트").formatted).toBe("1.5노트");
    // Latin in, Korean out: "kt" is an alias from `units.ts` and the form wins
    // over the symbol in `renderQuantity`.
    expect(engine.evaluate("5 kt").formatted).toBe("5노트");
    // A conversion, with the source particle on a Latin stem — where it reaches
    // the parser as its own token — and the compound symbols Korea writes,
    // slashes and all.
    expect(engine.evaluate("10kt를 kph").formatted).toBe("18.52km/h");
    expect(engine.evaluate("60mph에서 mps").formatted).toBe("26.8224m/s");
    // The target particle glued to a Hangul word, which is where the euphonic
    // conditional does its work: 노트 ends in an open syllable, so 로 is the
    // grammatical shape and 으로 is not.
    // 18.52 km/h is ten times the definitional 1852 m in a nautical mile, so the
    // answer is exact and the assertion is about the particle rather than about
    // rounding.
    expect(engine.evaluate("18.52kph를 노트로").formatted).toBe("10노트");
    expect(() => engine.evaluate("18.52kph를 노트으로")).toThrow();
    // A sum landing on a fraction; the decimal mark is ".", read from CLDR
    // through `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("10노트 + 0.5노트").formatted).toBe("10.5노트");
    // The Sino-Korean numerals: 이십 is twenty, parsed by `koreanNumerals` and
    // not by any digit rule. The space before the unit is not optional — a
    // numeral written up against its unit is one letter run and therefore one
    // word token, which is a limitation of `lex` rather than of this vocabulary.
    expect(engine.evaluate("이십 노트").formatted).toBe("20노트");
  });

  test("its own output reads back to the same value", () => {
    // `knot` and `mph` only. The other two print on a symbol carrying "/", which
    // the lexer will not take back inside a unit word: 「100km/h」 is a length
    // over a duration and needs `@smartput/length` and `@smartput/duration`
    // installed to compute, which is the same route English's "m/s" takes and is
    // asserted in those packages rather than here, where only `speed` is wired.
    for (const input of [
      "20노트",
      "1.5노트",
      "5 kt",
      "60 mph",
      "10노트 + 0.5노트",
      "이십 노트",
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
