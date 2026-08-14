import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { speed } from "../index";
import speedJa from "./ja";

const locale = () => composeLocale(japanese, [speedJa]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `japanese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        japanese.selectForm({
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
      SLOTS.map((slot) => japanese.selectForm({ kind: "speed", unit: "knot", slot })),
    ),
);

/** Han, Hiragana or Katakana — the three scripts Japanese is written in at once. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = japanese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("speed ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // The three scripts as a class rather than a list of the words: the kind is
    // four ratios, four unit ids, the magnitude bands and one bridge signature,
    // so any Japanese character reaching it is the failure.
    expect(JSON.stringify(speed)).not.toMatch(JAPANESE);
  });

  test("only `knot` declares a form, and it declares exactly one", () => {
    // The contract the language author pinned: Japanese nouns do not inflect for
    // number, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants
    // exactly this set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(Object.keys(speedJa.units.knot?.forms ?? {})).toEqual([...KEYS]);
    // The other three are compounds in Japanese as in English — 「メートル毎秒」,
    // 「キロメートル毎時」 — so they print their symbols.
    expect(speedJa.units.mps?.forms).toBeUndefined();
    expect(speedJa.units.kph?.forms).toBeUndefined();
    expect(speedJa.units.mph?.forms).toBeUndefined();
  });

  test("one word covers every count", () => {
    // The whole of Japanese number agreement, in four assertions. English needs
    // "knot" beside "knots" and Ukrainian needs four nominative rows and four
    // locative ones; Japanese needs one word, and the count-free conversion
    // target takes the same one.
    expect(word("knot", 1)).toBe("ノット");
    expect(word("knot", 20)).toBe("ノット");
    expect(word("knot", 1.5)).toBe("ノット");
    expect(word("knot", undefined, "conversion-target")).toBe("ノット");
  });

  test("the three compounds leave the katakana head nouns to `length`", () => {
    // Not an omission, and the same argument `uk.ts` makes. The alias index is
    // one flat map with no kind in the key, so claiming キロメートル here would
    // give 「5キロメートル」 two readings in any engine that installs both kinds
    // — which is exactly what the `@smartput/kinds` barrel does.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedJa.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Japanese head noun`).not.toMatch(JAPANESE);
      }
    }
    expect(speedJa.units.knot?.aliases).toContain("ノット");
  });

  test("the compounds ICU cuts, and the prefix Japanese puts on the wrong side", () => {
    // Two measurements behind the three empty `forms` tables above, recorded
    // rather than asserted from memory.
    //
    // First: ICU cuts each written-out compound at exactly the join, so even a
    // lexer that took spaces inside a unit word could not put one back together.
    expect(japanese.segment?.("メートル毎秒")).toEqual(["メートル", "毎秒"]);
    expect(japanese.segment?.("キロメートル毎時")).toEqual(["キロメートル", "毎時"]);
    expect(japanese.segment?.("マイル毎時")).toEqual(["マイル", "毎時"]);
    // Second: 「時速」 is the ordinary Japanese way to say a road speed and it is
    // a *prefix* — 「時速100キロ」 — arriving before the number, where `lex` can
    // never bind it, since a unit word attaches to the number on its left. One
    // token, perfectly readable, and still unusable: a vocabulary entry cannot
    // move a word to the other side of its own quantity.
    expect(japanese.segment?.("時速")).toEqual(["時速"]);
    const claimed = Object.values(speedJa.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("時速");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Two of the symbols here carry "/" and are outside what an alias
    // index can decide at all — they re-read as `length ÷ duration`, the route
    // English's own "m/s" takes — so those are named and left to the engine
    // test below rather than checked here.
    const arithmetic = new Set(["mps", "kph"]);
    for (const [unit, words] of Object.entries(speedJa.units)) {
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

  test("every Japanese alias and form survives the segmenter whole", () => {
    // The check no other language in this repo needs, and the one that decides
    // what a `ja` vocabulary may contain. Japanese is unspaced, so `lex` hands
    // each letter run to `japanese.segment` before anything is looked up: a word
    // ICU breaks never reaches the alias index as one token, however faithfully
    // it is written here. ノット is the load-bearing case, since it is a
    // *printed* string and not merely a read one.
    for (const [unit, words] of Object.entries(speedJa.units)) {
      for (const surface of [...words.aliases, ...Object.values(words.forms ?? {})]) {
        if (!JAPANESE.test(surface)) continue;
        expect(japanese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
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
    // fraction takes. Japanese folds every count into `other`, which is the
    // claim worth sampling rather than assuming: if `selectForm` ever grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese speed", () => {
    // The one unit that prints as a word, at three counts that would move
    // English and Ukrainian and do not move Japanese. Nothing separates the
    // number from the word: `japanese.renderQuantity` closes the gap on every
    // branch, so the word is set as tightly as a symbol.
    expect(engine.evaluate("20ノット").formatted).toBe("20ノット");
    expect(engine.evaluate("1ノット").formatted).toBe("1ノット");
    expect(engine.evaluate("1.5ノット").formatted).toBe("1.5ノット");
    // Latin in, Japanese out: "kt" is an alias from `units.ts` and the form wins
    // over the symbol in `renderQuantity`.
    expect(engine.evaluate("5 kt").formatted).toBe("5ノット");
    // A conversion through each particle the language claims under `in`. Both
    // mark the *source* and attach to the end of the left operand, which is
    // where a head-final language puts a particle and where an infix operator
    // has to be. The compound symbols are what Japan writes — 「18.52km/h」,
    // 「3m/s」 — slashes and all.
    expect(engine.evaluate("10ノットをkph").formatted).toBe("18.52km/h");
    expect(engine.evaluate("60mphからmps").formatted).toBe("26.8224m/s");
    // A sum landing on a fraction; the decimal mark is ".", read from CLDR
    // through `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("10ノット + 0.5ノット").formatted).toBe("10.5ノット");
    // The kanji numerals, this language's other unusual half: 二十 is twenty,
    // parsed by `japaneseNumerals` and not by any digit rule.
    expect(engine.evaluate("二十ノット").formatted).toBe("20ノット");
  });

  test("its own output reads back to the same value", () => {
    // `knot` and `mph` only. The other two print on a symbol carrying "/", which
    // the lexer will not take back inside a unit word: 「100km/h」 is a length
    // over a duration and needs `@smartput/length` and `@smartput/duration`
    // installed to compute, which is the same route English's "m/s" takes and is
    // asserted in those packages rather than here, where only `speed` is wired.
    for (const input of [
      "20ノット",
      "1.5ノット",
      "5 kt",
      "60 mph",
      "10ノット + 0.5ノット",
      "二十ノット",
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
