import { describe, expect, test } from "bun:test";
import { aliasesFor, composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { speed } from "../index";
import { SPEED_UNITS, type SpeedUnit } from "../units";
import speedPl from "./pl";

const engine = createEngine({
  locales: [composeLocale(polish, [speedPl])],
  kinds: [speed],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const formKey = polish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedPl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[formKey];
};

/** The key `polish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: string, count?: number) =>
  polish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "speed",
    unit,
    slot,
  });

/**
 * Exactly what `polish.selectForm` can produce: `` `${case}-${category}` `` over
 * {nom, loc} × CLDR's four Polish categories. No more and no fewer — a table
 * with a ninth key is indexing something the engine will never ask for, and one
 * with seven has a cell that renders `undefined` at a user.
 */
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

describe("speed pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `ru.test.ts`'s "the kind itself carries no Russian word", and
  // it needs two halves rather than one because Polish is written in the Latin
  // alphabet. A Cyrillic-block regex is a complete proxy for Russian — any
  // Cyrillic letter in the descriptor is a leak — and Polish has no such block
  // to point at. So the diacritics do the first half, and the vocabulary's own
  // distinctively Polish stems do the second.
  test("the kind itself carries no Polish word", () => {
    const descriptor = JSON.stringify(speed);
    expect(descriptor).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
    for (const stem of ["węzeł", "wezel", "węzł", "kilometr"]) {
      expect(descriptor, `the kind names "${stem}"`).not.toContain(stem);
    }
  });

  test("only `knot` declares written forms", () => {
    // The decision `en.ts` records, restated because Polish would need eight
    // keys rather than two: "m/s" and "km/h" carry a slash and "kilometrów na
    // godzinę" is three words — one of which is this language's `in` keyword —
    // so neither lexes back as one unit token and a forms table for them would
    // be unreachable prose. The renderer stays on the symbol because of it.
    expect(speedPl.units.mps?.forms).toBeUndefined();
    expect(speedPl.units.kph?.forms).toBeUndefined();
    expect(speedPl.units.mph?.forms).toBeUndefined();
    expect(Object.keys(speedPl.units.knot?.forms ?? {}).sort()).toEqual(EIGHT_KEYS);
  });

  test("the three compounds leave the Polish head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "kilometrów" for kph here would give "5 kilometrów" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The kind's own `length ÷ duration` bridge is the path Polish gets instead,
    // and it needs no alias of this kind's at all.
    for (const unit of ["mps", "kph", "mph"] as const) {
      expect(speedPl.units[unit]?.aliases, `${unit} added a word`).toEqual(
        aliasesFor(SPEED_UNITS, unit),
      );
    }
    expect(speedPl.units.knot?.aliases).toContain("węzeł");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `polish`'s suffix
  // stripper recovers it — at `weight: -2`. The fleeting-vowel forms of `węzeł`
  // are exactly the ones a stripper could never produce from the nominative
  // singular, and the locative "węźle" softens the stem on top of that.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(speedPl.units)) {
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
      assertLocaleContract(composeLocale(polish, [speedPl]), [speed]),
    ).not.toThrow();
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Polish spells with a genitive *singular*. 1.5 is added
    // so `nom-other` and `loc-other` are sampled rather than merely written
    // down, and those two rows hold different words here.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [speedPl]), [speed], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("`węzeł`'s four nominative rows are four different decisions", () => {
    // The fleeting `e` drops everywhere but the nominative singular.
    expect(word("knot", 1)).toBe("węzeł");
    // A real nominative **plural**, where Russian's same cell holds the genitive
    // singular "узла" — so in Polish it stands apart from the fractional row
    // rather than coinciding with it.
    expect(word("knot", 2)).toBe("węzły");
    expect(word("knot", 5)).toBe("węzłów");
    // The row a one-dimensional plural model gets wrong by printing a plural.
    expect(word("knot", 1.5)).toBe("węzła");
    expect(word("knot", 2)).not.toBe(word("knot", 1.5));
  });

  test("21 is `many`, which is where Polish leaves Ukrainian and Russian", () => {
    // Both neighbours agree 21 with the singular; Polish says "dwadzieścia jeden
    // węzłów", a genitive plural, and every -1 above twenty goes the same way.
    expect(key("knot", "after-number", 21)).toBe("nom-many");
    expect(key("knot", "after-number", 101)).toBe("nom-many");
    expect(key("knot", "after-number", 11)).toBe("nom-many");
    expect(key("knot", "after-number", 22)).toBe("nom-few");
    expect(key("knot", "after-number", 0)).toBe("nom-many");
    expect(word("knot", 21)).toBe("węzłów");
  });

  test("a conversion target is locative, with or without a count", () => {
    // "w 1 węźle", "w 2 węzłach", "w 5 węzłach" — and the row no
    // one-dimensional plural model could express at all: "w węzłach", chosen
    // with no count in hand, which is what a bare conversion target is. It is
    // not the same word as the fractional `nom-other`, which is the trap
    // `polish.selectForm` documents.
    expect(word("knot", 1, "conversion-target")).toBe("węźle");
    expect(word("knot", 2, "conversion-target")).toBe("węzłach");
    expect(word("knot", 5, "conversion-target")).toBe("węzłach");
    expect(word("knot", undefined, "conversion-target")).toBe("węzłach");
    expect(speedPl.units.knot?.forms?.["nom-other"]).not.toBe(
      speedPl.units.knot?.forms?.["loc-other"],
    );
  });

  test("an engine built from it reads and writes Polish speed", () => {
    // The numeral boundary: `knot` is the one unit here whose output moves
    // across it, and it moves at 2, at 5 and at 21.
    expect(engine.evaluate("1 węzeł").formatted).toBe("1 węzeł");
    expect(engine.evaluate("2 węzły").formatted).toBe("2 węzły");
    expect(engine.evaluate("5 węzłów").formatted).toBe("5 węzłów");
    expect(engine.evaluate("21 węzłów").formatted).toBe("21 węzłów");
    // The fraction, which is where both the genitive singular and CLDR's Polish
    // decimal comma show up. Reached by a sum as well as typed, because a sum is
    // how a user gets there without meaning to.
    expect(engine.evaluate("1,5 węzła").formatted).toBe("1,5 węzła");
    expect(engine.evaluate("1 węzeł + 0,5 węzła").formatted).toBe("1,5 węzła");
    // A conversion, written with "w": knots in, the Polish compound symbol out,
    // set off from the number by a space because `polish.renderQuantity` follows
    // PN-EN ISO 80000 rather than the default's tight symbol branch.
    expect(engine.evaluate("10 węzłów w kph").formatted).toBe("18,52 km/h");
    // And back the other way, into the one unit that prints as a word.
    expect(engine.evaluate("37,04 kph w węzłach").formatted).toBe("20 węzłów");
    // Latin in, Polish out: a Polish driver types "kmh" and "mph".
    expect(engine.evaluate("3 mps").formatted).toBe("3 m/s");
    expect(engine.evaluate("1 kmh").formatted).toBe("1 km/h");
    expect(engine.evaluate("60 mph").formatted).toBe("60 mph");
    // Grouping comes from CLDR through `numberFormat: "intl"`. U+00A0 as an
    // escape, never a literal — a literal is invisible here and degrades to a
    // plain space the moment the line is retyped.
    expect(engine.evaluate("2000 kph").formatted).toBe("2\u00A0000 km/h");
  });

  test("its own output reads back to the same value", () => {
    // `knot` and `mph` only. The other two print on a symbol carrying "/", which
    // is an operator character the lexer will not take back inside a unit word —
    // the same fact `units.ts` gives for refusing byte-per-second units in
    // `@smartput/datarate`. Their route back is the kind's `length ÷ duration`
    // bridge, which needs `@smartput/length`'s Polish vocabulary installed
    // beside this one and therefore belongs to the barrel's own locale test
    // rather than to a per-package one. `mph` is in the list precisely because
    // this file, unlike `ru.ts`, refused to invent a slash-bearing "mil/h" for
    // it.
    for (const input of [
      "5 węzłów",
      "2 węzły",
      "21 węzłów",
      "37,04 kph w węzłach",
      "1,5 węzła",
      "60 mph",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });

  test("the Latin aliases are derived, never retyped", () => {
    // What keeps the micro path (`parseSpeed`) and the engine path in step:
    // every alias `units.ts` declares for a unit is still an alias of that unit
    // here, and the Polish words are an addition rather than a replacement.
    for (const unit of Object.keys(speedPl.units) as SpeedUnit[]) {
      for (const derived of aliasesFor(SPEED_UNITS, unit)) {
        expect(speedPl.units[unit]?.aliases, `${unit} dropped "${derived}"`).toContain(
          derived,
        );
      }
    }
  });
});
