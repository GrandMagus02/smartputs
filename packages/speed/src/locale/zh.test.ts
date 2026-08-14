import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { speed } from "../index";
import speedZh from "./zh";

const locale = () => composeLocale(chinese, [speedZh]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;
const COUNTS = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000];

/** Every key `chinese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  COUNTS.flatMap((count) =>
    SLOTS.map((slot) =>
      chinese.selectForm({
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
      SLOTS.map((slot) => chinese.selectForm({ kind: "speed", unit: "knot", slot })),
    ),
);

/** Han, the one script Simplified Chinese writes its words in. */
const HAN = /\p{Script=Han}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = chinese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("speed zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // The script as a class rather than a list of the words: the kind is four
    // ratios, four unit ids, the magnitude bands and one bridge signature, so
    // any Han character reaching it is the failure.
    expect(JSON.stringify(speed)).not.toMatch(HAN);
  });

  test("only `knot` declares a form, and it declares exactly one", () => {
    // The contract the language author pinned: Chinese marks number nowhere on a
    // noun, so every count — the fractional 1.5 and the count-free conversion
    // target included — and every slot come back "other". A one-row table is the
    // correct and finished answer for this language, not a stub; rule 6 wants
    // exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(Object.keys(speedZh.units.knot?.forms ?? {})).toEqual([...KEYS]);
    // The other three are compounds in Chinese as in English — 米每秒,
    // 公里每小时 — so they print their symbols.
    expect(speedZh.units.mps?.forms).toBeUndefined();
    expect(speedZh.units.kph?.forms).toBeUndefined();
    expect(speedZh.units.mph?.forms).toBeUndefined();
  });

  test("one word covers every count", () => {
    // The whole of Chinese number agreement, in four assertions. English needs
    // "knot" beside "knots" and Ukrainian needs four nominative rows and four
    // locative ones; Chinese needs one word, and the count-free conversion
    // target takes the same one.
    expect(word("knot", 1)).toBe("节");
    expect(word("knot", 20)).toBe("节");
    expect(word("knot", 1.5)).toBe("节");
    expect(word("knot", undefined, "conversion-target")).toBe("节");
  });

  test("the three compounds leave the Chinese head nouns to `length`", () => {
    // Not an omission, and the same argument `uk.ts` makes. The alias index is
    // one flat map with no kind in the key, so claiming 公里 here would give
    // 「5公里」 two readings in any engine that installs both kinds — which is
    // exactly what the `@smartput/kinds` barrel does.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedZh.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Chinese head noun`).not.toMatch(HAN);
      }
    }
    expect(speedZh.units.knot?.aliases).toContain("节");
  });

  test("the compounds ICU cuts, the prefix Chinese puts on the wrong side, and 码", () => {
    // Three measurements behind the three empty `forms` tables above, recorded
    // rather than asserted from memory.
    //
    // First: ICU cuts each written-out compound at exactly the join, so even a
    // lexer that took spaces inside a unit word could not put one back together.
    expect(chinese.segment?.("米每秒")).toEqual(["米", "每秒"]);
    expect(chinese.segment?.("公里每小时")).toEqual(["公里", "每", "小时"]);
    expect(chinese.segment?.("英里每小时")).toEqual(["英里", "每", "小时"]);
    // Second: 时速 is the ordinary Chinese way to say a road speed, it survives
    // the segmenter whole, and it is still unusable — it is a *prefix*,
    // 「时速100公里」, arriving before the number, where `lex` can never bind it,
    // since a unit word attaches to the number on its left. One token, perfectly
    // readable, and no vocabulary entry can move a word to the other side of its
    // own quantity.
    expect(chinese.segment?.("时速")).toEqual(["时速"]);
    // Third: 码 is mainland driving slang for a kilometre per hour
    // (「开到80码」), and it is also the yard, the code and a measure word. A
    // slang reading of a character that is a real unit of a different kind is the
    // worst possible alias.
    const claimed = Object.values(speedZh.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("时速");
    expect(claimed).not.toContain("码");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Two of the symbols here carry "/" and are outside what an alias
    // index can decide at all — they re-read as `length ÷ duration`, the route
    // English's own "m/s" takes — so those are named and left to the engine
    // test below rather than checked here.
    const arithmetic = new Set(["mps", "kph"]);
    for (const [unit, words] of Object.entries(speedZh.units)) {
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

  test("every Chinese alias and form survives the segmenter whole", () => {
    // The check no Latin-script language in this repo needs, and the one that
    // decides what a `zh` vocabulary may contain. Chinese is unspaced, so `lex`
    // hands each letter run to `chinese.segment` before anything is looked up: a
    // word ICU breaks never reaches the alias index as one token, however
    // faithfully it is written here. 节 is the load-bearing case, since it is a
    // *printed* string and not merely a read one.
    for (const [unit, words] of Object.entries(speedZh.units)) {
      for (const surface of [...words.aliases, ...Object.values(words.forms ?? {})]) {
        if (!HAN.test(surface)) continue;
        expect(chinese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [speed])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Chinese folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [speed], { counts: COUNTS }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese speed", () => {
    // The one unit that prints as a word, at three counts that would move English
    // and Ukrainian and do not move Chinese. Nothing separates the number from
    // the word: `chinese.renderQuantity` closes the gap on every branch, so the
    // word is set as tightly as a symbol.
    expect(engine.evaluate("20节").formatted).toBe("20节");
    expect(engine.evaluate("1节").formatted).toBe("1节");
    expect(engine.evaluate("1.5节").formatted).toBe("1.5节");
    // Latin in, Chinese out: "kt" is an alias from `units.ts` and the form wins
    // over the symbol in `renderQuantity`.
    expect(engine.evaluate("5 kt").formatted).toBe("5节");
    // A conversion through the particle 到 and through the verb 换算. The compound
    // symbols are what China writes — 「18.52km/h」, 「26.8224m/s」 — slashes and
    // all, and the decimal mark is ".", read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("10节到kph").formatted).toBe("18.52km/h");
    expect(engine.evaluate("60mph换算mps").formatted).toBe("26.8224m/s");
    // A sum landing on a fraction. The operands are spaced, which finding 2 in
    // the language notes requires: `lex` appends a letter run's trailing digits
    // to the last segmented word, so 「10节加0.5节」 would swallow the 0.5 into
    // the operator 加.
    expect(engine.evaluate("10节 + 0.5节").formatted).toBe("10.5节");
    // The Han numerals, this language's other unusual half — 二十 is twenty,
    // parsed by `chineseNumerals` and not by any digit rule.
    expect(engine.evaluate("二十节").formatted).toBe("20节");
  });

  test("its own output reads back to the same value", () => {
    // `knot` and `mph` only. The other two print on a symbol carrying "/", which
    // the lexer will not take back inside a unit word: 「100km/h」 is a length
    // over a duration and needs `@smartput/length` and `@smartput/duration`
    // installed to compute, which is the same route English's "m/s" takes and is
    // asserted in those packages rather than here, where only `speed` is wired.
    for (const input of ["20节", "1.5节", "5 kt", "60 mph", "10节 + 0.5节", "二十节"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
