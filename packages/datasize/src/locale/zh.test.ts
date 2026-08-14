import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeZh from "./zh";

const locale = () => composeLocale(chinese, [datasizeZh]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;
const COUNTS = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000];

/** Every key `chinese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  COUNTS.flatMap((count) =>
    SLOTS.map((slot) =>
      chinese.selectForm({
        count: new Decimal(count),
        kind: "datasize",
        unit: "mb",
        slot,
      }),
    ),
  )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => chinese.selectForm({ kind: "datasize", unit: "mb", slot })),
    ),
);

/** Han, the one script Simplified Chinese writes its words in. */
const HAN = /\p{Script=Han}/u;

describe("datasize zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // The script as a class rather than a list of the words: the kind is nine
    // ratios, nine unit ids and the magnitude bands, so any Han character
    // reaching it is the failure.
    expect(JSON.stringify(datasize)).not.toMatch(HAN);
  });

  test("`chinese` asks for exactly one key, and no unit needs it", () => {
    // The contract the language author pinned: Chinese marks number nowhere on a
    // noun, so every count — the fractional 1.5 and the count-free conversion
    // target included — and every slot come back "other". A one-row table is the
    // correct answer for this language and never a stub; rule 6 wants exactly
    // that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    // No unit declares one, because there is no Chinese string this kind could
    // print and read back — see the segmentation test below.
    for (const [unit, words] of Object.entries(datasizeZh.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(datasizeZh.units)) {
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

  test("ICU knows none of this kind's Chinese names", () => {
    // The measurement behind every empty `forms` table above, re-run rather than
    // trusted. Chinese is unspaced, so `lex` hands each letter run to
    // `chinese.segment` before anything is looked up, and a word ICU breaks
    // never reaches the alias index as one token however faithfully it is
    // written. 千字节 is the worst of them: the stranded first character is the
    // numeral 千, so the fragment does not merely fail to resolve — it reads as
    // the number 1000.
    expect(chinese.segment?.("字节")).toEqual(["字", "节"]);
    expect(chinese.segment?.("千字节")).toEqual(["千", "字", "节"]);
    expect(chinese.segment?.("兆字节")).toEqual(["兆", "字", "节"]);
    expect(chinese.segment?.("吉字节")).toEqual(["吉", "字", "节"]);
    expect(chinese.segment?.("太字节")).toEqual(["太字", "节"]);
    expect(chinese.segment?.("比特")).toEqual(["比", "特"]);
    const claimed = Object.values(datasizeZh.units).flatMap((w) => [...w.aliases]);
    for (const broken of ["字节", "千字节", "兆字节", "吉字节", "太字节", "比特"]) {
      expect(claimed, `${broken} is claimed but unreachable`).not.toContain(broken);
    }
  });

  test("兆 is the one Chinese word this kind claims, and it survives whole", () => {
    // The bare SI prefix standing for the unit — 「这个文件20兆」 — the same
    // elision English's "megs" rests on. One character, so ICU returns it whole;
    // absent from `zh-cardinals.ts` (whose ladder stops at 亿), so `foldNumerals`
    // does not turn it into a number on the way past. Both halves matter, and
    // both are measured here rather than argued in the doc comment.
    expect(chinese.segment?.("兆")).toEqual(["兆"]);
    expect(chinese.numerals?.(["兆"])).toBeNull();
    expect(datasizeZh.units.mb?.aliases).toContain("兆");
    expect(engine.evaluate("20兆").formatted).toBe("20MB");
    // 吉 and 太 are not claimed beside it: neither is ever elided the way 兆 is,
    // and as bare characters they are "auspicious" and "too/very" — two of the
    // commonest words in the language.
    const claimed = Object.values(datasizeZh.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("吉");
    expect(claimed).not.toContain("太");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Chinese folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datasize], { counts: COUNTS }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese data sizes", () => {
    // Nothing between the number and the label on any branch, symbols included:
    // `chinese.renderQuantity` sets 「1.5GB」 as tightly as it sets 「5秒」.
    expect(engine.evaluate("1.5 gb").formatted).toBe("1.5GB");
    expect(engine.evaluate("20兆").formatted).toBe("20MB");
    // A conversion through the verb 换算 and through the particle 到, and one
    // that lands on a fraction. The decimal mark is ".", read from CLDR through
    // `numberFormat: "intl"` rather than transcribed, and the group separator is
    // "," — Chinese groups by thousands even though it *speaks* by myriads.
    expect(engine.evaluate("1536兆到gb").formatted).toBe("1.536GB");
    expect(engine.evaluate("1kib换算b").formatted).toBe("1,024B");
    // A sum landing on a fraction. The operands are spaced, which is what finding
    // 2 in the language notes requires: `lex` appends a letter run's trailing
    // digits to the last segmented word, so 「1gb+512兆」 would swallow the 512
    // into the operator.
    expect(engine.evaluate("1 gb + 512 兆").formatted).toBe("1.512GB");
    // The Han numerals, this language's other unusual half.
    expect(engine.evaluate("二十兆").formatted).toBe("20MB");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1.5 gb",
      "20兆",
      "1536兆到gb",
      "1kib换算b",
      "1 gb + 512 兆",
      "二十兆",
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
