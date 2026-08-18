import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { speed } from "../index";
import speedRu from "./ru";

const engine = createEngine({
  locales: [composeLocale(russian, [speedRu])],
  kinds: [speed],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = russian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedRu.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

describe("speed ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Russian word", () => {
    // The Cyrillic block, not a list of the words: the point is that the kind
    // holds ratios, magnitude bands and one bridge signature and no language at
    // all, so any Cyrillic letter reaching it is the failure.
    expect(JSON.stringify(speed)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("only `knot` declares written forms", () => {
    // The decision `en.ts` records, restated because Russian would need eight
    // keys rather than two: "м/с" and "км/ч" carry a slash and "километров в
    // час" is three words — one of which is core's `in` keyword — so neither
    // lexes back as one unit token and a forms table for them would be
    // unreachable prose. The renderer stays on the symbol because of it, which
    // is why every expectation below is tight.
    expect(speedRu.units.mps?.forms).toBeUndefined();
    expect(speedRu.units.kph?.forms).toBeUndefined();
    expect(speedRu.units.mph?.forms).toBeUndefined();
    expect(Object.keys(speedRu.units.knot?.forms ?? {}).sort()).toEqual(EIGHT_KEYS);
  });

  test("the three compounds leave the Cyrillic head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "километров" for kph here would give "5 километров" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The kind's own `length ÷ duration` bridge is the path Russian gets
    // instead, and it needs no alias of this kind's at all.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedRu.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Cyrillic head noun`).not.toMatch(/[Ѐ-ӿ]/);
      }
    }
    expect(speedRu.units.knot?.aliases).toContain("узел");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. The fleeting-vowel forms of `узел`
  // are exactly the ones a stripper could never produce from the nominative
  // singular, so they have to be declared rather than hoped for.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(speedRu.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(russian, [speedRu]), [speed]),
    ).not.toThrow();
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Russian spells with a genitive *singular*. 1.5 is added
    // so `nom-other` and `loc-other` are sampled rather than merely written down.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [speedRu]), [speed], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("`узел`'s four nominative rows are four decisions, two of them alike", () => {
    // The fleeting `е` drops everywhere but the nominative singular.
    expect(word("knot", 1)).toBe("узел");
    // A genitive *singular*, where Ukrainian's same cell holds the nominative
    // plural "вузли" — so in Russian it coincides with the fractional row below
    // rather than standing apart from it.
    expect(word("knot", 2)).toBe("узла");
    expect(word("knot", 5)).toBe("узлов");
    // The row a one-dimensional plural model gets wrong by printing a plural.
    expect(word("knot", 1.5)).toBe("узла");
    // The two counts that catch a hand-written plural rule: 21 is singular in
    // Russian and 11 is not.
    expect(word("knot", 21)).toBe("узел");
    expect(word("knot", 11)).toBe("узлов");
  });

  test("a conversion target is prepositional, with or without a count", () => {
    // "в 1 узле", "в 2 узлах", "в 5 узлах" — and the row no one-dimensional
    // plural model could express at all: "в узлах", chosen with no count in
    // hand, which is what a bare conversion target is.
    expect(word("knot", 1, "conversion-target")).toBe("узле");
    expect(word("knot", 2, "conversion-target")).toBe("узлах");
    expect(word("knot", 5, "conversion-target")).toBe("узлах");
    expect(word("knot", undefined, "conversion-target")).toBe("узлах");
  });

  test("an engine built from it reads and writes Russian speed", () => {
    // The numeral boundary: 2 takes `few` and 5 takes `many`, and `knot` is the
    // one unit here whose output moves across it.
    expect(engine.evaluate("1 узел").formatted).toBe("1 узел");
    expect(engine.evaluate("2 узла").formatted).toBe("2 узла");
    expect(engine.evaluate("5 узлов").formatted).toBe("5 узлов");
    // The fraction, which is where both the genitive singular and CLDR's Russian
    // decimal comma show up. Reached by a sum as well as typed, because a sum is
    // how a user gets there without meaning to.
    expect(engine.evaluate("1,5 узла").formatted).toBe("1,5 узла");
    expect(engine.evaluate("1 узел + 0,5 узла").formatted).toBe("1,5 узла");
    // A conversion, written with "в": knots in, the Russian compound symbol out,
    // joined to the number with no space because `kph` has no forms.
    expect(engine.evaluate("10 узлов в kph").formatted).toBe("18,52 км/ч");
    // And back the other way, into the one unit that prints as a word.
    expect(engine.evaluate("37,04 kph в узлах").formatted).toBe("20 узлов");
    // Latin in, Russian out: a Russian developer types "mps" and "kmh".
    expect(engine.evaluate("3 mps").formatted).toBe("3 м/с");
    expect(engine.evaluate("1 kmh").formatted).toBe("1 км/ч");
    expect(engine.evaluate("60 mph").formatted).toBe("60 миль/ч");
    // Grouping comes from CLDR through `numberFormat: "intl"`. U+00A0 as an
    // escape, never a literal — a literal is invisible here and degrades to a
    // plain space the moment the line is retyped.
    expect(engine.evaluate("2000 kph").formatted).toBe("2\u00A0000 км/ч");
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which is an
    // operator character the lexer will not take back inside a unit word — the
    // same fact `units.ts` gives for refusing byte-per-second units in
    // `@smartput/datarate`. Their route back is the kind's `length ÷ duration`
    // bridge, which needs `@smartput/length`'s Russian vocabulary installed
    // beside this one and therefore belongs to the barrel's own locale test
    // rather than to a per-package one.
    for (const input of ["5 узлов", "2 узла", "37,04 kph в узлах", "1,5 узла"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
