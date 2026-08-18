import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massZh from "./zh";

const engine = () =>
  createEngine({
    locales: [composeLocale(chinese, [massZh])],
    kinds: [mass],
  });

/** The only key `chinese.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = chinese.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name `gramm` and `tonnen`
    // before it can sweep for umlauts; every Chinese word is written in a script
    // no ratio, unit id or magnitude band can contain, so the script class *is*
    // the assertion. The CJK ideographs, the one script `chinese.segment`
    // declares.
    expect(JSON.stringify(mass)).not.toMatch(/[一-鿿]/u);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `chinese.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean something
    // (rule 6). The counts deliberately include the shapes that move `en` and
    // `uk` — 1, the 2/5/21 Slavic boundaries, a fraction, and zero — and none of
    // them moves Chinese.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000]) {
        produced.add(
          chinese.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);
    // And CLDR's own answer beside it, so "one row is the whole table" is
    // measured rather than asserted: the key set is closed at one because the
    // language has one category, not because this table stopped halfway.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);

    for (const [unit, words] of Object.entries(massZh.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and Han has no case for that to
    // change, so the string this table prints is byte-for-byte the string the
    // index holds.
    for (const [unit, words] of Object.entries(massZh.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU returns every Chinese unit name as one word", () => {
    // The check that stands where a spaced language's "is there a space in it?"
    // stands, and the one `assertLocaleContract` structurally cannot make: it
    // reads the alias index and the analyzer chain, never the segmenter.
    // Chinese puts no space between words, so `chinese.segment` is the only
    // thing between a letter run and the alias index, and a name ICU cuts
    // reaches `lex` as two word tokens and can never be read back. Measured
    // rather than assumed — ICU cuts 品脱 into 品 + 脱, which is why
    // `@smartput/volume/locale/zh` cannot print the word for a pint.
    for (const [unit, words] of Object.entries(massZh.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(chinese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // And the run a conversion actually hands over, with the keyword in it.
    expect(chinese.segment?.("千克到克")).toEqual(["千克", "到", "克"]);
    expect(chinese.segment?.("克换算毫克")).toEqual(["克", "换算", "毫克"]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [massZh]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Chinese that row is the same word as every other row, where German's is
    // a plural and Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [massZh]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // The mirror image of the other tested languages: English marks number
    // always, German marks it on the feminine nouns, Ukrainian marks number and
    // case at once, and Chinese marks nothing. One string per unit is the
    // language and not an unfinished table.
    expect(word("kg", 1)).toBe("千克");
    expect(word("kg", 2)).toBe("千克");
    expect(word("kg", 1.5)).toBe("千克");
    expect(word("kg", 5)).toBe("千克");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // and Ukrainian to the locative. Chinese has no case to send it to.
    expect(word("kg", undefined, "conversion-target")).toBe("千克");
    expect(word("g", undefined, "conversion-target")).toBe("克");
    expect(word("t", 1000)).toBe("吨");
  });

  test("the standard name is printed and the colloquial one is read", () => {
    // 公斤 and 千克 are one unit in two registers. Both resolve; only one is
    // ever written back, so the engine's answer does not depend on the
    // question's register.
    expect(massZh.units.kg?.aliases).toContain("公斤");
    expect(massZh.units.kg?.forms?.other).toBe("千克");
    expect(engine().evaluate("3公斤").formatted).toBe("3千克");
    expect(engine().evaluate("3千克").formatted).toBe("3千克");
  });

  test("the market units are not claimed", () => {
    // 斤 is exactly 500 g and 两 exactly 50 g, and this kind declares no unit
    // for either — so they are refused rather than bent onto the nearest ratio.
    // 两 is refused twice over: `@smartput/core/locale/zh-cardinals` claims it as
    // the counting two, and `foldNumerals` turns a standalone numeral word into
    // a number token before any vocabulary is consulted, so "2两" lexes as two
    // numbers and never reaches a unit lookup at all.
    for (const words of Object.values(massZh.units)) {
      expect(words.aliases).not.toContain("斤");
      expect(words.aliases).not.toContain("两");
    }
    expect(() => engine().evaluate("5斤")).toThrow();
    expect(() => engine().evaluate("5两")).toThrow();
  });

  test("an engine built from it reads and writes Chinese mass", () => {
    const e = engine();
    // No space anywhere: `chinese.renderQuantity` closes the gap on every
    // branch, so a Chinese engine answers 5克 where an English one answers
    // "5 grams".
    expect(e.evaluate("1克").formatted).toBe("1克");
    expect(e.evaluate("5克").formatted).toBe("5克");
    expect(e.evaluate("2磅").formatted).toBe("2磅");
    expect(e.evaluate("3盎司").formatted).toBe("3盎司");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // both come from CLDR through `numberFormat: "intl"`, and are the same pair
    // English produces — Chinese groups its digits by thousands even though it
    // *speaks* by myriads — which is why `zh` reads its own grouped output back.
    expect(e.evaluate("1kg + 500g").formatted).toBe("1.5千克");
    expect(e.evaluate("1千克 + 500克").formatted).toBe("1.5千克");
    expect(e.evaluate("1.5吨").formatted).toBe("1.5吨");
    // Three of the four `in` words, each of which begins a conversion on its
    // own. That is why all four are declared rather than only the verbs.
    expect(e.evaluate("0.5千克到克").formatted).toBe("500克");
    expect(e.evaluate("500克换算千克").formatted).toBe("0.5千克");
    expect(e.evaluate("1千克为克").formatted).toBe("1,000克");
    // Latin input still reads, and answers in Chinese — the two registers of one
    // language this vocabulary declares side by side.
    expect(e.evaluate("2kg").formatted).toBe("2千克");
    expect(e.evaluate("2千克到克").formatted).toBe("2,000克");
  });

  test("a written-out numeral reads, where ICU's dictionary lets it", () => {
    // `chinese.numerals` is the third thing no Latin language in this repo
    // needed: 一, 二十, 一百 are how a quantity is written in prose, not
    // archaisms. They reach the unit through `foldNumerals`, which runs over
    // whole words, so what ICU does to the run decides whether they arrive.
    const e = engine();
    expect(e.evaluate("一千克").formatted).toBe("1千克");
    expect(e.evaluate("二十克").formatted).toBe("20克");
    expect(e.evaluate("一百克").formatted).toBe("100克");
    // The finding `@smartput/core/locale/zh` reports rather than fixes, pinned
    // here because it is a *mass* string that shows it: ICU breaks one shape
    // three ways. 一千克 comes back 一 | 千克 and is right; 五千克 comes back
    // 五千 | 克 and reads as five thousand grams — the same magnitude, the wrong
    // unit; 十克 comes back glued and does not parse at all. The only correction
    // a language could make is splitting numeral characters off the front of
    // every word, and that shreds 千克 itself, which begins with one.
    expect(chinese.segment?.("五千克")).toEqual(["五千", "克"]);
    expect(e.evaluate("五千克").value.unit).toBe("g");
    expect(chinese.segment?.("十克")).toEqual(["十克"]);
    expect(() => e.evaluate("十克")).toThrow();
  });

  test("an operator no longer needs a space when its operand is written in digits", () => {
    // This row used to record the second finding `@smartput/core/locale/zh`
    // reported rather than fixed: `lex` appended a letter run's trailing digits
    // to the last segmented word — the rule that makes the "m2" alias reachable
    // — and in an unspaced language the word before the digits is often the
    // operator, so 加3 became one word and never parsed.
    //
    // The digit-inside-run split ended it. A digit run followed by a letter now
    // ends the word unless some vocabulary spells a unit that way, so 加3 splits
    // while 平方米2 and "cm2" stay whole. Chinese gets this from a rule added
    // for "1h30m", which is the argument for it living in `lex`.
    const e = engine();
    expect(e.evaluate("5千克加3千克").formatted).toBe("8千克");
    expect(e.evaluate("5千克 加 3千克").formatted).toBe("8千克");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which `de.test.ts` deliberately cannot do: `zh`
    // groups with "," and the lexer reads that back as a group separator.
    const e = engine();
    for (const input of [
      "1kg + 500g",
      "0.5千克到克",
      "2千克到克",
      "3盎司",
      "1.5吨",
      "1000毫克",
      "3公斤",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
    }
  });
});
