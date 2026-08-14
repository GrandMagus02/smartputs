import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthKo from "./ko";

const engine = () =>
  createEngine({
    locales: [composeLocale(korean, [lengthKo])],
    kinds: [length],
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
    kind: "length",
    unit,
    slot,
  });
  return (lengthKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** What `lex` will do to a letter run, since `korean` declares no `segment`. */
const icu = (run: string) =>
  [...new Intl.Segmenter("ko", { granularity: "word" }).segment(run)]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

describe("length ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthKo.units)) {
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
    expect(JSON.stringify(length)).not.toMatch(/[가-힣ᄀ-ᇿ㄰-㆏]/u);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `korean.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean
    // something (rule 6). The counts include the shapes that move `en` and `uk`
    // — 1, the 2/5/21 Slavic boundaries, a fraction, and zero — and none of
    // them moves Korean.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000]) {
        produced.add(
          korean.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "length",
            unit: "m",
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

    for (const [unit, words] of Object.entries(lengthKo.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and Hangul has no case for that
    // to change, so the string this table prints is byte-for-byte the string
    // the index holds.
    for (const [unit, words] of Object.entries(lengthKo.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("Korean is spaced, so ICU returns every unit word whole", () => {
    // The check that stands where `ja.test.ts`'s segmentation test stands, and
    // it passes for the opposite reason. `korean` declares no `segment`, so
    // `lex` falls back to `Intl.Segmenter("ko")` over each letter run — and
    // that segmenter has no Korean dictionary behind it, so it never cuts
    // inside a Hangul run at all. Where ICU splits ラジアン into ラジ + アン and
    // costs `@smartput/angle/locale/ja` a printed word, it leaves 킬로미터
    // alone.
    for (const [unit, words] of Object.entries(lengthKo.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(icu(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // The same fact stated the other way, and the one the analyzer depends on:
    // a bound particle stays welded to the noun in native orthography, so
    // 킬로미터를 reaches the resolver as one token and only `particleStripper`
    // can open it. After a Latin stem ICU does split, at the script boundary —
    // which is what makes a mixed-script conversion parse at all.
    expect(icu("킬로미터를")).toEqual(["킬로미터를"]);
    expect(icu("미터로")).toEqual(["미터로"]);
    expect(icu("km를")).toEqual(["km", "를"]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(korean, [lengthKo]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Korean that row is the same word as every other row, where German's is
    // a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(korean, [lengthKo]), [length], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("m", 1)).toBe("미터");
    expect(word("m", 2)).toBe("미터");
    expect(word("m", 1.5)).toBe("미터");
    expect(word("m", 5)).toBe("미터");
    // Ruling R5's count-free row, and the slot Ukrainian would send to the
    // locative. Korean's case is the particle, and the particle is not printed.
    expect(word("m", undefined, "conversion-target")).toBe("미터");
    expect(word("km", undefined, "conversion-target")).toBe("킬로미터");
    expect(word("mi", 1000)).toBe("마일");
  });

  test("the inch keeps its Korean word and drops the English abbreviation", () => {
    // `in` is core's conversion keyword in every engine that also speaks
    // English, and `registry.aliasIndex` is locale-blind — see this file's
    // RESERVED comment. 인치 carries the reading instead, and is the symbol too.
    expect(lengthKo.units.in?.aliases).not.toContain("in");
    expect(lengthKo.units.in?.symbol).toBe("인치");
    expect(engine().evaluate("27인치").value.unit).toBe("in");
  });

  test("an engine built from it reads and writes Korean length", () => {
    const e = engine();
    // No space anywhere: `korean.renderQuantity` closes the gap on every
    // branch, per 한글 맞춤법 §43's proviso for a unit noun after Arabic
    // numerals — so a Korean engine answers 5미터 where an English one answers
    // "5 metres".
    expect(e.evaluate("1미터").formatted).toBe("1미터");
    expect(e.evaluate("5킬로미터").formatted).toBe("5킬로미터");
    expect(e.evaluate("3야드").formatted).toBe("3야드");
    expect(e.evaluate("6피트").formatted).toBe("6피트");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // both come from CLDR through `numberFormat: "intl"`, and are the same pair
    // English produces — which is why `ko` reads its own grouped output back.
    expect(e.evaluate("1m + 50cm").formatted).toBe("1.5미터");
    expect(e.evaluate("1.5마일").formatted).toBe("1.5마일");
    // The spelled operator, which Korean writes with spaces on both sides —
    // 더하기 is a nominalised verb and Korean separates words, which is why
    // `korean` overrides `renderQuantity` and leaves `renderExpression` alone.
    expect(e.evaluate("1미터 더하기 50센티미터").formatted).toBe("1.5미터");
    // The accusative on the left operand, which is where an infix operator
    // goes: Korean is head-final, so the source particle lands between the two
    // operands even though 를 does not *mean* "in". Mixed script, because that
    // is where ICU gives the particle a token of its own.
    expect(e.evaluate("0.5km를 미터").formatted).toBe("500미터");
    expect(e.evaluate("500m에서 킬로미터").formatted).toBe("0.5킬로미터");
    expect(e.evaluate("2km를 미터").formatted).toBe("2,000미터");
    // Latin input still reads, and answers in Korean — the two registers of one
    // language this vocabulary declares side by side.
    expect(e.evaluate("2km").formatted).toBe("2킬로미터");
  });

  test("a bound particle is peeled off the noun, on the right condition", () => {
    // `particleStripper` doing the work no keyword table could: the particle is
    // inside the token — ICU returns 킬로미터를 whole, above — so this is the
    // only route from that word to `km`.
    const e = engine();
    expect(e.evaluate("5킬로미터를").value.unit).toBe("km");
    expect(e.evaluate("500미터에서").value.unit).toBe("m");
    expect(e.evaluate("5미터로").value.unit).toBe("m");

    // And the euphonic condition refusing what Korean does not write: 미터 ends
    // in a vowel, so its accusative is 를 and never 을, and its directional is
    // 로 and never 으로. A flat suffix list would strip all four and teach the
    // engine two spellings nobody types.
    //
    // Asserted against the analyzer rather than against a verdict, and that is
    // a fact about the engine rather than a weaker check. `evaluate` also has
    // the fuzzy corrector behind it, which reaches 미터 from 미터을 at one
    // edit's penalty whatever the analyzer says — so the refusal is visible
    // exactly where it is made.
    const forms = (surface: string) =>
      (korean.analyze ?? []).flatMap((a) =>
        a(surface, { words: [surface], index: 0, locale: "ko" }).map((f) => f.form),
      );
    expect(forms("미터를")).toContain("미터");
    expect(forms("미터을")).not.toContain("미터");
    expect(forms("미터로")).toContain("미터");
    expect(forms("미터으로")).not.toContain("미터");
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "1m + 50cm",
      "0.5km를 미터",
      "2km를 미터",
      "3야드",
      "1.5마일",
      "1000밀리미터",
      "27인치",
      "5킬로미터를",
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
