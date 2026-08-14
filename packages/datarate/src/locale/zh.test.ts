import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateZh from "./zh";

const locale = () => composeLocale(chinese, [datarateZh]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;
const COUNTS = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000];

/** Every key `chinese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  COUNTS.flatMap((count) =>
    SLOTS.map((slot) =>
      chinese.selectForm({
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
      SLOTS.map((slot) => chinese.selectForm({ kind: "datarate", unit: "mbps", slot })),
    ),
);

/** Han, the one script Simplified Chinese writes its words in. */
const HAN = /\p{Script=Han}/u;

describe("datarate zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // The script as a class rather than a list of the words: the kind is five
    // ratios, five unit ids, the magnitude bands and four bridge signatures, so
    // any Han character reaching it is the failure.
    expect(JSON.stringify(datarate)).not.toMatch(HAN);
  });

  test("`chinese` asks for exactly one key, and no unit needs it", () => {
    // The contract the language author pinned: Chinese marks number nowhere on a
    // noun, so every count — the fractional 1.5 and the count-free conversion
    // target included — and every slot come back "other". A one-row `forms`
    // table is therefore the correct answer for this language and never a stub;
    // rule 6 wants exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    // This kind has nothing to put in the row: a rate is a compound in Chinese as
    // in English, and the head noun does not survive the segmenter besides.
    for (const [unit, words] of Object.entries(datarateZh.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(datarateZh.units)) {
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

  test("no unit claims a Chinese alias, and the measurement is why", () => {
    // The rare vocabulary in this repo with no word of its own language in it.
    // Chinese is unspaced, so `lex` hands each letter run to `chinese.segment`
    // before anything is looked up, and ICU does not hold 比特 together at all —
    // it is a phonetic loan spelled with two ordinary characters, 比 "compare"
    // and 特 "special", which is exactly the shape a frequency-trained dictionary
    // takes apart. An alias the lexer can never hand to the index is dead weight
    // rather than documentation.
    expect(chinese.segment?.("比特")).toEqual(["比", "特"]);
    expect(chinese.segment?.("比特每秒")).toEqual(["比", "特", "每秒"]);
    expect(chinese.segment?.("兆比特每秒")).toEqual(["兆", "比", "特", "每秒"]);
    for (const [unit, words] of Object.entries(datarateZh.units)) {
      for (const surface of words.aliases) {
        expect(surface, `${unit} claims the Han alias "${surface}"`).not.toMatch(HAN);
      }
    }
  });

  test("兆 is a real word for this kind that `datasize` owns instead", () => {
    // 「100兆宽带」 is a hundred-megabit line, so the bare prefix is genuinely
    // this kind's word too — and the alias index has no kind in its key, so
    // exactly one kind can own the standalone reading. It goes to `datasize`,
    // because standing alone after a number 兆 is a file size; the broadband
    // sense is always followed by 宽带 or 光纤, which lex as separate words and
    // end the parse whichever kind had claimed the prefix. Pinned here so the
    // ruling is visible from the side that gave it up.
    const claimed = Object.values(datarateZh.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("兆");
    expect(chinese.segment?.("100兆宽带")).toEqual(["兆", "宽", "带"]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Chinese folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], { counts: COUNTS }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese data rates", () => {
    // The Chinese here is the connective and the numeral rather than the unit
    // word, which is exactly what this kind has to offer — and the spacing, which
    // is the language's: `chinese.renderQuantity` puts nothing between the number
    // and the label on any branch, symbols included.
    expect(engine.evaluate("100 mbps").formatted).toBe("100Mbps");
    // A conversion through the verb 换算 and through the particle 到, the second
    // landing on a fraction. The decimal mark is "." and the group separator ","
    // — read from CLDR through `numberFormat: "intl"` rather than transcribed,
    // and identical to `en` even though Chinese *speaks* by myriads.
    expect(engine.evaluate("2500mbps到gbps").formatted).toBe("2.5Gbps");
    expect(engine.evaluate("1gbps换算mbps").formatted).toBe("1,000Mbps");
    expect(engine.evaluate("5tbps为gbps").formatted).toBe("5,000Gbps");
    // A sum landing on a fraction. The operands are spaced, which finding 2 in
    // the language notes requires: `lex` appends a letter run's trailing digits
    // to the last segmented word, so 「1gbps加500mbps」 would swallow the 500
    // into the operator 加.
    expect(engine.evaluate("1 gbps 加 500 mbps").formatted).toBe("1.5Gbps");
    // The Han numerals, this language's other unusual half — 二十 is twenty,
    // parsed by `chineseNumerals` and not by any digit rule.
    expect(engine.evaluate("二十mbps").formatted).toBe("20Mbps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 mbps",
      "2500mbps到gbps",
      "1gbps换算mbps",
      "1 gbps 加 500 mbps",
      "二十mbps",
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
