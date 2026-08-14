import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleZh from "./zh";

const engine = () =>
  createEngine({
    locales: [composeLocale(chinese, [angleZh])],
    kinds: [angle],
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
    kind: "angle",
    unit,
    slot,
  });
  return (angleZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // Every Chinese word is written in a script no ratio, unit id or magnitude
    // band can contain, so the script class *is* the assertion — where German
    // needed two sweeps because its nouns share the unit ids' alphabet.
    expect(JSON.stringify(angle)).not.toMatch(/[一-鿿]/u);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `chinese.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean something
    // (rule 6). The counts include the shapes that move `en` and `uk` — 1, the
    // 2/5/21 Slavic boundaries, a fraction, and zero — and none moves Chinese.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000]) {
        produced.add(
          chinese.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);
    // CLDR's own answer beside it, so "one row is the whole table" is measured
    // rather than asserted: the key set is closed at one because the language
    // has one category, not because this table stopped halfway.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);

    // `grad` is the one unit here with no `forms` at all, and the exact-key rule
    // is stated over the units that have a table: a unit with none never indexes
    // one, so there is no key for it to get wrong. The reason it has none is the
    // segmentation test below.
    for (const [unit, words] of Object.entries(angleZh.units)) {
      if (unit === "grad") {
        expect(words.forms).toBeUndefined();
        continue;
      }
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and Han has no case for that to
    // change, so the string this table prints is byte-for-byte the string the
    // index holds.
    for (const [unit, words] of Object.entries(angleZh.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("the gradian is refused twice over, and the radian is not refused at all", () => {
    // The measurement this file's one unusual decision rests on, and the check
    // `assertLocaleContract` structurally cannot make: it reads the alias index
    // and the analyzer chain, never the segmenter. Chinese writes no space
    // between words, so `chinese.segment` is the only thing between a letter run
    // and the alias index, and ICU's dictionary knows neither Chinese name for
    // the gradian.
    expect(chinese.segment?.("百分度")).toEqual(["百分", "度"]);
    expect(chinese.segment?.("新度")).toEqual(["新", "度"]);
    expect(angleZh.units.grad?.aliases).not.toContain("百分度");
    // And the second, independent reason: the word that *does* survive
    // segmentation is not this unit. 梯度 is the mathematical gradient, so
    // printing it would be a confident wrong answer where an unprintable one is
    // a quiet gap.
    expect(chinese.segment?.("梯度")).toEqual(["梯度"]);
    expect(angleZh.units.grad?.aliases).not.toContain("梯度");
    // The radian, which `@smartput/angle/locale/ja` cannot print because ICU
    // cuts ラジアン into ラジ + アン. Chinese uses the two characters Japanese
    // keeps only as a formal alternative, and ICU returns them whole.
    expect(chinese.segment?.("弧度")).toEqual(["弧度"]);
    // Every word this vocabulary does print survives the same trip.
    for (const [unit, words] of Object.entries(angleZh.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(chinese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [angleZh]), [angle]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Chinese that row is the same word as every other row, where German's is
    // a plural and Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [angleZh]), [angle], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("deg", 1)).toBe("度");
    expect(word("deg", 2)).toBe("度");
    expect(word("deg", 1.5)).toBe("度");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Umdrehungen") and Ukrainian to the locative ("в градусах"). Chinese
    // has no case to send it to.
    expect(word("deg", undefined, "conversion-target")).toBe("度");
    expect(word("turn", undefined, "conversion-target")).toBe("圈");
    expect(word("rad", 100)).toBe("弧度");
    // The unit with no table at all answers nothing, at every count.
    expect(word("grad", 200)).toBeUndefined();
    expect(word("grad", undefined, "conversion-target")).toBeUndefined();
  });

  test("周 is not claimed by the turn", () => {
    // A judgement about collision rather than about meaning: 周 is a correct
    // word for a full revolution and the ordinary word for a week, which a
    // Chinese duration vocabulary will want and which `@smartput/datetime` would
    // then have to separate from an angle with nothing but weight. 圈 and 转 have
    // no such second job.
    expect(angleZh.units.turn?.aliases).not.toContain("周");
    expect(angleZh.units.turn?.aliases).toContain("圈");
    expect(angleZh.units.turn?.aliases).toContain("转");
    expect(() => engine().evaluate("3周")).toThrow();
  });

  test("an engine built from it reads and writes Chinese angles", () => {
    const e = engine();
    // No space anywhere: `chinese.renderQuantity` closes the gap on every
    // branch, so a Chinese engine answers 90度 where an English one answers
    // "90 degrees".
    expect(e.evaluate("90度").formatted).toBe("90度");
    expect(e.evaluate("1圈").formatted).toBe("1圈");
    expect(e.evaluate("1弧度").formatted).toBe("1弧度");
    // A fraction, which moves nothing at all in Chinese.
    expect(e.evaluate("0.5圈").formatted).toBe("0.5圈");
    expect(e.evaluate("45度 + 45度").formatted).toBe("90度");
    // Two of the four `in` words, each of which begins a conversion on its own.
    expect(e.evaluate("1圈到度").formatted).toBe("360度");
    expect(e.evaluate("360度换算圈").formatted).toBe("1圈");
    // 转 is read and never written, so a tachometer's word answers in the
    // printed one.
    expect(e.evaluate("3转").formatted).toBe("3圈");
    // The wordless unit, printing its symbol and reading it back — a Latin run
    // has no character of a declared script, so `scriptSegmenter` returns it
    // whole and 200grad lexes as one word.
    expect(e.evaluate("200grad").formatted).toBe("200grad");
    expect(e.evaluate("100grad到度").formatted).toBe("90度");
    // And the failure the whole gradian decision exists to avoid, asserted
    // rather than described: the word a Chinese speaker would reach for first
    // does not reach the parser at all, because ICU handed `lex` 百分 and 度.
    expect(() => e.evaluate("100百分度")).toThrow();
  });

  test("its own output reads back to the same value", () => {
    // π is deliberately absent from this list. A radian's ratio is an irrational
    // constant carried to 30 significant digits, so a value printed through it
    // and read back lands a digit away from where it started — that is the
    // kind's own precision showing, not a vocabulary's round trip failing, and
    // asserting it here would be asserting decimal.js.
    const e = engine();
    for (const input of [
      "45度 + 45度",
      "1圈到度",
      "360度换算圈",
      "200grad",
      "1.5圈",
      "3转",
      "1弧度",
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
