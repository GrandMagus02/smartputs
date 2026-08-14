import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massPl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [massPl])],
    kinds: [mass],
  });

/** The eight keys `polish.selectForm` can produce, sorted. */
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

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = polish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massPl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Polish word", () => {
    // Polish shares the unit ids' script, so a bare "no non-ASCII" sweep would
    // pass a kind that had grown a `funt`. The nouns first, then the Polish
    // diacritics, which no ratio or magnitude band can contain.
    expect(JSON.stringify(mass)).not.toMatch(/miligram|kilogram|tona|uncj|funt/i);
    expect(JSON.stringify(mass)).not.toMatch(/[ąćęłńóśźż]/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows eight is all `polish.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean
    // something (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000]) {
        produced.add(
          polish.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(EIGHT_KEYS);

    for (const unit of Object.keys(massPl.units)) {
      expect(Object.keys(massPl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips whenever `polish`'s suffix
  // stripper happens to recover it — at `weight: -2`, a guess rather than an
  // entry. And for the two forms that carry a consonant alternation ("funcie",
  // "tonie") no stripper recovers anything at all, because the stem it would
  // leave behind is spelled differently from the one the aliases list.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(massPl.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(polish, [massPl]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is fractions and nothing else.
    // 1.5 is what makes the contract sample the `nom-other` row, which is the
    // one this vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [massPl]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("21 is genitive plural, which is where Polish leaves Ukrainian", () => {
    // `uk.test.ts` next door pins "21 кілограм", the nominative singular,
    // because Ukrainian agrees a compound with its final digit. Polish does not:
    // every -1 above twenty is `many`. Pinned here rather than left to the
    // engine test below, because a table ported from `uk.ts` would still be
    // green on every other assertion in this file.
    expect(word("kg", 21)).toBe("kilogramów");
    expect(word("kg", 101)).toBe("kilogramów");
    expect(word("kg", 22)).toBe("kilogramy");
    expect(word("kg", 0)).toBe("kilogramów");
  });

  test("the two -other rows hold different words", () => {
    // `nom-other` is reached only with a fractional count, where Polish takes
    // the genitive singular; `loc-other` is reached only without a count at all,
    // where the word is the plain locative plural. Filling both from one word is
    // the mistake `polish.selectForm`'s doc comment warns about, and it is
    // invisible to the shape checks above.
    expect(word("kg", 1.5)).toBe("kilograma");
    expect(word("kg", undefined, "conversion-target")).toBe("kilogramach");
    expect(word("t", 1.5)).toBe("tony");
    expect(word("t", undefined, "conversion-target")).toBe("tonach");
  });

  test("case follows the slot, not the count", () => {
    // The same count picks a nominative form after a number and a locative one
    // as a conversion target. The feminine locative singular has its own
    // alternation, so the case axis is not one suffix applied to every stem:
    // "w 1 tonie", not "w 1 tonach", and "w 1 funcie" with t→ć.
    expect(word("g", 5, "after-number")).toBe("gramów");
    expect(word("g", 5, "conversion-target")).toBe("gramach");
    expect(word("t", 1, "conversion-target")).toBe("tonie");
    expect(word("lb", 1, "conversion-target")).toBe("funcie");
  });

  test("an engine built from it reads and writes Polish mass", () => {
    const e = engine();
    // The two plural boundaries, on both sides of each: 2 takes `nom-few`
    // (nominative plural) and 5 takes `nom-many` (genitive plural in -ów).
    expect(e.evaluate("2 kilogramy").formatted).toBe("2 kilogramy");
    expect(e.evaluate("5 kilogramów").formatted).toBe("5 kilogramów");
    // 21, again through the whole engine rather than the table alone.
    expect(e.evaluate("21 kilogramów").formatted).toBe("21 kilogramów");
    // The fractional row — genitive *singular*. This is the assertion that would
    // read "1,5 kilogramów" if `nom-other` held a plural, and it is the same sum
    // `en.test.ts` pins as "1.5 kilograms".
    expect(e.evaluate("1 kg + 500 g").formatted).toBe("1,5 kilograma");
    // The feminine units decline differently from the three grams: "5 ton" is a
    // bare stem and "5 uncji" a soft-stem -i, neither of them the masculine -ów.
    expect(e.evaluate("2 tony").formatted).toBe("2 tony");
    expect(e.evaluate("5 ton").formatted).toBe("5 ton");
    expect(e.evaluate("1,5 tony").formatted).toBe("1,5 tony");
    expect(e.evaluate("5 uncji").formatted).toBe("5 uncji");
    // A conversion written with the Polish preposition. "1 funt" is exactly 16
    // ounces, and the result is a finished quantity rather than a target, so it
    // prints nominative.
    expect(e.evaluate("1 funt w uncjach").formatted).toBe("16 uncji");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("2 kg w g").formatted).toBe("2\u00A0000 gramów");
    // The Latin aliases the one alias map in `units.ts` declares still read, and
    // print back in Polish.
    expect(e.evaluate("2 kg").formatted).toBe("2 kilogramy");
    expect(e.evaluate("500 mg").formatted).toBe("500 miligramów");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose: `parse/normalize.ts`
    // folds every `\s` — NBSP included — to a plain space before `lex()` sees
    // it, and `lex` accepts that folded separator when the language's own group
    // separator is a non-breaking space. That is what lets a Polish engine read
    // the one input it is guaranteed to be handed: its own output.
    for (const input of [
      "1 kg + 500 g",
      "5 ton",
      "1 funt w uncjach",
      "500 mg",
      "2 kg w g",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
