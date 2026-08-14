import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeJa from "./ja";

const locale = () => composeLocale(japanese, [datasizeJa]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `japanese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        japanese.selectForm({
          count: new Decimal(count),
          kind: "datasize",
          unit: "b",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => japanese.selectForm({ kind: "datasize", unit: "b", slot })),
    ),
);

/** Han, Hiragana or Katakana — the three scripts Japanese is written in at once. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

describe("datasize ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // The three scripts as a class rather than a list of the words: the kind is
    // ratios, unit ids and magnitude bands, so any Japanese character reaching
    // it is the failure.
    expect(JSON.stringify(datasize)).not.toMatch(JAPANESE);
  });

  test("`japanese` can ask for exactly one key, and no unit declares it", () => {
    // The contract the language author pinned: Japanese nouns do not inflect for
    // number, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". A table
    // translated from `en.ts` would need no key renamed, only its "one" row
    // deleted. Rule 6 wants exactly this set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    // This kind holds none at all, which is the file's own ruling: seven of the
    // nine katakana names survive ICU and two do not, and a family that cannot
    // be spelled throughout is spelled nowhere.
    for (const [unit, words] of Object.entries(datasizeJa.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(datasizeJa.units)) {
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
    for (const [unit, words] of Object.entries(datasizeJa.units)) {
      for (const surface of words.aliases) {
        if (!JAPANESE.test(surface)) continue;
        expect(japanese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("the two katakana sizes ICU refuses, measured rather than remembered", () => {
    // Why テラバイト and キビバイト are absent while the other seven are listed,
    // and why this kind prints symbols throughout. テラバイト is the decimal
    // family's top unit and the commonest of the nine in Japanese shop copy, so
    // its absence is not a rounding error: spelling the family would print
    // 「1.5ギガバイト」 beside 「2TB」, with ICU's dictionary rather than
    // Japanese deciding which register a reader gets.
    expect(japanese.segment?.("テラバイト")).toEqual(["テラ", "バイト"]);
    expect(japanese.segment?.("キビバイト")).toEqual(["キビ", "バイト"]);
    const claimed = Object.values(datasizeJa.units).flatMap((w) => [...w.aliases]);
    for (const word of ["テラバイト", "キビバイト"]) {
      expect(claimed, `"${word}" is claimed but unreachable`).not.toContain(word);
    }
    // The cost, stated as an assertion rather than as a regret: this is the one
    // input a Japanese reader might reasonably type that this vocabulary cannot
    // take, and the error names the fragment ICU stranded.
    expect(() => engine.evaluate("2テラバイト")).toThrow(/テラ/);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Japanese folds every count into `other`, which is the
    // claim worth sampling rather than assuming: if `selectForm` ever grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese datasize", () => {
    // Katakana in, Latin symbol out, and nothing between the number and the
    // label: `japanese.renderQuantity` closes the gap on every branch, which is
    // exactly how a Japanese page writes 「512B」.
    expect(engine.evaluate("512バイト").formatted).toBe("512B");
    expect(engine.evaluate("1.5ギガバイト").formatted).toBe("1.5GB");
    // Latin in, and the same out: nobody switches input mode to type a unit.
    expect(engine.evaluate("512 mb").formatted).toBe("512MB");
    // A conversion, written with を — the accusative, glued to the end of the
    // left operand, which is where a head-final language puts a particle and
    // where an infix operator has to be. The group separator is "," and the
    // decimal mark ".", read from CLDR rather than transcribed.
    expect(engine.evaluate("2ギガバイトをメガバイト").formatted).toBe("2,000MB");
    // から, the other particle the language claims, and the binary family
    // staying a separate unit rather than a second name for the decimal one:
    // 1KiB is 1024 bytes where 1kB is 1000.
    expect(engine.evaluate("1kibからバイト").formatted).toBe("1,024B");
    // A sum landing on a fraction.
    expect(engine.evaluate("1メガバイト + 500キロバイト").formatted).toBe("1.5MB");
    // The kanji numerals, this language's other unusual half: 五 is five, parsed
    // by `japaneseNumerals` and not by any digit rule.
    expect(engine.evaluate("五ギガバイト").formatted).toBe("5GB");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "512バイト",
      "1.5ギガバイト",
      "2ギガバイトをメガバイト",
      "1メガバイト + 500キロバイト",
      "2テビバイト",
      "五ギガバイト",
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
