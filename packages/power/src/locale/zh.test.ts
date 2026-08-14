import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerZh from "./zh";

const locale = () => composeLocale(chinese, [powerZh]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;
const COUNTS = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000];

/** Every key `chinese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  COUNTS.flatMap((count) =>
    SLOTS.map((slot) =>
      chinese.selectForm({ count: new Decimal(count), kind: "power", unit: "hp", slot }),
    ),
  )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(SLOTS.map((slot) => chinese.selectForm({ kind: "power", unit: "hp", slot }))),
);

/** Han, the one script Simplified Chinese writes its words in. */
const HAN = /\p{Script=Han}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = chinese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("power zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // The script as a class rather than a list of the words: the kind is five
    // ratios, five unit ids and the magnitude bands, so any Han character
    // reaching it is the failure.
    expect(JSON.stringify(power)).not.toMatch(HAN);
  });

  test("only `hp` declares a form, and it declares exactly one", () => {
    // The contract the language author pinned: Chinese marks number nowhere on a
    // noun, so every count — the fractional 1.5 and the count-free conversion
    // target included — and every slot come back "other". A one-row table is the
    // correct and finished answer for this language, not a stub; rule 6 wants
    // exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(Object.keys(powerZh.units.hp?.forms ?? {})).toEqual([...KEYS]);
    // The watt family prints symbols throughout, because two of its four members
    // are words ICU takes apart and a family spells itself out only when every
    // member survives.
    for (const unit of ["w", "kw", "mw", "gw"] as const) {
      expect(powerZh.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("one word covers every count", () => {
    // The whole of Chinese number agreement, in four assertions. English needs a
    // `one` row beside an `other` row even where both spell "horsepower", and
    // Ukrainian needs eight; Chinese needs one word, and the count-free
    // conversion target takes the same one.
    expect(word("hp", 1)).toBe("马力");
    expect(word("hp", 150)).toBe("马力");
    expect(word("hp", 1.5)).toBe("马力");
    expect(word("hp", undefined, "conversion-target")).toBe("马力");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(powerZh.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      for (const surface of [
        words.symbol as string,
        ...Object.values(words.forms ?? {}),
      ]) {
        expect(
          surface,
          `${unit}'s printable "${surface}" holds an operator character`,
        ).not.toMatch(/[/*+\-·×⋅]/);
        expect(folded, `${unit}'s printable "${surface}" is not an alias`).toContain(
          surface.toLowerCase(),
        );
      }
    }
  });

  test("千瓦 survives whole where 兆瓦 and 吉瓦 do not", () => {
    // The measurement behind the whole table, re-run rather than trusted.
    // Chinese is unspaced, so `lex` hands each letter run to `chinese.segment`
    // before anything is looked up, and a word ICU breaks never reaches the alias
    // index as one token.
    expect(chinese.segment?.("瓦")).toEqual(["瓦"]);
    expect(chinese.segment?.("瓦特")).toEqual(["瓦特"]);
    expect(chinese.segment?.("千瓦")).toEqual(["千瓦"]);
    expect(chinese.segment?.("兆瓦")).toEqual(["兆", "瓦"]);
    expect(chinese.segment?.("吉瓦")).toEqual(["吉", "瓦"]);
    expect(chinese.segment?.("马力")).toEqual(["马力"]);
    // 千瓦 is the one that had to be checked rather than assumed: 千 is
    // `zh-cardinals.ts`'s scale word for a thousand, so a cut here would not
    // merely strand a fragment — 「5千瓦」 would lex as 5 then the number 1000.
    expect(chinese.numerals?.(["千"])?.value.toString()).toBe("1000");
    expect(chinese.numerals?.(["千瓦"])).toBeNull();
    const claimed = Object.values(powerZh.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("兆瓦");
    expect(claimed).not.toContain("吉瓦");
    // "PS" is common on Chinese car pages and is still a coinage over what
    // `units.ts` declares rather than a reading of it.
    expect(claimed).not.toContain("PS");
  });

  test("every Chinese alias and form survives the segmenter whole", () => {
    // 马力 is the load-bearing case, since it is a *printed* string and not
    // merely a read one: a break there would put a word on the page that the
    // engine could not take back.
    for (const [unit, words] of Object.entries(powerZh.units)) {
      for (const surface of [...words.aliases, ...Object.values(words.forms ?? {})]) {
        if (!HAN.test(surface)) continue;
        expect(chinese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Chinese folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [power], { counts: COUNTS }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese power", () => {
    // The one unit that prints as a word, at counts that would move English and
    // Ukrainian and do not move Chinese. Nothing separates the number from the
    // word: `chinese.renderQuantity` closes the gap on every branch, so a word is
    // set as tightly as a symbol.
    expect(engine.evaluate("150马力").formatted).toBe("150马力");
    expect(engine.evaluate("1马力").formatted).toBe("1马力");
    expect(engine.evaluate("1.5马力").formatted).toBe("1.5马力");
    // Latin in, Chinese out: "hp" is an alias from `units.ts` and the form
    // outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("200 hp").formatted).toBe("200马力");
    // The watt family goes the other way — 千瓦 is read and "kW" is printed,
    // because 兆瓦 and 吉瓦 could not be read at all.
    expect(engine.evaluate("500千瓦").formatted).toBe("500kW");
    // A conversion through the particle 到 and through the verb 转换, the second
    // landing on a fraction. The group separator is "," and the decimal mark ".",
    // read from CLDR through `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("2千瓦到w").formatted).toBe("2,000W");
    expect(engine.evaluate("500瓦转换千瓦").formatted).toBe("0.5kW");
    // A sum landing on a fraction. The operands are spaced, which finding 2 in
    // the language notes requires: `lex` appends a letter run's trailing digits
    // to the last segmented word, so 「1千瓦加500瓦」 would swallow the 500 into
    // the operator 加.
    expect(engine.evaluate("1千瓦 + 500瓦").formatted).toBe("1.5kW");
    // The Han numerals, this language's other unusual half.
    expect(engine.evaluate("二十马力").formatted).toBe("20马力");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "150马力",
      "1.5马力",
      "200 hp",
      "500千瓦",
      "2千瓦到w",
      "1千瓦 + 500瓦",
      "二十马力",
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
