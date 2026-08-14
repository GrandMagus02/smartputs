import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureKo from "./ko";

const engine = () =>
  createEngine({
    locales: [composeLocale(korean, [measureKo])],
    kinds: [measure],
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
    kind: "measure",
    unit,
    slot,
  });
  return (measureKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** What `lex` will do to a letter run, since `korean` declares no `segment`. */
const icu = (run: string) =>
  [...new Intl.Segmenter("ko", { granularity: "word" }).segment(run)]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

describe("measure ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name its nouns before it can
    // sweep for umlauts; every Korean word is written in a script no ratio,
    // unit id, magnitude band or dpi closure can contain, so the script class
    // *is* the assertion. Precomposed syllables and bare jamo alike, because
    // `normalize()` composes but the source file need not have.
    expect(JSON.stringify(measure)).not.toMatch(/[가-힣ᄀ-ᇿ㄰-㆏]/u);
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
            kind: "measure",
            unit: "pt",
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

    for (const [unit, words] of Object.entries(measureKo.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and Hangul has no case for that
    // to change, so the string this table prints is byte-for-byte the string
    // the index holds.
    for (const [unit, words] of Object.entries(measureKo.units)) {
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
    // costs `@smartput/angle/locale/ja` a printed word, it leaves 밀리미터
    // alone.
    expect(korean.segment).toBeUndefined();
    for (const [unit, words] of Object.entries(measureKo.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(icu(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // The same fact stated the other way, and the one the analyzer depends on:
    // a bound particle stays welded to the noun in native orthography, so
    // 픽셀을 reaches the resolver as one token and only `particleStripper` can
    // open it. After a Latin stem ICU does split, at the script boundary.
    expect(icu("픽셀을")).toEqual(["픽셀을"]);
    expect(icu("pt를")).toEqual(["pt", "를"]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(korean, [measureKo]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Korean that row is the same word as every other row, where German's is
    // a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(korean, [measureKo]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("px", 1)).toBe("픽셀");
    expect(word("px", 2)).toBe("픽셀");
    expect(word("px", 1.5)).toBe("픽셀");
    // Ruling R5's count-free row, and the slot German would send to the dative
    // ("in Pixeln") and Ukrainian to the locative. Korean's case is the
    // particle, and the particle is not printed.
    expect(word("px", undefined, "conversion-target")).toBe("픽셀");
    expect(word("pt", undefined, "conversion-target")).toBe("포인트");
    expect(word("inch", 5)).toBe("인치");
  });

  test("급, 호 and 도트 are not claimed by any unit", () => {
    // The Korean typographic units this kind has no ratio for: 급 (Q) is a
    // quarter of a millimetre, which is not a point, not a pica and not a
    // pixel, and 호 is a series of named sizes rather than a magnitude at all.
    // A `NoCandidateError` says "this engine does not know 급"; bending either
    // word onto the nearest unit would say nothing at all. 도트 is out for the
    // other reason — a printer dot and a screen pixel differ by whatever the
    // device resolution is, and 픽셀 is the unambiguous half of that pair.
    const claimed = Object.values(measureKo.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("급");
    expect(claimed).not.toContain("호");
    expect(claimed).not.toContain("도트");
    expect(() => engine().evaluate("12급")).toThrow();
  });

  test("an engine built from it reads and writes Korean typography", () => {
    const e = engine();
    // No space anywhere: `korean.renderQuantity` closes the gap on every
    // branch, per 한글 맞춤법 §43's proviso for a unit noun after Arabic
    // numerals — so a Korean engine answers 72포인트 where an English one
    // answers "72 points".
    expect(e.evaluate("72포인트").formatted).toBe("72포인트");
    expect(e.evaluate("1인치").formatted).toBe("1인치");
    expect(e.evaluate("10파이카").formatted).toBe("10파이카");
    expect(e.evaluate("25.4밀리미터").formatted).toBe("25.4밀리미터");
    // Arithmetic landing on a fraction, in the unit a Korean designer sets type
    // in.
    expect(e.evaluate("1인치 + 36pt").formatted).toBe("1.5인치");
    // The spelled operator, which Korean writes with spaces on both sides.
    expect(e.evaluate("1센티미터 더하기 5밀리미터").formatted).toBe("1.5센티미터");
    // The accusative on the left operand, which is where an infix operator
    // goes: Korean is head-final, so the source particle lands between the two
    // operands even though 를 does not *mean* "in". Mixed script, because that
    // is where ICU gives the particle a token of its own. The pixel conversion
    // goes through the kind's default 96 dpi, which is a fact about pixels and
    // stays in `units.ts`.
    expect(e.evaluate("1inch를 포인트").formatted).toBe("72포인트");
    expect(e.evaluate("96px에서 인치").formatted).toBe("1인치");
    // Latin input still reads, and answers in Korean.
    expect(e.evaluate("1920px").formatted).toBe("1,920픽셀");
  });

  test("a bound particle is peeled off the noun, on the right condition", () => {
    // `particleStripper` doing the work no keyword table could: the particle is
    // inside the token — ICU returns 픽셀을 whole, above — so this is the only
    // route from that word to `px`.
    const e = engine();
    expect(e.evaluate("1920픽셀을").value.unit).toBe("px");
    expect(e.evaluate("72포인트에서").value.unit).toBe("pt");

    // And the euphonic condition refusing what Korean does not write: 픽셀 ends
    // in ㄹ, the one 받침 that behaves like a vowel, so its directional is 로 and
    // never 으로 — 픽셀로, exactly as 서울로 and never 서울으로. Its accusative is
    // still 을, because ㄹ is a consonant for that pair. One syllable, two
    // different answers, which is why the condition is a function of the 받침
    // index and not a boolean.
    //
    // Asserted against the analyzer rather than against a verdict: `evaluate`
    // also has the fuzzy corrector behind it, which reaches the noun from the
    // ungrammatical spelling at one edit's penalty whatever the analyzer says.
    const forms = (surface: string) =>
      (korean.analyze ?? []).flatMap((a) =>
        a(surface, { words: [surface], index: 0, locale: "ko" }).map((f) => f.form),
      );
    expect(forms("픽셀로")).toContain("픽셀");
    expect(forms("픽셀으로")).not.toContain("픽셀");
    expect(forms("픽셀을")).toContain("픽셀");
    expect(forms("픽셀를")).not.toContain("픽셀");
    // And the ordinary consonant, for contrast: 포인트 ends in a vowel, so it
    // takes 를 and 로.
    expect(forms("포인트를")).toContain("포인트");
    expect(forms("포인트을")).not.toContain("포인트");
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "1인치 + 36pt",
      "1inch를 포인트",
      "96px에서 인치",
      "1920px",
      "10파이카",
      "25.4밀리미터",
      "1920픽셀을",
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
