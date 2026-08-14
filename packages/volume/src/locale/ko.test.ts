import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeKo from "./ko";

const engine = () =>
  createEngine({
    locales: [composeLocale(korean, [volumeKo])],
    kinds: [volume],
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
    kind: "volume",
    unit,
    slot,
  });
  return (volumeKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** What `lex` will do to a letter run, since `korean` declares no `segment`. */
const icu = (run: string) =>
  [...new Intl.Segmenter("ko", { granularity: "word" }).segment(run)]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

describe("volume ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeKo.units)) {
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
    expect(JSON.stringify(volume)).not.toMatch(/[가-힣ᄀ-ᇿ㄰-㆏]/u);
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
            kind: "volume",
            unit: "l",
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

    for (const [unit, words] of Object.entries(volumeKo.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // The check `en` and `uk` fail on `m3` by declining to print it at all:
    // "cubic metres" is a phrase, and a phrase is not a token. Korean binds
    // 세제곱- to the noun, so it is one word here.
    for (const [unit, words] of Object.entries(volumeKo.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
        expect(form, `${unit} prints a phrase`).not.toMatch(/\s/u);
      }
    }
  });

  test("Korean is spaced, so ICU returns every unit word whole", () => {
    // The check that stands where `ja.test.ts`'s segmentation test stands, and
    // it passes for the opposite reason. `korean` declares no `segment`, so
    // `lex` falls back to `Intl.Segmenter("ko")` over each letter run — and
    // that segmenter has no Korean dictionary behind it, so it never cuts
    // inside a Hangul run at all. Where ICU splits ラジアン into ラジ + アン and
    // costs `@smartput/angle/locale/ja` a printed word, it leaves 세제곱미터
    // alone.
    expect(korean.segment).toBeUndefined();
    for (const [unit, words] of Object.entries(volumeKo.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(icu(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // The same fact stated the other way, and the one the analyzer depends on:
    // a bound particle stays welded to the noun in native orthography, so
    // 리터를 reaches the resolver as one token and only `particleStripper` can
    // open it. After a Latin stem ICU does split, at the script boundary.
    expect(icu("세제곱미터를")).toEqual(["세제곱미터를"]);
    expect(icu("ml에서")).toEqual(["ml", "에서"]);
  });

  test("the litre's Korean label needs no entry of its own", () => {
    // ℓ and ㎖ are what a Korean carton is printed with, and `normalize()` runs
    // NFKC before anything else sees the input — so both are already the Latin
    // aliases `units.ts` declares by the time the alias index is consulted. An
    // entry for either would be a key the lexer can never deliver.
    expect("ℓ".normalize("NFKC")).toBe("l");
    expect("㎖".normalize("NFKC")).toBe("ml");
    expect(volumeKo.units.l?.symbol).toBe("l");
    expect(engine().evaluate("1ℓ").value.unit).toBe("l");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(korean, [volumeKo]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Korean that row is the same word as every other row, where German's is
    // a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(korean, [volumeKo]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    expect(word("l", 1)).toBe("리터");
    expect(word("l", 2)).toBe("리터");
    expect(word("l", 1.5)).toBe("리터");
    // Ruling R5's count-free row, and the slot Ukrainian would send to the
    // locative. Korean's case is the particle, and the particle is not printed.
    expect(word("l", undefined, "conversion-target")).toBe("리터");
    expect(word("m3", undefined, "conversion-target")).toBe("세제곱미터");
    expect(word("pint", 1000)).toBe("파인트");
  });

  test("입방 is read and the traditional measures are not claimed", () => {
    // The older calque is a spelling of the same unit, so it reads and is never
    // printed; 되 and 말 are different units this kind has no slot for, so they
    // stay out rather than being approximated onto the litre.
    const e = engine();
    expect(e.evaluate("1입방미터").value.unit).toBe("m3");
    expect(volumeKo.units.m3?.forms?.other).toBe("세제곱미터");
    expect(volumeKo.units.l?.aliases).not.toContain("되");
    expect(() => e.evaluate("3되")).toThrow();
  });

  test("an engine built from it reads and writes Korean volumes", () => {
    const e = engine();
    // No space anywhere: `korean.renderQuantity` closes the gap on every
    // branch, per 한글 맞춤법 §43's proviso for a unit noun after Arabic
    // numerals — so a Korean engine answers 1리터 where an English one answers
    // "1 litre".
    expect(e.evaluate("1리터").formatted).toBe("1리터");
    expect(e.evaluate("500밀리리터").formatted).toBe("500밀리리터");
    expect(e.evaluate("2갤런").formatted).toBe("2갤런");
    expect(e.evaluate("1.5세제곱미터").formatted).toBe("1.5세제곱미터");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // both come from CLDR through `numberFormat: "intl"`, and are the same pair
    // English produces — which is why `ko` reads its own grouped output back.
    expect(e.evaluate("1l + 500ml").formatted).toBe("1.5리터");
    // The spelled operator, which Korean writes with spaces on both sides.
    expect(e.evaluate("1리터 더하기 500밀리리터").formatted).toBe("1.5리터");
    // The accusative on the left operand, which is where an infix operator
    // goes: Korean is head-final, so the source particle lands between the two
    // operands even though 를 does not *mean* "in". Mixed script, because that
    // is where ICU gives the particle a token of its own.
    expect(e.evaluate("1l를 밀리리터").formatted).toBe("1,000밀리리터");
    expect(e.evaluate("1000ml에서 리터").formatted).toBe("1리터");
  });

  test("a bound particle is peeled off the noun, on the right condition", () => {
    // `particleStripper` doing the work no keyword table could: the particle is
    // inside the token — ICU returns 세제곱미터를 whole, above — so this is the
    // only route from that word to `m3`.
    const e = engine();
    expect(e.evaluate("1세제곱미터를").value.unit).toBe("m3");
    expect(e.evaluate("500밀리리터에서").value.unit).toBe("ml");

    // And the euphonic condition refusing what Korean does not write: 리터 ends
    // in a vowel, so its accusative is 를 and never 을 and its directional is 로
    // and never 으로. 갤런 ends in ㄴ and takes the other member of each pair,
    // which is the whole point of the conditional — one table, two answers,
    // decided by the syllable in front of it.
    //
    // Asserted against the analyzer rather than against a verdict: `evaluate`
    // also has the fuzzy corrector behind it, which reaches the noun from the
    // ungrammatical spelling at one edit's penalty whatever the analyzer says.
    const forms = (surface: string) =>
      (korean.analyze ?? []).flatMap((a) =>
        a(surface, { words: [surface], index: 0, locale: "ko" }).map((f) => f.form),
      );
    expect(forms("리터를")).toContain("리터");
    expect(forms("리터을")).not.toContain("리터");
    expect(forms("갤런을")).toContain("갤런");
    expect(forms("갤런를")).not.toContain("갤런");
    expect(forms("갤런으로")).toContain("갤런");
    expect(forms("갤런로")).not.toContain("갤런");
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "1l + 500ml",
      "1l를 밀리리터",
      "1000ml에서 리터",
      "2갤런",
      "1.5세제곱미터",
      "3파인트",
      "1세제곱미터를",
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
