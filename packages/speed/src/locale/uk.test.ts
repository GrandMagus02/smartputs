import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationUk from "@smartput/duration/locale/uk";
import { length } from "@smartput/length";
import lengthUk from "@smartput/length/locale/uk";
import { speed } from "../index";
import speedUk from "./uk";

const engine = createEngine({
  locales: [composeLocale(ukrainian, [speedUk])],
  kinds: [speed],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = ukrainian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedUk.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("speed uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Ukrainian word", () => {
    // The Cyrillic block, not a list of the words: the point is that the kind
    // holds ratios, magnitude bands and one bridge signature and no language at
    // all, so any Cyrillic letter reaching it is the failure.
    expect(JSON.stringify(speed)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("only `knot` declares written forms", () => {
    // The decision `en.ts` records, restated because Ukrainian would need eight
    // keys rather than two: "м/с" and "км/год" carry a slash and "кілометрів на
    // годину" is three words, so neither lexes back as one unit token and a
    // forms table for them would be unreachable prose. The renderer stays on the
    // symbol because of it, which is why every expectation below is tight.
    expect(speedUk.units.mps?.forms).toBeUndefined();
    expect(speedUk.units.kph?.forms).toBeUndefined();
    expect(speedUk.units.mph?.forms).toBeUndefined();
    expect(Object.keys(speedUk.units.knot?.forms ?? {}).sort()).toEqual([
      "loc-few",
      "loc-many",
      "loc-one",
      "loc-other",
      "nom-few",
      "nom-many",
      "nom-one",
      "nom-other",
    ]);
  });

  test("the three compounds leave the Cyrillic head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "кілометрів" for kph here would give "5 кілометрів" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The bridge below is the path Ukrainian gets instead.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedUk.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Cyrillic head noun`).not.toMatch(/[Ѐ-ӿ]/);
      }
    }
    expect(speedUk.units.knot?.aliases).toContain("вузол");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Ukrainian spells with a genitive *singular*. 1.5 is
    // added so `nom-other` and `loc-other` are sampled rather than merely
    // written down.
    assertLocaleContract(composeLocale(ukrainian, [speedUk]), [speed], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("`вузол`'s four nominative rows are four different decisions", () => {
    // The fleeting `о` drops everywhere but here.
    expect(word("knot", 1)).toBe("вузол");
    expect(word("knot", 2)).toBe("вузли");
    expect(word("knot", 5)).toBe("вузлів");
    // The row a one-dimensional plural model gets wrong by printing a plural:
    // a fraction takes the genitive singular.
    expect(word("knot", 1.5)).toBe("вузла");
    // The two counts that catch a hand-written plural rule: 21 is singular in
    // Ukrainian and 11 is not.
    expect(word("knot", 21)).toBe("вузол");
    expect(word("knot", 11)).toBe("вузлів");
  });

  test("a conversion target is locative, with or without a count", () => {
    // "в 1 вузлі", "в 2 вузлах", "в 5 вузлах" — and the row no one-dimensional
    // plural model could express at all: "в вузлах", chosen with no count in
    // hand, which is what a bare conversion target is.
    expect(word("knot", 1, "conversion-target")).toBe("вузлі");
    expect(word("knot", 2, "conversion-target")).toBe("вузлах");
    expect(word("knot", 5, "conversion-target")).toBe("вузлах");
    expect(word("knot", undefined, "conversion-target")).toBe("вузлах");
  });

  test("an engine built from it reads and writes Ukrainian speed", () => {
    // The plural boundary: 2 takes `few` and 5 takes `many`, and `knot` is the
    // one unit here whose output moves across it.
    expect(engine.evaluate("2 вузли").formatted).toBe("2 вузли");
    expect(engine.evaluate("5 вузлів").formatted).toBe("5 вузлів");
    // The fraction, which is where both the genitive singular and CLDR's
    // Ukrainian decimal comma show up.
    expect(engine.evaluate("1,5 вузла").formatted).toBe("1,5 вузла");
    // A conversion, written with "в": knots in, the Ukrainian compound symbol
    // out, joined to the number with no space because `kph` has no forms.
    expect(engine.evaluate("10 вузлів в kph").formatted).toBe("18,52 км/год");
    // And back the other way, into the one unit that prints as a word.
    expect(engine.evaluate("37,04 kph в вузлах").formatted).toBe("20 вузлів");
    // Latin in, Ukrainian out: a Ukrainian developer types "mps" and "kmh".
    expect(engine.evaluate("3 mps").formatted).toBe("3 м/с");
    expect(engine.evaluate("1 kmh").formatted).toBe("1 км/год");
    expect(engine.evaluate("60 mph").formatted).toBe("60 миль/год");
    // Grouping comes from CLDR through `numberFormat: "intl"`. U+00A0 as an
    // escape, never a literal — a literal is invisible here and degrades to a
    // plain space the moment the line is retyped.
    expect(engine.evaluate("2000 kph").formatted).toBe("2\u00A0000 км/год");
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which is an
    // operator character the lexer will not take back inside a unit word — the
    // same fact `units.ts` gives for refusing byte-per-second units, and the
    // same one `@smartput/datarate`'s uk vocabulary pins. No row crosses 1000
    // either: `numberFormat: "intl"` groups with U+00A0 and `normalize()` folds
    // that to a plain space, so a grouped output is asserted above as text and
    // kept out of the round trip.
    for (const input of ["5 вузлів", "2 вузли", "37,04 kph в вузлах", "1,5 вузла"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });

  test("the compound Ukrainian writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "км/год" needs no alias here because it is already a length over
    // a duration, and `speed.ops` names both operands by id string. This is the
    // reason leaving "кілометрів" to `@smartput/length` costs Ukrainian nothing.
    const wired = createEngine({
      locales: [composeLocale(ukrainian, [lengthUk, durationUk, speedUk])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 км / год");
    expect(bridged.kind).toBe("speed");
    expect(bridged.value.unit).toBe("mps");
    // 100 km/h is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 км / год в kph").formatted).toBe("100 км/год");
    expect(wired.evaluate("1852 м / год в вузлах").formatted).toBe("1 вузол");
  });
});
