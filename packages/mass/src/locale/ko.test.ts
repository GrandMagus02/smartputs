import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massKo from "./ko";

const engine = () =>
  createEngine({
    locales: [composeLocale(korean, [massKo])],
    kinds: [mass],
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
    kind: "mass",
    unit,
    slot,
  });
  return (massKo.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** What `lex` will do to a letter run, since `korean` declares no `segment`. */
const icu = (run: string) =>
  [...new Intl.Segmenter("ko", { granularity: "word" }).segment(run)]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

describe("mass ko vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    // One sweep is enough here, where German needed two. A German noun shares
    // the unit ids' script, so `de.test.ts` has to name `gramm` and `tonnen`
    // before it can sweep for umlauts; every Korean word is written in a script
    // no ratio, unit id or magnitude band can contain, so the script class *is*
    // the assertion. Precomposed syllables and bare jamo alike, because
    // `normalize()` composes but the source file need not have.
    expect(JSON.stringify(mass)).not.toMatch(/[가-힣ᄀ-ᇿ㄰-㆏]/u);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `korean.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean
    // something (rule 6). The counts deliberately include the shapes that move
    // `en` and `uk` — 1, the 2/5/21 Slavic boundaries, a fraction, and zero —
    // and none of them moves Korean.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 21, 100, 1000]) {
        produced.add(
          korean.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
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

    for (const [unit, words] of Object.entries(massKo.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // No folding on either side, unlike German's. `buildRegistry` writes its
    // alias keys through `toLocaleLowerCase`, and Hangul has no case for that
    // to change, so the string this table prints is byte-for-byte the string
    // the index holds.
    for (const [unit, words] of Object.entries(massKo.units)) {
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
    // costs `@smartput/angle/locale/ja` a printed word, it leaves 밀리그램
    // alone.
    for (const [unit, words] of Object.entries(massKo.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(icu(form), `${unit} prints ${form}`).toEqual([form]);
      }
    }
    // The same fact stated the other way, and the one the analyzer depends on:
    // a bound particle stays welded to the noun in native orthography, so
    // 킬로그램을 reaches the resolver as one token and only `particleStripper`
    // can open it. After a Latin stem ICU does split, at the script boundary —
    // which is what makes a mixed-script conversion parse at all.
    expect(icu("킬로그램을")).toEqual(["킬로그램을"]);
    expect(icu("그램으로")).toEqual(["그램으로"]);
    expect(icu("kg를")).toEqual(["kg", "를"]);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(korean, [massKo]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in Korean that row is the same word as every other row, where German's is
    // a plural and Ukrainian's is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(korean, [massKo]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // The mirror image of both inflecting languages: English marks number
    // always, Ukrainian marks number and case at once, and Korean marks
    // neither. One string per unit is the language and not an unfinished table.
    expect(word("kg", 1)).toBe("킬로그램");
    expect(word("kg", 2)).toBe("킬로그램");
    expect(word("kg", 1.5)).toBe("킬로그램");
    expect(word("kg", 5)).toBe("킬로그램");
    // Ruling R5's count-free row, and the slot Ukrainian would send to the
    // locative. Korean's case is the particle, and the particle is not printed.
    expect(word("kg", undefined, "conversion-target")).toBe("킬로그램");
    expect(word("g", undefined, "conversion-target")).toBe("그램");
    expect(word("t", 1000)).toBe("톤");
  });

  test("an engine built from it reads and writes Korean mass", () => {
    const e = engine();
    // No space anywhere: `korean.renderQuantity` closes the gap on every
    // branch, per 한글 맞춤법 §43's proviso for a unit noun after Arabic
    // numerals — so a Korean engine answers 5그램 where an English one answers
    // "5 grams".
    expect(e.evaluate("1그램").formatted).toBe("1그램");
    expect(e.evaluate("5그램").formatted).toBe("5그램");
    expect(e.evaluate("2파운드").formatted).toBe("2파운드");
    expect(e.evaluate("3온스").formatted).toBe("3온스");
    // Arithmetic landing on a fraction. The decimal point and the group comma
    // both come from CLDR through `numberFormat: "intl"`, and are the same pair
    // English produces — which is why `ko` reads its own grouped output back.
    expect(e.evaluate("1kg + 500g").formatted).toBe("1.5킬로그램");
    expect(e.evaluate("1.5톤").formatted).toBe("1.5톤");
    // The spelled operator, which Korean writes with spaces on both sides —
    // 더하기 is a nominalised verb and Korean separates words, which is why
    // `korean` overrides `renderQuantity` and leaves `renderExpression` alone.
    expect(e.evaluate("1킬로그램 더하기 500그램").formatted).toBe("1.5킬로그램");
    // The accusative on the left operand, which is where an infix operator
    // goes: Korean is head-final, so the source particle lands between the two
    // operands even though 를 does not *mean* "in". Mixed script, because that
    // is where ICU gives the particle a token of its own.
    expect(e.evaluate("0.5kg를 그램").formatted).toBe("500그램");
    expect(e.evaluate("500g에서 킬로그램").formatted).toBe("0.5킬로그램");
    expect(e.evaluate("2kg를 그램").formatted).toBe("2,000그램");
    // Latin input still reads, and answers in Korean — the two registers of one
    // language this vocabulary declares side by side.
    expect(e.evaluate("2kg").formatted).toBe("2킬로그램");
    // The colloquial clipping, claimed for the kilogram exactly as `units.ts`
    // claims the English "kilo".
    expect(e.evaluate("3킬로").value.unit).toBe("kg");
  });

  test("a bound particle is peeled off the noun, on the right condition", () => {
    // `particleStripper` doing the work no keyword table could: the particle is
    // inside the token — ICU returns 킬로그램을 whole, three tests up — so this
    // is the only route from that word to `kg`.
    const e = engine();
    expect(e.evaluate("5킬로그램을").value.unit).toBe("kg");
    expect(e.evaluate("5킬로그램은").value.unit).toBe("kg");
    expect(e.evaluate("500그램에서").value.unit).toBe("g");
    expect(e.evaluate("5그램으로").value.unit).toBe("g");

    // And the euphonic condition refusing what Korean does not write: 킬로그램
    // ends in a consonant, so its accusative is 을 and never 를, and 그램 takes
    // 으로 and never 로. A flat suffix list would strip all four and teach the
    // engine two spellings nobody types.
    //
    // Asserted against the analyzer rather than against a verdict, and that is
    // a fact about the engine rather than a weaker check. `evaluate` also has
    // the fuzzy corrector behind it, which reaches 킬로그램 from 킬로그램를 at
    // one edit's penalty whatever the analyzer says — so the refusal is visible
    // exactly where it is made. Ungrammatical input still resolves, at a lower
    // confidence, which is the right outcome for a typo and the wrong evidence
    // for this rule.
    const forms = (surface: string) =>
      (korean.analyze ?? []).flatMap((a) =>
        a(surface, { words: [surface], index: 0, locale: "ko" }).map((f) => f.form),
      );
    expect(forms("킬로그램을")).toContain("킬로그램");
    expect(forms("킬로그램를")).not.toContain("킬로그램");
    expect(forms("그램으로")).toContain("그램");
    expect(forms("그램로")).not.toContain("그램");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which `de.test.ts` deliberately cannot do: `ko`
    // groups with "," and the lexer reads that back as a group separator.
    const e = engine();
    for (const input of [
      "1kg + 500g",
      "0.5kg를 그램",
      "2kg를 그램",
      "3온스",
      "1.5톤",
      "1000밀리그램",
      "5킬로그램을",
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
