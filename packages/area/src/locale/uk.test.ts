import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaUk from "./uk";

const engine = () =>
  createEngine({
    locales: [composeLocale(ukrainian, [areaUk])],
    kinds: [area],
  });

describe("area uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios and unit ids, so no script but ASCII may reach it. Cyrillic
  // anywhere in the descriptor would mean a translation had leaked into the
  // half of the package that is supposed to be language-free.
  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(area)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("only the units Ukrainian declines carry forms", () => {
    // Same per-unit decision as `en`: the squared units are written as symbols
    // ("3м²"), never spelled out, so a forms table for them would offer
    // completion text that fails to evaluate.
    expect(areaUk.units.m2?.forms).toBeUndefined();
    expect(areaUk.units.cm2?.forms).toBeUndefined();
    expect(areaUk.units.km2?.forms).toBeUndefined();
    // Eight keys, not two: case x CLDR category. `nom-other` is the fractional
    // row (genitive singular, "1,5 гектара") and `loc-other` the count-free
    // conversion target ("в гектарах") — the two rows nothing else in this
    // package's tests can reach.
    for (const unit of ["hectare", "acre"] as const) {
      expect(Object.keys(areaUk.units[unit]?.forms ?? {}).sort()).toEqual([
        "loc-few",
        "loc-many",
        "loc-one",
        "loc-other",
        "nom-few",
        "nom-many",
        "nom-one",
        "nom-other",
      ]);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [areaUk]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all. A fractional count is what makes the contract check the
    // `nom-other`/`loc-other` rows this vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [areaUk]), [area], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Ukrainian area", () => {
    const e = engine();
    // The plural boundary, in both directions of the pair: 2 takes `nom-few`
    // (nominative plural) and 5 takes `nom-many` (genitive plural).
    expect(e.evaluate("2 гектари").formatted).toBe("2 гектари");
    expect(e.evaluate("5 гектарів").formatted).toBe("5 гектарів");
    // The fractional row. Genitive *singular* — "1,5 гектара" — which is also
    // the assertion that would read "1,5 гектарів" if `nom-other` were wrong.
    expect(e.evaluate("1,5 гектара").formatted).toBe("1,5 гектара");
    expect(e.evaluate("5 акрів").formatted).toBe("5 акрів");
    // A conversion, landing on a unit with no forms: it renders through the
    // symbol branch, tight against the number, and the number is grouped by
    // U+00A0 because `numberFormat: "intl"` reads that from CLDR. Written as an
    // escape — a literal NBSP is invisible here and degrades to a plain space.
    expect(e.evaluate("2 га в м2").formatted).toBe("20\u00A0000м²");
    // Both scripts read: a Ukrainian engine still takes the Latin aliases the
    // one alias map in `units.ts` declares, and prints them back in Ukrainian.
    expect(e.evaluate("2 ha").formatted).toBe("2 гектари");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Inputs whose output carries no thousands group: the grouping separator is
    // a space, and no lexer reads "20 000м²" back as one quantity — a limitation
    // of grouped output, not of this vocabulary, which is why the conversion
    // above is asserted as a string and not round-tripped.
    for (const input of ["1,5 гектара", "5 акрів", "5 га в акрах"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
