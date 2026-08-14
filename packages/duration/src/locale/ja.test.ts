import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationJa from "./ja";

const locale = () => composeLocale(japanese, [durationJa]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `japanese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        japanese.selectForm({
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
      SLOTS.map((slot) => japanese.selectForm({ kind: "duration", unit: "h", slot })),
    ),
);

/** Han, Hiragana or Katakana — the three scripts Japanese is written in at once. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

describe("duration ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // The three scripts as a class rather than a list of the words: the kind is
    // six ratios, six unit ids and the magnitude bands, so any Japanese
    // character reaching it is the failure.
    expect(JSON.stringify(duration)).not.toMatch(JAPANESE);
  });

  test("`japanese` can ask for exactly one key, and no unit needs it", () => {
    // The contract the language author pinned: Japanese nouns do not inflect for
    // number, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants a
    // `forms` table to hold exactly that set.
    expect([...KEYS]).toEqual(["other"]);
    // No unit declares one, and here that is not the usual complaint about
    // compounds. It is that Japanese names five of these units with a single
    // character each — 秒, 分, 時間, 日, 週間 — which is at once the word and
    // the abbreviation, so R8's `symbol` already holds it and a `forms` table
    // would be the same string written twice.
    for (const [unit, words] of Object.entries(durationJa.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
    expect(durationJa.units.h?.symbol).toBe("時間");
    expect(durationJa.units.h?.aliases).toContain("時間");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(durationJa.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
    }
  });

  test("every Japanese alias survives the segmenter whole", () => {
    // The check no other language in this repo needs, and the one that decides
    // what a `ja` vocabulary may contain. Japanese is unspaced, so `lex` hands
    // each letter run to `japanese.segment` before anything is looked up: a word
    // ICU breaks never reaches the alias index as one token, however faithfully
    // it is written here.
    for (const [unit, words] of Object.entries(durationJa.units)) {
      for (const surface of words.aliases) {
        if (!JAPANESE.test(surface)) continue;
        expect(japanese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("ミリ秒 is a real Japanese word this vocabulary cannot use", () => {
    // Why `ms` is the one unit here with no Japanese spelling. ICU cuts ミリ秒
    // at the SI prefix, and the piece left over is 秒 — so a vocabulary that
    // claimed the word would not merely fail to read it, it would read
    // 「5ミリ秒」 as five *seconds* if the stranded ミリ were ever ignored.
    // Pinned rather than trusted: a dictionary that later learns the word should
    // surface here as a failing test and one new alias.
    expect(japanese.segment?.("ミリ秒")).toEqual(["ミリ", "秒"]);
    expect(durationJa.units.ms?.aliases).not.toContain("ミリ秒");
    expect(durationJa.units.ms?.symbol).toBe("ms");
  });

  test("時 is left to the clock and 日間 is read but not printed", () => {
    // The two spelling decisions this kind's Japanese actually turns on.
    //
    // 「3時」 is three o'clock, a point rather than a length, and belongs to
    // `datetime`; only the suffixed 時間 is a duration, so the bare 時 is
    // claimed nowhere here.
    expect(durationJa.units.h?.aliases).not.toContain("時");
    // 日間 and 週 are the second spellings a reader may type — 「3日間」 marks a
    // span where 「3日」 alone can be read as a date, and 「2週」 is what a table
    // column writes — so both are read. Only the unsuffixed 日 and the suffixed
    // 週間 are printed, because those are the two that are unambiguous standing
    // immediately after a number.
    expect(durationJa.units.d?.aliases).toContain("日間");
    expect(durationJa.units.wk?.aliases).toContain("週");
    expect(engine.evaluate("3日間").formatted).toBe("3日");
    expect(engine.evaluate("2週").formatted).toBe("2週間");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Japanese folds every count into `other`, which is the
    // claim worth sampling rather than assuming: if `selectForm` ever grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese duration", () => {
    // Kanji in, kanji out, and nothing between the number and the label:
    // `japanese.renderQuantity` closes the gap on every branch, which is how
    // 「5秒」 is written on any Japanese page.
    expect(engine.evaluate("5秒").formatted).toBe("5秒");
    expect(engine.evaluate("2時間").formatted).toBe("2時間");
    // Latin in, Japanese out: a Japanese developer types "5 ms" and "2 h".
    expect(engine.evaluate("2 h").formatted).toBe("2時間");
    expect(engine.evaluate("5 ms").formatted).toBe("5ms");
    // A conversion through each of the two particles the language claims under
    // `in`. Both mark the *source* and attach to the end of the left operand,
    // which is where a head-final language puts a particle and where an infix
    // operator has to be.
    expect(engine.evaluate("90分を時間").formatted).toBe("1.5時間");
    expect(engine.evaluate("1週間から日").formatted).toBe("7日");
    // A sum landing on a fraction. The decimal mark is ".", read from CLDR
    // through `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1時間 + 30分").formatted).toBe("1.5時間");
    // The kanji numerals, this language's other unusual half.
    expect(engine.evaluate("十時間").formatted).toBe("10時間");
  });

  test("a spelled numeral in front of 分 is the one collision this kind has", () => {
    // Measured and recorded rather than hidden. ICU segments 「三十分」 as 三 +
    // 十分, because 十分 ("sufficient") is a commoner word than the numeral
    // reading, so thirty minutes spelled in kanji does not parse. Nothing a
    // vocabulary can do about it: the cut happens before any alias is consulted,
    // and 分 is the correct unit word either way. Digits are unaffected, which
    // is what the second line shows and is how anyone actually writes it.
    expect(japanese.segment?.("三十分")).toEqual(["三", "十分"]);
    expect(() => engine.evaluate("三十分")).toThrow(/十分/);
    expect(engine.evaluate("30分").formatted).toBe("30分");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5秒",
      "2時間",
      "90分を時間",
      "1時間 + 30分",
      "1週間から日",
      "十時間",
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
