import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaDe from "./de";

const engine = () =>
  createEngine({
    locales: [composeLocale(german, [areaDe])],
    kinds: [area],
  });

/** The four keys `german.selectForm` can produce, sorted. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no German word", () => {
    // `acre` is deliberately absent from the pattern: it is a *unit id*, so it
    // is in the kind by construction and matching on it would assert the
    // opposite of what this test means. German shares the ids' script, so the
    // nouns have to be named; the umlaut sweep beside them catches anything
    // else German that might leak in.
    expect(JSON.stringify(area)).not.toMatch(/quadrat|hektar/i);
    expect(JSON.stringify(area)).not.toMatch(/[äöüß]/i);
  });

  test("the squared units carry forms here, where en and uk carry none", () => {
    // The one place this vocabulary disagrees with its neighbours, and the
    // disagreement is about German rather than about the units: "square metres"
    // and "квадратних метрів" are phrases, and `lex` ends a word token at a
    // space, so neither language can print a form it could read back.
    // `Quadratmeter` is one token, listed as an alias, and round-trips.
    for (const unit of ["m2", "cm2", "km2"] as const) {
      expect(Object.keys(areaDe.units[unit]?.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
    expect(areaDe.units.m2?.forms?.["nom-one"]).toBe("Quadratmeter");
    expect(areaDe.units.m2?.aliases).toContain("quadratmeter");
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows four is all `german.selectForm` can ever ask for,
    // which is what gives the exact-match assertion its teeth (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          german.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "area",
            unit: "m2",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(areaDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Folded on both sides, which is German-specific rather than a loosening:
    // every German noun is capitalised, so the table prints `Quadratmeter` while
    // the alias index — whose keys `buildRegistry` writes through
    // `toLocaleLowerCase` — holds `quadratmeter`.
    for (const [unit, words] of Object.entries(areaDe.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(folded, `${unit} prints ${key}="${form}" but does not list it`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(german, [areaDe]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached at all. 1.5 is what makes the contract sample
    // it — the row a language that inflects for number would get wrong, and the
    // row German answers with the same word as every other count.
    expect(() =>
      assertLocaleContract(composeLocale(german, [areaDe]), [area], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("no unit in this kind moves on the number axis", () => {
    // There is no feminine measure noun in this kind, so Duden's Maßangabe rule
    // covers all five and `nom-one` equals `nom-other` everywhere. That is the
    // whole table, not an unfinished one — compare `@smartput/length/locale/de`,
    // where `die Meile` gives `Meile`/`Meilen`.
    for (const unit of ["m2", "cm2", "km2", "hectare", "acre"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2));
      expect(word(unit, 1), unit).toBe(word(unit, 1.5));
    }
    expect(word("hectare", 100)).toBe("Hektar");
    expect(word("m2", 2)).toBe("Quadratmeter");
    expect(word("acre", 2)).toBe("Acre");
  });

  test("a conversion target is dative on the -er stems and nowhere else", () => {
    // "eine Fläche in Quadratmetern" — the compound declines, and ruling R5
    // sends a count-free target to `dat-other`.
    expect(word("m2", undefined, "conversion-target")).toBe("Quadratmetern");
    expect(word("m2", 1, "conversion-target")).toBe("Quadratmeter");
    expect(word("km2", undefined, "conversion-target")).toBe("Quadratkilometern");
    // And the two that stay bare: German writes "in Hektar", not "in Hektaren",
    // when it means the measure. Both spellings still *read* — `hektaren` is an
    // alias — which is a separate decision from which one gets printed.
    expect(word("hectare", undefined, "conversion-target")).toBe("Hektar");
    expect(word("acre", undefined, "conversion-target")).toBe("Acre");
    expect(areaDe.units.hectare?.aliases).toContain("hektaren");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // `compoundSplitter` finds `meter` inside `Quadratmeter` at -3 and the alias
    // is weight 0. In this single-kind engine there is no metre for the split to
    // reach, but the ordering is what keeps an area from collapsing into a
    // length in an engine that also speaks `@smartput/length/locale/de`.
    const e = engine();
    expect(e.evaluate("10 Quadratmeter").value.unit).toBe("m2");
    expect(e.evaluate("10 Quadratzentimeter").value.unit).toBe("cm2");
    expect(e.evaluate("10 Quadratkilometer").value.unit).toBe("km2");
  });

  test("an engine built from it reads and writes German area", () => {
    const e = engine();
    // The invariant plural, on both sides of the CLDR boundary and on a
    // fraction: one word, three counts.
    expect(e.evaluate("1 Hektar").formatted).toBe("1 Hektar");
    expect(e.evaluate("2 Hektar").formatted).toBe("2 Hektar");
    expect(e.evaluate("1,5 Hektar").formatted).toBe("1,5 Hektar");
    expect(e.evaluate("5 Acre").formatted).toBe("5 Acre");
    // Arithmetic landing on a fraction, with the decimal comma CLDR gives this
    // language through `numberFormat: "intl"`.
    expect(e.evaluate("1 ha + 5000 m2").formatted).toBe("1,5 Hektar");
    // A conversion written with a German keyword, answering in the compound.
    expect(e.evaluate("0,5 Hektar in Quadratmeter").formatted).toBe("5.000 Quadratmeter");
    expect(e.evaluate("2 Quadratmeter nach Quadratzentimeter").formatted).toBe(
      "20.000 Quadratzentimeter",
    );
    // Latin input still reads, and answers in German.
    expect(e.evaluate("2 ha").formatted).toBe("2 Hektar");
    // The superscript alias, which German writes exactly as English does.
    expect(e.evaluate("3 m²").value.unit).toBe("m2");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: German groups with ".", which the lexer does
    // not read back as a group, so the grouped conversions above are asserted
    // as strings instead.
    //
    // Compared at 20 decimal places rather than exactly, exactly as `uk.test.ts`
    // does: "5 ha in Acre" prints 26 significant digits of 50000/4046.8564224
    // and reading that back multiplies by the same irrational-in-decimal ratio,
    // so the canonical returns as 49999.999999999999999998. That is the
    // printer's precision, not this vocabulary's — it is the same number in
    // every language — and 20 places is well past where any word choice could
    // move it.
    const e = engine();
    for (const input of ["1 ha + 5000 m2", "5 Acre", "5 ha in Acre", "10 Quadratmeter"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
    }
  });
});
