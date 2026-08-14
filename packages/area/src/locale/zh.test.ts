import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaZh from "./zh";

const engine = () =>
  createEngine({
    locales: [composeLocale(chinese, [areaZh])],
    kinds: [area],
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
    kind: "area",
    unit,
    slot,
  });
  return (areaZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // Every Chinese word is written in a script no ratio, unit id or magnitude
    // band can contain, so the script class *is* the assertion — where German
    // needed two sweeps because its nouns share the unit ids' alphabet.
    expect(JSON.stringify(area)).not.toMatch(/[一-鿿]/u);
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
            kind: "area",
            unit: "m2",
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

    // `cm2` is the one unit here with no `forms` at all, and the exact-key rule
    // is stated over the units that have a table: a unit with none never indexes
    // one, so there is no key for it to get wrong. The reason it has none is the
    // segmentation test below.
    for (const [unit, words] of Object.entries(areaZh.units)) {
      if (unit === "cm2") {
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
    for (const [unit, words] of Object.entries(areaZh.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU cuts 平方厘米 in two, which is why cm² has no words", () => {
    // The measurement this file's one unusual decision rests on, reported as
    // measured rather than as intended, and the check `assertLocaleContract`
    // structurally cannot make: it reads the alias index and the analyzer chain,
    // never the segmenter. Chinese writes no space between words, so
    // `chinese.segment` is the only thing between a letter run and the alias
    // index — and ICU's dictionary does not know 平方厘米, so it falls back to a
    // two-piece break. 100平方厘米 therefore reaches `lex` as two word tokens and
    // dies in the parser, which is the same failure `assertLocaleContract` names
    // for a printed phrase in a spaced language, arriving through a different
    // door.
    expect(chinese.segment?.("平方厘米")).toEqual(["平方", "厘米"]);
    // The Taiwanese synonym goes the same way, so there is no second spelling to
    // move to — unlike the gradian in `@smartput/angle/locale/ja`, which had one.
    expect(chinese.segment?.("平方公分")).toEqual(["平方", "公分"]);
    expect(areaZh.units.cm2?.aliases).not.toContain("平方厘米");
    // The two that do survive, and the reason `km2` is printed as 平方公里 and
    // not as 平方千米.
    expect(chinese.segment?.("平方米")).toEqual(["平方米"]);
    expect(chinese.segment?.("平方公里")).toEqual(["平方公里"]);
    expect(chinese.segment?.("平方千米")).toEqual(["平方", "千米"]);
    // Every word this vocabulary does print survives the same trip.
    for (const [unit, words] of Object.entries(areaZh.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(chinese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [areaZh]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Chinese that row is the same word as every other row, where German's is
    // a plural and Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [areaZh]), [area], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("m2", 1)).toBe("平方米");
    expect(word("m2", 2)).toBe("平方米");
    expect(word("m2", 1.5)).toBe("平方米");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // and Ukrainian to the locative. Chinese has no case to send it to.
    expect(word("m2", undefined, "conversion-target")).toBe("平方米");
    expect(word("hectare", undefined, "conversion-target")).toBe("公顷");
    expect(word("acre", 100)).toBe("英亩");
    // The unit with no table at all answers nothing, at every count.
    expect(word("cm2", 1)).toBeUndefined();
    expect(word("cm2", undefined, "conversion-target")).toBeUndefined();
  });

  test("the Chinese land units are not claimed", () => {
    // 亩 is 666.67 m² and 公亩 is 100 m², and this kind declares no unit for
    // either — so they are refused rather than bent onto the nearest ratio. 公亩
    // is the trap worth naming twice: one character from 公顷, and a hundredth of
    // it.
    for (const words of Object.values(areaZh.units)) {
      expect(words.aliases).not.toContain("亩");
      expect(words.aliases).not.toContain("公亩");
    }
    expect(() => engine().evaluate("5亩")).toThrow();
    expect(() => engine().evaluate("5公亩")).toThrow();
  });

  test("an engine built from it reads and writes Chinese areas", () => {
    const e = engine();
    // No space anywhere: `chinese.renderQuantity` closes the gap on every
    // branch, so a Chinese engine answers 1平方米 where an English one answers
    // "1m²".
    expect(e.evaluate("1平方米").formatted).toBe("1平方米");
    expect(e.evaluate("5公顷").formatted).toBe("5公顷");
    expect(e.evaluate("2英亩").formatted).toBe("2英亩");
    // The colloquial and Taiwanese readings of the square metre, normalised to
    // the one printed form.
    expect(e.evaluate("2平米").formatted).toBe("2平方米");
    expect(e.evaluate("1平方公尺").formatted).toBe("1平方米");
    // Conversions in both directions, and the grouped output CLDR's "," gives —
    // which `zh` reads back, unlike `de`.
    expect(e.evaluate("1平方公里到平方米").formatted).toBe("1,000,000平方米");
    expect(e.evaluate("10000平方米到公顷").formatted).toBe("1公顷");
    // Arithmetic landing on a fraction, across the wordless unit and a spoken
    // one.
    expect(e.evaluate("1平方米 + 5000cm²").formatted).toBe("1.5平方米");
    // The wordless unit, printing its symbol and reading it back — a Latin run
    // has no character of a declared script, so `scriptSegmenter` returns it
    // whole and 1cm² lexes as one word.
    expect(e.evaluate("1cm²").formatted).toBe("1cm²");
    expect(e.evaluate("1平方米到cm²").formatted).toBe("10,000cm²");
    // And the failure the whole cm² decision exists to avoid, asserted rather
    // than described: the word a Chinese speaker would reach for first does not
    // reach the parser at all, because ICU handed `lex` 平方 and 厘米.
    expect(() => e.evaluate("100平方厘米")).toThrow(/平方/);
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "1平方公里到平方米",
      "10000平方米到公顷",
      "1平方米 + 5000cm²",
      "2英亩",
      "1.5公顷",
      "1cm²",
      "2平米",
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
