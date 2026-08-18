import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeZh from "./zh";

const engine = () =>
  createEngine({
    locales: [composeLocale(chinese, [volumeZh])],
    kinds: [volume],
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
    kind: "volume",
    unit,
    slot,
  });
  return (volumeZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // Every Chinese word is written in a script no ratio, unit id or magnitude
    // band can contain, so the script class *is* the assertion — where German
    // needed two sweeps because its nouns share the unit ids' alphabet.
    expect(JSON.stringify(volume)).not.toMatch(/[一-鿿]/u);
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
            kind: "volume",
            unit: "l",
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

    // `pint` is the one unit here with no `forms` at all, and the exact-key rule
    // is stated over the units that have a table: a unit with none never indexes
    // one, so there is no key for it to get wrong. The reason it has none is the
    // segmentation test below.
    for (const [unit, words] of Object.entries(volumeZh.units)) {
      if (unit === "pint") {
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
    for (const [unit, words] of Object.entries(volumeZh.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU cuts 品脱 in two, which is why the pint has no words", () => {
    // The measurement this file's one unusual decision rests on, reported as
    // measured rather than as intended, and the check `assertLocaleContract`
    // structurally cannot make: it reads the alias index and the analyzer chain,
    // never the segmenter. Chinese writes no space between words, so
    // `chinese.segment` is the only thing between a letter run and the alias
    // index — and ICU's dictionary does not know 品脱, so it falls back to a
    // two-piece break. 2品脱 therefore reaches `lex` as two word tokens and dies
    // in the parser.
    expect(chinese.segment?.("品脱")).toEqual(["品", "脱"]);
    expect(volumeZh.units.pint?.aliases).not.toContain("品脱");
    // 立方米 is the unit that pays for making the check at all: it looks exactly
    // as likely to be cut — a Han compound of the same length — and comes back
    // whole, which is why this package prints a word `en` and `uk` cannot.
    expect(chinese.segment?.("立方米")).toEqual(["立方米"]);
    // Every word this vocabulary does print survives the same trip.
    for (const [unit, words] of Object.entries(volumeZh.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(chinese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
  });

  test("升到 glues, and the other three conversion words do not", () => {
    // A finding reported rather than fixed, and one only a single-character unit
    // can hit: 升到 is itself a word ("rise to"), so ICU claims it and the run
    // 升到毫升 arrives as two tokens with the keyword swallowed. No keyword table
    // can undo that — the segmenter runs first. The other three `in` words are
    // exactly why all four are declared: each begins a conversion on its own,
    // and 换算, 转换 and 为 all break cleanly against the same unit.
    expect(chinese.segment?.("升到毫升")).toEqual(["升到", "毫升"]);
    expect(chinese.segment?.("升换算毫升")).toEqual(["升", "换算", "毫升"]);
    expect(chinese.segment?.("升为毫升")).toEqual(["升", "为", "毫升"]);
    const e = engine();
    expect(() => e.evaluate("0.5升到毫升")).toThrow();
    expect(e.evaluate("0.5升换算毫升").formatted).toBe("500毫升");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [volumeZh]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Chinese that row is the same word as every other row, where German's is
    // a plural and Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [volumeZh]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("l", 1)).toBe("升");
    expect(word("l", 2)).toBe("升");
    expect(word("l", 1.5)).toBe("升");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // and Ukrainian to the locative. Chinese has no case to send it to.
    expect(word("l", undefined, "conversion-target")).toBe("升");
    expect(word("m3", undefined, "conversion-target")).toBe("立方米");
    expect(word("ml", 1000)).toBe("毫升");
    // The unit with no table at all answers nothing, at every count.
    expect(word("pint", 1)).toBeUndefined();
    expect(word("pint", undefined, "conversion-target")).toBeUndefined();
  });

  test("the market measures are not claimed", () => {
    // 斗 is ten 市升 and 合 a tenth of one, and this kind declares no unit for
    // either — so they are refused rather than approximated onto the litre.
    for (const words of Object.values(volumeZh.units)) {
      expect(words.aliases).not.toContain("斗");
      expect(words.aliases).not.toContain("合");
    }
    expect(() => engine().evaluate("5斗")).toThrow();
  });

  test("an engine built from it reads and writes Chinese volumes", () => {
    const e = engine();
    // No space anywhere: `chinese.renderQuantity` closes the gap on every
    // branch, so a Chinese engine answers 500毫升 where an English one answers
    // "500 millilitres".
    expect(e.evaluate("1升").formatted).toBe("1升");
    expect(e.evaluate("500毫升").formatted).toBe("500毫升");
    expect(e.evaluate("2加仑").formatted).toBe("2加仑");
    // The unit `en` and `uk` could not print, printed.
    expect(e.evaluate("1m³").formatted).toBe("1立方米");
    expect(e.evaluate("1立米").formatted).toBe("1立方米");
    // Arithmetic landing on a fraction, and the grouped output CLDR's ","
    // gives — which `zh` reads back, unlike `de`.
    expect(e.evaluate("1l + 500ml").formatted).toBe("1.5升");
    expect(e.evaluate("1立方米到升").formatted).toBe("1,000升");
    expect(e.evaluate("1加仑到升").formatted).toBe("3.7854升");
    // The fuller name of the litre, read and normalised to the printed one.
    expect(e.evaluate("3公升").formatted).toBe("3升");
    // The wordless unit, printing its symbol and reading it back — a Latin run
    // has no character of a declared script, so `scriptSegmenter` returns it
    // whole and 2pint lexes as one word.
    expect(e.evaluate("2pint").formatted).toBe("2pint");
    // And the failure the whole pint decision exists to avoid, asserted rather
    // than described: the word a Chinese speaker would reach for first does not
    // reach the parser at all, because ICU handed `lex` 品 and 脱.
    expect(() => e.evaluate("1品脱")).toThrow(/品/);
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "1l + 500ml",
      "1立方米到升",
      "1加仑到升",
      "0.5升换算毫升",
      "3公升",
      "2pint",
      "1m³",
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
