import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoJa from "./ja";

const locale = () => composeLocale(japanese, [tempoJa]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `japanese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        japanese.selectForm({
          count: new Decimal(count),
          kind: "tempo",
          unit: "hz",
          slot,
        }),
      ),
    )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => japanese.selectForm({ kind: "tempo", unit: "hz", slot })),
    ),
);

/** Han, Hiragana or Katakana — the three scripts Japanese is written in at once. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = japanese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("tempo ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // The three scripts as a class rather than a list of the words: the kind is
    // two ratios, two unit ids, the magnitude bands and the reciprocal bridge to
    // `duration`, so any Japanese character reaching it is the failure.
    expect(JSON.stringify(tempo)).not.toMatch(JAPANESE);
  });

  test("`hz` declares exactly one key where `en.ts` needed two", () => {
    // The whole `ja` contract in a single row. Japanese nouns do not inflect for
    // number, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". English needed
    // two rows holding the same word because "hertz" is its own plural;
    // Japanese needs one because there is no plural to hold. Rule 6 wants
    // exactly this set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(Object.keys(tempoJa.units.hz?.forms ?? {})).toEqual([...KEYS]);
    // `bpm` declares none, the ruling `en.ts` records: "beats per minute" is a
    // compound, and the Japanese 「毎分…拍」 is worse than a compound because it
    // is discontinuous — the rate word before the number, the counter after it.
    expect(tempoJa.units.bpm?.forms).toBeUndefined();
  });

  test("one word covers every count", () => {
    // Four assertions where Ukrainian needs eight rows and English two. The last
    // is the row no one-dimensional plural model could express at all: a
    // conversion target has no magnitude to agree with (ruling R5).
    expect(word("hz", 1)).toBe("ヘルツ");
    expect(word("hz", 50)).toBe("ヘルツ");
    expect(word("hz", 1.5)).toBe("ヘルツ");
    expect(word("hz", undefined, "conversion-target")).toBe("ヘルツ");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives — which is why `bpm`'s
    // symbol is "bpm" and not the 「拍/分」 a metronome prints: the slash is an
    // operator, and `tempo ÷ duration` is a signature no kind declares.
    for (const [unit, words] of Object.entries(tempoJa.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
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
    // it is written here. ヘルツ is the load-bearing case, since it is a
    // *printed* string and not merely a read one — unlike キロジュール or
    // ギガワット, which ICU cuts at the SI prefix and which `energy` and `power`
    // therefore cannot spell.
    for (const [unit, words] of Object.entries(tempoJa.units)) {
      for (const surface of [...words.aliases, ...Object.values(words.forms ?? {})]) {
        if (!JAPANESE.test(surface)) continue;
        expect(japanese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("拍 is read and never printed", () => {
    // The elision `datarate`'s ビット and Ukrainian's уд rest on: the counter
    // standing for the whole rate, with the per-minute understood. It is read
    // because 「120拍」 is what a Japanese score or drum thread writes, and it is
    // not the symbol because a symbol must be unambiguous with no context around
    // it — a bare 拍 is a count of beats as readily as a tempo.
    expect(tempoJa.units.bpm?.aliases).toContain("拍");
    expect(tempoJa.units.bpm?.symbol).toBe("bpm");
    expect(engine.evaluate("120拍").formatted).toBe("120bpm");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Japanese folds every count into `other`, which is the
    // claim worth sampling rather than assuming: if `selectForm` ever grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese tempo", () => {
    // Katakana in, katakana out, with nothing between the number and the word:
    // `japanese.renderQuantity` closes the gap on every branch, so the word is
    // set as tightly as a symbol.
    expect(engine.evaluate("50ヘルツ").formatted).toBe("50ヘルツ");
    // Latin in, Japanese out — the form outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("50 hz").formatted).toBe("50ヘルツ");
    expect(engine.evaluate("120 bpm").formatted).toBe("120bpm");
    // A conversion through each particle the language claims under `in`. Both
    // mark the *source* and attach to the end of the left operand, which is
    // where a head-final language puts a particle and where an infix operator
    // has to be. The group separator is "," and the decimal mark ".", read from
    // CLDR rather than transcribed.
    expect(engine.evaluate("90ヘルツをbpm").formatted).toBe("5,400bpm");
    expect(engine.evaluate("120bpmからhz").formatted).toBe("2ヘルツ");
    // A sum landing on a fraction.
    expect(engine.evaluate("1ヘルツ + 0.5ヘルツ").formatted).toBe("1.5ヘルツ");
    // The kanji numerals, this language's other unusual half: 百二十 is a
    // hundred and twenty, parsed by `japaneseNumerals` and not by any digit
    // rule.
    expect(engine.evaluate("百二十拍").formatted).toBe("120bpm");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "50ヘルツ",
      "120 bpm",
      "90ヘルツをbpm",
      "1ヘルツ + 0.5ヘルツ",
      "百二十拍",
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
