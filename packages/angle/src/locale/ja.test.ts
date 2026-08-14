import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleJa from "./ja";

const engine = () =>
  createEngine({
    locales: [composeLocale(japanese, [angleJa])],
    kinds: [angle],
  });

/** The only key `japanese.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = japanese.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name `grad` and `umdrehung`
    // before it can sweep for umlauts; every Japanese word is written in a
    // script no ratio, unit id or magnitude band can contain, so the script
    // class *is* the assertion. Hiragana, Katakana and the CJK ideographs, the
    // same three `japanese.segment` declares.
    expect(JSON.stringify(angle)).not.toMatch(/[぀-ヿ一-鿿]/u);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `japanese.selectForm` can ever ask
    // for, which is what makes the exact-match assertion on each table mean
    // something (rule 6). The counts deliberately include the shapes that move
    // `en` and `uk` — 1, the 2/5/21 Slavic boundaries, a fraction, and zero —
    // and none of them moves Japanese.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000]) {
        produced.add(
          japanese.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // `rad` is the one unit in these six packages with no `forms` at all, and
    // the exact-key rule is stated over the units that have a table: a unit
    // with none never indexes one, so there is no key for it to get wrong. The
    // reason it has none is the test below.
    for (const [unit, words] of Object.entries(angleJa.units)) {
      if (unit === "rad") {
        expect(words.forms).toBeUndefined();
        continue;
      }
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and neither kana nor Han has a
    // case for that to change, so the string this table prints is
    // byte-for-byte the string the index holds.
    for (const [unit, words] of Object.entries(angleJa.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("ICU cuts ラジアン in two, which is why the radian has no words", () => {
    // The measurement this file's one unusual decision rests on, reported as
    // measured rather than as intended. Japanese puts no space between words,
    // so `japanese.segment` is the only thing between a letter run and the
    // alias index — and ICU's dictionary does not know ラジアン, so it falls
    // back to a two-piece break. 「5ラジアン」 therefore reaches `lex` as two
    // word tokens and dies in the parser, which is the same failure
    // `assertLocaleContract` names for a printed phrase in a spaced language
    // ("no single token can read it back"), arriving through a different door.
    expect(japanese.segment?.("ラジアン")).toEqual(["ラジ", "アン"]);
    // ゴン, the gradian's international short name, goes the same way — and
    // グラード, its other Japanese name, does not. That is the whole difference
    // between these two units: the gradian has a second name that survives
    // segmentation and the radian does not.
    expect(japanese.segment?.("ゴン")).toEqual(["ゴ", "ン"]);
    expect(japanese.segment?.("グラード")).toEqual(["グラード"]);
    // The rejected alternative, and why it was a real one: 弧度 does come back
    // whole, so it could have been printed. It is listed as an alias for that
    // reason and not printed, because 「5弧度」 is not how anybody writes a
    // quantity in radians.
    expect(japanese.segment?.("弧度")).toEqual(["弧度"]);
    expect(angleJa.units.rad?.aliases).toContain("弧度");
    expect(angleJa.units.rad?.aliases).not.toContain("ラジアン");
    // Every word this vocabulary does print survives the same trip.
    for (const [unit, words] of Object.entries(angleJa.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(japanese.segment?.(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [angleJa]), [angle]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Japanese that row is the same word as every other row, where German's
    // is a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(japanese, [angleJa]), [angle], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("deg", 1)).toBe("度");
    expect(word("deg", 2)).toBe("度");
    expect(word("deg", 1.5)).toBe("度");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Umdrehungen") and Ukrainian to the locative ("в градусах").
    expect(word("deg", undefined, "conversion-target")).toBe("度");
    expect(word("turn", undefined, "conversion-target")).toBe("回転");
    expect(word("grad", 200)).toBe("グラード");
    // The unit with no table at all answers nothing, at every count.
    expect(word("rad", 1)).toBeUndefined();
    expect(word("rad", undefined, "conversion-target")).toBeUndefined();
  });

  test("回 alone is not claimed by the turn", () => {
    // A judgement about frequency rather than about meaning: 三回 is "three
    // times" long before it is "three revolutions", and a single common
    // character claimed as a unit alias is a false reading waiting for the
    // first sentence that contains it. 回転 is unambiguous and carries the unit.
    expect(angleJa.units.turn?.aliases).not.toContain("回");
    expect(angleJa.units.turn?.aliases).toContain("回転");
    expect(() => engine().evaluate("3回")).toThrow();
  });

  test("an engine built from it reads and writes Japanese angles", () => {
    const e = engine();
    // No space anywhere: `japanese.renderQuantity` closes the gap on every
    // branch, so a Japanese engine answers 90度 where an English one answers
    // "90 degrees".
    expect(e.evaluate("90度").formatted).toBe("90度");
    expect(e.evaluate("1回転").formatted).toBe("1回転");
    expect(e.evaluate("200グラード").formatted).toBe("200グラード");
    // A fraction, which moves nothing at all in Japanese.
    expect(e.evaluate("0.5回転").formatted).toBe("0.5回転");
    expect(e.evaluate("45度 + 45度").formatted).toBe("90度");
    // The two particles, and the whole reason they are the `in` keyword: both
    // mark the *source*, so they attach to the left operand and land exactly
    // where an infix operator goes.
    expect(e.evaluate("1回転を度").formatted).toBe("360度");
    expect(e.evaluate("360度から回転").formatted).toBe("1回転");
    // The wordless unit, printing its symbol and reading it back — a Latin run
    // has no character of a declared script, so `scriptSegmenter` returns it
    // whole and `5rad` lexes as one word.
    expect(e.evaluate("1rad").formatted).toBe("1rad");
    expect(e.evaluate("1弧度").value.unit).toBe("rad");
    // And the failure the whole radian decision exists to avoid, asserted
    // rather than described: the word a Japanese speaker would reach for first
    // does not reach the parser at all, because ICU handed `lex` ラジ and アン.
    expect(() => e.evaluate("180度をラジアン")).toThrow(/ラジ/);
  });

  test("its own output reads back to the same value", () => {
    // π is deliberately absent from this list. A radian's ratio is an
    // irrational constant carried to 30 significant digits, so a value printed
    // through it and read back lands a digit away from where it started —
    // that is the kind's own precision showing, not a vocabulary's round trip
    // failing, and asserting it here would be asserting decimal.js.
    const e = engine();
    for (const input of [
      "45度 + 45度",
      "1回転を度",
      "360度から回転",
      "200グラード",
      "1.5回転",
      "1rad",
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
