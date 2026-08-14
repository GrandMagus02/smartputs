import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleKo from "./ko";

const engine = () =>
  createEngine({
    locales: [composeLocale(korean, [angleKo])],
    kinds: [angle],
  });

/** The only key `korean.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = korean.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** What `lex` will do to a letter run, since `korean` declares no `segment`. */
const icu = (run: string) =>
  [...new Intl.Segmenter("ko", { granularity: "word" }).segment(run)]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

describe("angle ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name its nouns before it can
    // sweep for umlauts; every Korean word is written in a script no ratio,
    // unit id or magnitude band can contain, so the script class *is* the
    // assertion. Precomposed syllables and bare jamo alike, because
    // `normalize()` composes but the source file need not have.
    expect(JSON.stringify(angle)).not.toMatch(/[가-힣ᄀ-ᇿ㄰-㆏]/u);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `korean.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean
    // something (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000]) {
        produced.add(
          korean.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);
    // And CLDR's own answer, which is where the constant came from.
    expect(new Intl.PluralRules("ko").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);

    for (const [unit, words] of Object.entries(angleKo.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and Hangul has no case for that
    // to change, so the string this table prints is byte-for-byte the string
    // the index holds.
    for (const [unit, words] of Object.entries(angleKo.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("Korean is spaced, so the radian is printable here and not in ja", () => {
    // The measurement this package's Japanese vocabulary lost a word to, run in
    // both languages side by side. `japanese.segment` cuts ラジアン in two, so
    // `@smartput/angle/locale/ja` prints `rad` and lists no katakana name at
    // all; `korean` declares no `segment`, `lex` falls back to
    // `Intl.Segmenter("ko")`, and that segmenter has no Korean dictionary
    // behind it — so it never cuts inside a Hangul run and 라디안 survives.
    expect(japanese.segment?.("ラジアン")).toEqual(["ラジ", "アン"]);
    expect(korean.segment).toBeUndefined();
    expect(icu("라디안")).toEqual(["라디안"]);
    for (const [unit, words] of Object.entries(angleKo.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(icu(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // The same fact stated the other way, and the one the analyzer depends on:
    // a bound particle stays welded to the noun in native orthography, so
    // 회전을 reaches the resolver as one token and only `particleStripper` can
    // open it. After a Latin stem ICU does split, at the script boundary —
    // which is what makes a mixed-script conversion parse at all.
    expect(icu("회전을")).toEqual(["회전을"]);
    expect(icu("turn을")).toEqual(["turn", "을"]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(korean, [angleKo]), [angle]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Korean that row is the same word as every other row, where German's is
    // a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(korean, [angleKo]), [angle], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("deg", 1)).toBe("도");
    expect(word("deg", 2)).toBe("도");
    expect(word("deg", 1.5)).toBe("도");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Umdrehungen") and Ukrainian to the locative ("в градусах"). Korean's
    // case is the particle, and the particle is not printed.
    expect(word("deg", undefined, "conversion-target")).toBe("도");
    expect(word("turn", undefined, "conversion-target")).toBe("회전");
    expect(word("grad", 200)).toBe("그라디안");
    // The unit `ja` left wordless has a word here.
    expect(word("rad", 1)).toBe("라디안");
  });

  test("the one-syllable names are not claimed", () => {
    // 회 is "times" long before it is "revolutions" and 곤 is not what a Korean
    // text calls a gradian at all; a single syllable claimed as a unit alias is
    // a false reading waiting for the first sentence that contains it. 바퀴 is
    // out on the other ground — a native counter, taking the native numerals
    // this engine does not spell.
    expect(angleKo.units.turn?.aliases).not.toContain("회");
    expect(angleKo.units.turn?.aliases).not.toContain("바퀴");
    expect(angleKo.units.grad?.aliases).not.toContain("곤");
    expect(angleKo.units.turn?.aliases).toContain("회전");
    expect(() => engine().evaluate("3회")).toThrow();
  });

  test("an engine built from it reads and writes Korean angles", () => {
    const e = engine();
    // No space anywhere: `korean.renderQuantity` closes the gap on every
    // branch, per 한글 맞춤법 §43's proviso for a unit noun after Arabic
    // numerals — so a Korean engine answers 90도 where an English one answers
    // "90 degrees".
    expect(e.evaluate("90도").formatted).toBe("90도");
    expect(e.evaluate("1회전").formatted).toBe("1회전");
    expect(e.evaluate("200그라디안").formatted).toBe("200그라디안");
    expect(e.evaluate("1라디안").formatted).toBe("1라디안");
    // A fraction, which moves nothing at all in Korean.
    expect(e.evaluate("0.5회전").formatted).toBe("0.5회전");
    expect(e.evaluate("45도 + 45도").formatted).toBe("90도");
    // The spelled operator, which Korean writes with spaces on both sides —
    // 더하기 is a nominalised verb and Korean separates words, which is why
    // `korean` overrides `renderQuantity` and leaves `renderExpression` alone.
    expect(e.evaluate("45도 더하기 45도").formatted).toBe("90도");
    // The accusative on the left operand, which is where an infix operator
    // goes: Korean is head-final, so the source particle lands between the two
    // operands even though 을 does not *mean* "in". Mixed script, because that
    // is where ICU gives the particle a token of its own — and 을 rather than
    // 를 because "turn" is read 턴, which ends in a consonant.
    expect(e.evaluate("1turn을 도").formatted).toBe("360도");
    expect(e.evaluate("360deg에서 회전").formatted).toBe("1회전");
  });

  test("a bound particle is peeled off the noun, on the right condition", () => {
    // `particleStripper` doing the work no keyword table could: the particle is
    // inside the token — ICU returns 회전을 whole, above — so this is the only
    // route from that word to `turn`.
    const e = engine();
    expect(e.evaluate("1회전을").value.unit).toBe("turn");
    expect(e.evaluate("90도로").value.unit).toBe("deg");

    // And the euphonic condition refusing what Korean does not write: 회전 ends
    // in ㄴ, so its accusative is 을 and never 를; 도 ends in a vowel, so its
    // directional is 로 and never 으로. A flat suffix list would strip all four
    // and teach the engine two spellings nobody types.
    //
    // Asserted against the analyzer rather than against a verdict: `evaluate`
    // also has the fuzzy corrector behind it, which reaches 회전 from 회전를 at
    // one edit's penalty whatever the analyzer says, so the refusal is visible
    // exactly where it is made.
    const forms = (surface: string) =>
      (korean.analyze ?? []).flatMap((a) =>
        a(surface, { words: [surface], index: 0, locale: "ko" }).map((f) => f.form),
      );
    expect(forms("회전을")).toContain("회전");
    expect(forms("회전를")).not.toContain("회전");
    expect(forms("도로")).toContain("도");
    expect(forms("도으로")).not.toContain("도");
  });

  test("its own output reads back to the same value", () => {
    // π is deliberately absent from this list. A radian's ratio is an
    // irrational constant carried to 30 significant digits, so a value printed
    // through it and read back lands a digit away from where it started — that
    // is the kind's own precision showing, not a vocabulary's round trip
    // failing, and asserting it here would be asserting decimal.js.
    const e = engine();
    for (const input of [
      "45도 + 45도",
      "1turn을 도",
      "360deg에서 회전",
      "200그라디안",
      "1.5회전",
      "1라디안",
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
