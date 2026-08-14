import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateJa from "./ja";

const locale = () => composeLocale(japanese, [datarateJa]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `japanese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        japanese.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => japanese.selectForm({ kind: "datarate", unit: "mbps", slot })),
    ),
);

/** Han, Hiragana or Katakana — the three scripts Japanese is written in at once. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

describe("datarate ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // The three scripts as a class rather than a list of the words: the point is
    // that the kind holds ratios, unit ids, magnitude bands and four bridge
    // signatures and no language at all, so any Japanese character reaching it
    // is the failure.
    expect(JSON.stringify(datarate)).not.toMatch(JAPANESE);
  });

  test("`japanese` can ask for exactly one key, and no unit declares any", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it: Japanese nouns do not inflect for number, so every count and every
    // slot — the fractional 1.5 and the count-free conversion target included —
    // come back "other". Rule 6 wants a `forms` table to hold exactly that set.
    expect([...KEYS]).toEqual(["other"]);
    // And this kind holds none, which is `en.ts`'s ruling and `uk.ts`'s: a rate
    // is a compound in every language here, 「メガビット毎秒」 in this one, and
    // the engine's unit token is a single word.
    for (const [unit, words] of Object.entries(datarateJa.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(datarateJa.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
    }
  });

  test("every Japanese alias survives the segmenter whole", () => {
    // The check no other language in this repo needs, and the one that decides
    // what a `ja` vocabulary may contain at all. Japanese is unspaced, so `lex`
    // hands each letter run to `japanese.segment` before anything is looked up:
    // a word ICU breaks never reaches the alias index as one token, however
    // faithfully it is written here.
    for (const [unit, words] of Object.entries(datarateJa.units)) {
      for (const surface of words.aliases) {
        if (!JAPANESE.test(surface)) continue;
        expect(japanese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("the three katakana rates ICU refuses, measured rather than remembered", () => {
    // Why キロビット, ギガビット and テラビット are absent while ビット and
    // メガビット are listed. ICU's Japanese dictionary knows the two and cuts
    // the three at the SI prefix, and キロ is nobody's unit — so a claimed alias
    // would be dead weight rather than documentation. Pinned here so that a
    // dictionary update which learns them shows up as a failing test and three
    // new aliases, not as a gap nobody notices.
    expect(japanese.segment?.("キロビット")).toEqual(["キロ", "ビット"]);
    expect(japanese.segment?.("ギガビット")).toEqual(["ギガ", "ビット"]);
    expect(japanese.segment?.("テラビット")).toEqual(["テラ", "ビット"]);
    // And the compound this kind would have had to print if it declared forms.
    expect(japanese.segment?.("メガビット毎秒")).toEqual(["メガビット", "毎秒"]);
    const claimed = Object.values(datarateJa.units).flatMap((w) => [...w.aliases]);
    for (const word of ["キロビット", "ギガビット", "テラビット"]) {
      expect(claimed, `"${word}" is claimed but unreachable`).not.toContain(word);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Japanese folds every count into `other`, which is the
    // claim worth sampling rather than assuming: if `selectForm` ever grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese datarate", () => {
    // Katakana in, Latin symbol out, and nothing between the number and the
    // label: `japanese.renderQuantity` closes the gap on every branch.
    expect(engine.evaluate("100メガビット").formatted).toBe("100Mbps");
    expect(engine.evaluate("2ビット").formatted).toBe("2bps");
    // Latin in, and the same out — a Japanese engineer types "5 mbps" as readily
    // as anything, which is why `aliasesFor` keeps the Latin set.
    expect(engine.evaluate("5 mbps").formatted).toBe("5Mbps");
    // Both particles the language claims under `in`, written the way Japanese
    // writes them: with no space, glued to the end of the left operand. を is
    // the accusative and から is "from"; both mark the *source*, which is what
    // puts them where an infix operator goes.
    expect(engine.evaluate("2gbpsをmbps").formatted).toBe("2,000Mbps");
    expect(engine.evaluate("2gbpsからmbps").formatted).toBe("2,000Mbps");
    // A sum landing on a fraction. Japanese groups with "," and marks the
    // decimal with "." — the same pair as English, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1.5Mbps");
    // The kanji numerals, which are this language's other unusual half: 五百 is
    // five hundred, parsed by `japaneseNumerals` and not by any digit rule.
    expect(engine.evaluate("五百メガビット").formatted).toBe("500Mbps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100メガビット",
      "2ビット",
      "2gbpsをmbps",
      "1 mbps + 500 kbps",
      "五百メガビット",
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
