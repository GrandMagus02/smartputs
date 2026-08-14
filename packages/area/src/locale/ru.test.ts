import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [areaRu])],
    kinds: [area],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "area",
    unit,
    slot,
  });

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

describe("area ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios and unit ids, so no script but ASCII may reach it. Cyrillic
  // anywhere in the descriptor would mean a translation had leaked into the
  // half of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(area)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("only the units Russian declines carry forms", () => {
    // Same per-unit decision as `en`: the squared units are written as symbols
    // ("3м²"), never spelled out, and their spelled name is two words — which
    // `lex` never hands to a single analyzer — so a forms table for them would
    // offer completion text that fails to evaluate.
    expect(areaRu.units.m2?.forms).toBeUndefined();
    expect(areaRu.units.cm2?.forms).toBeUndefined();
    expect(areaRu.units.km2?.forms).toBeUndefined();
    // Eight keys, not two: case × CLDR category, which is exactly what
    // `russian.selectForm` can produce and therefore exactly what it may index.
    for (const unit of ["hectare", "acre"] as const) {
      expect(Object.keys(areaRu.units[unit]?.forms ?? {}).sort()).toEqual(EIGHT_KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 га в гектаре" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(areaRu.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(russian, [areaRu]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — Russian reaches it only through a fraction. 1.5 is what
    // makes the contract check the `nom-other`/`loc-other` rows this vocabulary
    // is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [areaRu]), [area], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the 2/3/4 row is a genitive singular, not a plural", () => {
    // The one cell a port of `uk.ts` gets wrong by construction: Ukrainian says
    // "2 гектари" (nominative plural) and Russian says "2 гектара" (genitive
    // singular), which makes `nom-few` and `nom-other` the same word here and
    // different words there.
    const ha = areaRu.units.hectare?.forms;
    expect(ha?.[key("hectare", "after-number", 1)]).toBe("гектар");
    expect(ha?.[key("hectare", "after-number", 2)]).toBe("гектара");
    expect(ha?.[key("hectare", "after-number", 5)]).toBe("гектаров");
    expect(ha?.[key("hectare", "after-number", 1.5)]).toBe("гектара");
    // 21 is singular in Russian, 11 is not.
    expect(ha?.[key("hectare", "after-number", 21)]).toBe("гектар");
    expect(ha?.[key("hectare", "after-number", 11)]).toBe("гектаров");
  });

  test("case follows the slot, not the count", () => {
    // The same count picks a nominative form after a number and a prepositional
    // one as a conversion target, and a target with no count at all lands on
    // `loc-other` — "в гектарах", the row a one-dimensional plural table had no
    // cell for.
    const ha = areaRu.units.hectare?.forms;
    expect(ha?.[key("hectare", "after-number", 5)]).toBe("гектаров");
    expect(ha?.[key("hectare", "conversion-target", 5)]).toBe("гектарах");
    expect(key("hectare", "conversion-target")).toBe("loc-other");
    expect(ha?.[key("hectare", "conversion-target")]).toBe("гектарах");
    // The prepositional singular is its own ending: "в 1 гектаре".
    expect(ha?.[key("hectare", "conversion-target", 1)]).toBe("гектаре");
  });

  test("an engine built from it reads and writes Russian area", () => {
    const e = engine();
    // The numeral boundary, in both directions of the pair.
    expect(e.evaluate("2 гектара").formatted).toBe("2 гектара");
    expect(e.evaluate("5 гектаров").formatted).toBe("5 гектаров");
    // Arithmetic landing on a fraction: genitive *singular*, "1,5 гектара",
    // which is also the assertion that would read "1,5 гектаров" if `nom-other`
    // were wrong.
    expect(e.evaluate("1 гектар + 5000 м2").formatted).toBe("1,5 гектара");
    expect(e.evaluate("5 акров").formatted).toBe("5 акров");
    // The colloquial zero-ending genitive plural reads without an entry of its
    // own — it is spelled like the nominative singular — and prints back as the
    // written norm.
    expect(e.evaluate("5 гектар").formatted).toBe("5 гектаров");
    // A conversion landing on a unit with no forms: it renders through the
    // symbol branch, tight against the number, and the number is grouped by
    // U+00A0 because `numberFormat: "intl"` reads that from CLDR. Written as an
    // escape — a literal NBSP is invisible here and degrades to a plain space.
    expect(e.evaluate("2 га в м2").formatted).toBe("20\u00A0000м²");
    // Both scripts read: a Russian engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Russian.
    expect(e.evaluate("2 ha").formatted).toBe("2 гектара");
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "1,5 гектара",
      "5 акров",
      "5 га в акрах",
      "1 гектар + 5000 м2",
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
