import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureZh from "./zh";

const engine = () =>
  createEngine({
    locales: [composeLocale(chinese, [measureZh])],
    kinds: [measure],
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
    kind: "measure",
    unit,
    slot,
  });
  return (measureZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // Every Chinese word is written in a script no ratio, unit id, magnitude
    // band or dpi closure can contain, so the script class *is* the assertion —
    // where German needed two sweeps because its nouns share the unit ids'
    // alphabet.
    expect(JSON.stringify(measure)).not.toMatch(/[一-鿿]/u);
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
            kind: "measure",
            unit: "pt",
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

    // `pc` and `px` are the two units here with no `forms` at all, and the
    // exact-key rule is stated over the units that have a table: a unit with
    // none never indexes one, so there is no key for it to get wrong. The reason
    // they have none is the segmentation test below.
    for (const [unit, words] of Object.entries(measureZh.units)) {
      if (unit === "pc" || unit === "px") {
        expect(words.forms, unit).toBeUndefined();
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
    for (const [unit, words] of Object.entries(measureZh.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU cuts 像素 and 派卡 in two, which is why px and pc have no words", () => {
    // The measurement this file's two unusual rows rest on, reported as measured
    // rather than as intended, and the check `assertLocaleContract` structurally
    // cannot make: it reads the alias index and the analyzer chain, never the
    // segmenter. 像素 is not an obscure word — it is *the* word for a pixel, in
    // every stylesheet and every camera specification — and ICU's Chinese
    // dictionary still falls back to a two-piece break on it, so 100像素 reaches
    // `lex` as two word tokens and dies in the parser.
    expect(chinese.segment?.("像素")).toEqual(["像", "素"]);
    expect(chinese.segment?.("派卡")).toEqual(["派", "卡"]);
    // The variant spelling of the pica goes the same way, so there is no second
    // name to move to — unlike the gradian in `@smartput/angle/locale/ja`, which
    // had one.
    expect(chinese.segment?.("皮卡")).toEqual(["皮", "卡"]);
    expect(measureZh.units.px?.aliases).not.toContain("像素");
    expect(measureZh.units.pc?.aliases).not.toContain("派卡");
    // Every word this vocabulary does print survives the same trip.
    for (const [unit, words] of Object.entries(measureZh.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(chinese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [measureZh]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Chinese that row is the same word as every other row, where German's is
    // a plural and Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(chinese, [measureZh]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("pt", 1)).toBe("磅");
    expect(word("pt", 2)).toBe("磅");
    expect(word("pt", 1.5)).toBe("磅");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // and Ukrainian to the locative. Chinese has no case to send it to.
    expect(word("pt", undefined, "conversion-target")).toBe("磅");
    expect(word("inch", undefined, "conversion-target")).toBe("英寸");
    expect(word("mm", 1000)).toBe("毫米");
    // The two units with no table at all answer nothing, at every count.
    expect(word("px", 96)).toBeUndefined();
    expect(word("pc", undefined, "conversion-target")).toBeUndefined();
  });

  test("磅 is the point, and 点 is the rejected alternative", () => {
    // A Chinese word processor labels its font-size box 磅, and the same
    // character is the pound in `@smartput/mass/locale/zh`: an engine installing
    // both kinds gets two readings and settles them by weight, exactly as it
    // already does for the mm and cm this kind shares with `length`. 点 is the
    // other correct name and is left out on frequency — 3点 is three in the
    // afternoon long before it is a three-point rule, which is the judgement
    // `@smartput/angle/locale/ja` makes about 回.
    expect(measureZh.units.pt?.aliases).toContain("磅");
    expect(measureZh.units.pt?.aliases).not.toContain("点");
    expect(() => engine().evaluate("12点")).toThrow();
  });

  test("級 is not bent onto the nearest unit", () => {
    // The Cicero trap `@smartput/measure/locale/de` documents, reached through
    // Hong Kong and Taiwan phototypesetting: 級 is a quarter of a millimetre,
    // which is not a point, not a pica and not a pixel, and this kind declares
    // no unit for it. A `NoCandidateError` says "this engine does not know 級";
    // a 30 % error says nothing at all.
    for (const words of Object.values(measureZh.units)) {
      expect(words.aliases).not.toContain("級");
      expect(words.aliases).not.toContain("级");
    }
    expect(() => engine().evaluate("13级")).toThrow();
  });

  test("an engine built from it reads and writes Chinese typography", () => {
    const e = engine();
    // No space anywhere: `chinese.renderQuantity` closes the gap on every
    // branch, so a Chinese engine answers 72磅 where an English one answers
    // "72 points".
    expect(e.evaluate("72磅").formatted).toBe("72磅");
    expect(e.evaluate("1英寸").formatted).toBe("1英寸");
    expect(e.evaluate("10毫米").formatted).toBe("10毫米");
    expect(e.evaluate("2.54厘米").formatted).toBe("2.54厘米");
    // Conversions in both directions across the two registers this table
    // declares side by side.
    expect(e.evaluate("1英寸到磅").formatted).toBe("72磅");
    expect(e.evaluate("72磅到英寸").formatted).toBe("1英寸");
    expect(e.evaluate("1英寸到毫米").formatted).toBe("25.4毫米");
    expect(e.evaluate("25.4毫米换算英寸").formatted).toBe("1英寸");
    // Arithmetic landing on a fraction.
    expect(e.evaluate("1英寸 + 36磅").formatted).toBe("1.5英寸");
    // The Taiwanese spelling of the inch, read and normalised to the printed
    // one.
    expect(e.evaluate("5吋").formatted).toBe("5英寸");
    // The two wordless units, printing their symbols and reading them back — a
    // Latin run has no character of a declared script, so `scriptSegmenter`
    // returns it whole and 96px lexes as one word.
    expect(e.evaluate("96px").formatted).toBe("96px");
    expect(e.evaluate("6pc").formatted).toBe("6pc");
    // And the failure the whole px decision exists to avoid, asserted rather
    // than described: the word every Chinese stylesheet is described with does
    // not reach the parser at all, because ICU handed `lex` 像 and 素.
    expect(() => e.evaluate("100像素")).toThrow(/像/);
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "1英寸到磅",
      "72磅到英寸",
      "1英寸到毫米",
      "1英寸 + 36磅",
      "5吋",
      "96px",
      "6pc",
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
