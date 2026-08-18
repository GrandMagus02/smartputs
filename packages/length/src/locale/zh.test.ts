import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthZh from "./zh";

const engine = () =>
  createEngine({
    locales: [composeLocale(chinese, [lengthZh])],
    kinds: [length],
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
    kind: "length",
    unit,
    slot,
  });
  return (lengthZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // Every Chinese word is written in a script no ratio, unit id or magnitude
    // band can contain, so the script class *is* the assertion — where German
    // needed two sweeps because its nouns share the unit ids' alphabet.
    expect(JSON.stringify(length)).not.toMatch(/[一-鿿]/u);
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
            kind: "length",
            unit: "m",
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

    for (const [unit, words] of Object.entries(lengthZh.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and Han has no case for that to
    // change, so the string this table prints is byte-for-byte the string the
    // index holds.
    for (const [unit, words] of Object.entries(lengthZh.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU returns every Chinese unit name as one word", () => {
    // The check `assertLocaleContract` structurally cannot make: it reads the
    // alias index and the analyzer chain, never the segmenter. Chinese writes no
    // space between words, so `chinese.segment` is the only thing between a
    // letter run and the alias index, and a name ICU cuts reaches `lex` as two
    // word tokens and can never be read back. Measured rather than assumed — ICU
    // cuts 平方厘米 into 平方 + 厘米, which is why `@smartput/area/locale/zh`
    // cannot print the word for a square centimetre.
    for (const [unit, words] of Object.entries(lengthZh.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(chinese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // The metric compounds are what a splitter would exist for in German, and
    // there is none here because nothing ever finds a morpheme: each arrives as
    // one token and is claimed by an exact entry at weight 0.
    expect(chinese.segment?.("公里到米")).toEqual(["公里", "到", "米"]);
    expect(chinese.segment?.("厘米换算毫米")).toEqual(["厘米", "换算", "毫米"]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [lengthZh]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Chinese that row is the same word as every other row, where German's is
    // a plural and Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [lengthZh]), [length], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("m", 1)).toBe("米");
    expect(word("m", 2)).toBe("米");
    expect(word("m", 1.5)).toBe("米");
    expect(word("m", 1000)).toBe("米");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Metern") and Ukrainian to the locative ("в метрах"). Chinese has no
    // case to send it to.
    expect(word("m", undefined, "conversion-target")).toBe("米");
    expect(word("km", undefined, "conversion-target")).toBe("公里");
    expect(word("in", 27)).toBe("英寸");
  });

  test("`in` is reserved, and 英寸 costs nothing to lose it", () => {
    // `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
    // without consulting a locale, so a Chinese entry for `in` would put the
    // word back in front of `@smartput/datetime`'s accept-gate in any engine
    // that also speaks English.
    expect(lengthZh.units.in?.aliases).not.toContain("in");
    expect(lengthZh.units.in?.symbol).toBe("英寸");
    expect(engine().evaluate("27英寸").formatted).toBe("27英寸");
  });

  test("公里 is printed and 千米 is read", () => {
    // Both are the kilometre. 公里 wins the printed slot on frequency, and ICU
    // settles the matter from the other side: it cuts 平方千米 and returns
    // 平方公里 whole, so `@smartput/area/locale/zh` can only print the 公里
    // spelling, and one dimension is described in one register across the two
    // packages.
    expect(lengthZh.units.km?.aliases).toContain("千米");
    expect(lengthZh.units.km?.forms?.other).toBe("公里");
    expect(engine().evaluate("5千米").formatted).toBe("5公里");
    expect(chinese.segment?.("平方千米")).toEqual(["平方", "千米"]);
    expect(chinese.segment?.("平方公里")).toEqual(["平方公里"]);
  });

  test("the market units are not claimed", () => {
    // 里 is 500 m and not a mile, 尺 and 寸 are the 市尺 and 市寸 of the same
    // system, and this kind declares no unit for any of them. 里 is the sharper
    // case because it is a substring of both 公里 and 英里: `chinese.analyze` is
    // `identity()` alone precisely so that no stripper can take a character off
    // a real unit and land on one this kind never declared.
    for (const words of Object.values(lengthZh.units)) {
      expect(words.aliases).not.toContain("里");
      expect(words.aliases).not.toContain("尺");
      expect(words.aliases).not.toContain("寸");
    }
    expect(() => engine().evaluate("5里")).toThrow();
  });

  test("an engine built from it reads and writes Chinese lengths", () => {
    const e = engine();
    // No space anywhere: `chinese.renderQuantity` closes the gap on every
    // branch, so a Chinese engine answers 5米 where an English one answers
    // "5 metres".
    expect(e.evaluate("1米").formatted).toBe("1米");
    expect(e.evaluate("5公里").formatted).toBe("5公里");
    expect(e.evaluate("2英寸").formatted).toBe("2英寸");
    expect(e.evaluate("3码").formatted).toBe("3码");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // come from CLDR through `numberFormat: "intl"` and are the same pair
    // English produces, which is why `zh` reads its own grouped output back.
    expect(e.evaluate("1km + 500m").formatted).toBe("1.5公里");
    expect(e.evaluate("1米 + 50厘米").formatted).toBe("1.5米");
    // Two of the four `in` words, each of which begins a conversion on its own.
    expect(e.evaluate("0.5公里到米").formatted).toBe("500米");
    expect(e.evaluate("500厘米换算米").formatted).toBe("5米");
    expect(e.evaluate("36英寸到英尺").formatted).toBe("3英尺");
    expect(e.evaluate("1英里到公里").formatted).toBe("1.6093公里");
    // Latin input still reads, and answers in Chinese.
    expect(e.evaluate("2m").formatted).toBe("2米");
    // The Taiwanese spellings, read and normalised to the mainland ones.
    expect(e.evaluate("3公尺").formatted).toBe("3米");
    expect(e.evaluate("5吋").formatted).toBe("5英寸");
    expect(e.evaluate("1哩").formatted).toBe("1英里");
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "1km + 500m",
      "0.5公里到米",
      "36英寸到英尺",
      "1英里到公里",
      "3公尺",
      "2m",
      "1000毫米",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
    }
  });
});
