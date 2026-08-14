import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerJa from "./ja";

const locale = () => composeLocale(japanese, [powerJa]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `japanese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        japanese.selectForm({
          count: new Decimal(count),
          kind: "power",
          unit: "w",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(SLOTS.map((slot) => japanese.selectForm({ kind: "power", unit: "w", slot }))),
);

/** Han, Hiragana or Katakana — the three scripts Japanese is written in at once. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

describe("power ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // The three scripts as a class rather than a list of the words: the kind is
    // five ratios, five unit ids and the magnitude bands, so any Japanese
    // character reaching it is the failure.
    expect(JSON.stringify(power)).not.toMatch(JAPANESE);
  });

  test("`japanese` can ask for exactly one key, and no unit needs it", () => {
    // The contract the language author pinned: Japanese nouns do not inflect for
    // number, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". Rule 6 wants a
    // `forms` table to hold exactly that set.
    expect([...KEYS]).toEqual(["other"]);
    // No unit declares one, for two different reasons this file keeps apart.
    // The watt family cannot spell itself throughout, since ICU breaks
    // ギガワット; 馬力 has nothing to spell, being at once the word and the
    // abbreviation, so R8's `symbol` already holds it.
    for (const [unit, words] of Object.entries(powerJa.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
    expect(powerJa.units.hp?.symbol).toBe("馬力");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives — which is exactly what
    // `uk.ts` shipped when 「1 hp」 printed "1 кінська сила" and then threw on
    // it. Japanese avoids that trap by having a one-token word for the unit.
    for (const [unit, words] of Object.entries(powerJa.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(symbol, `${unit}'s symbol "${symbol}" is more than one token`).not.toMatch(
        /\s/u,
      );
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
    // it is written here. 馬力 is the load-bearing case, since it is a *printed*
    // string and not merely a read one.
    for (const [unit, words] of Object.entries(powerJa.units)) {
      for (const surface of words.aliases) {
        if (!JAPANESE.test(surface)) continue;
        expect(japanese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
    expect(japanese.segment?.("馬力")).toEqual(["馬力"]);
  });

  test("ギガワット is the word that decides the family's register", () => {
    // Measured rather than remembered. ICU knows ワット, キロワット and
    // メガワット and cuts ギガワット at the prefix, so a spelled family would
    // have printed 「1.5ギガワット」 and read it back as 1.5 watts if it read at
    // all. The family prints "W"/"kW"/"MW"/"GW" instead — what a Japanese
    // nameplate writes — and the three readable words stay as aliases.
    expect(japanese.segment?.("ワット")).toEqual(["ワット"]);
    expect(japanese.segment?.("キロワット")).toEqual(["キロワット"]);
    expect(japanese.segment?.("メガワット")).toEqual(["メガワット"]);
    expect(japanese.segment?.("ギガワット")).toEqual(["ギガ", "ワット"]);
    expect(powerJa.units.gw?.aliases).not.toContain("ギガワット");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Japanese folds every count into `other`, which is the
    // claim worth sampling rather than assuming: if `selectForm` ever grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese power", () => {
    // Katakana in, SI symbol out, with nothing between the number and the
    // label: `japanese.renderQuantity` closes the gap on every branch.
    expect(engine.evaluate("60ワット").formatted).toBe("60W");
    expect(engine.evaluate("1.5キロワット").formatted).toBe("1.5kW");
    // The one unit Japanese names in kanji, printed as it is read.
    expect(engine.evaluate("150馬力").formatted).toBe("150馬力");
    // Latin in, and the same out: a Japanese datasheet writes both.
    expect(engine.evaluate("1 gw").formatted).toBe("1GW");
    // A conversion through each particle the language claims under `in`. Both
    // mark the *source* and attach to the end of the left operand, which is
    // where a head-final language puts a particle and where an infix operator
    // has to be. The group separator is ",", read from CLDR rather than
    // transcribed.
    expect(engine.evaluate("2kwをワット").formatted).toBe("2,000W");
    expect(engine.evaluate("1gwからmw").formatted).toBe("1,000MW");
    // A sum landing on a fraction; the decimal mark is ".".
    expect(engine.evaluate("1キロワット + 500ワット").formatted).toBe("1.5kW");
    // The kanji numerals, this language's other unusual half.
    expect(engine.evaluate("百ワット").formatted).toBe("100W");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "60ワット",
      "1.5キロワット",
      "150馬力",
      "2kwをワット",
      "1キロワット + 500ワット",
      "百ワット",
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
