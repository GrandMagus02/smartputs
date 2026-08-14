import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaNl from "./nl";

const engine = () =>
  createEngine({
    locales: [composeLocale(dutch, [areaNl])],
    kinds: [area],
  });

/** The two keys `dutch.selectForm` can produce, sorted. */
const KEYS = ["one", "other"];

/** The units this vocabulary deliberately gives no `forms` table. */
const SQUARED = ["m2", "cm2", "km2"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Dutch word", () => {
    // Only the nouns, and there is no second sweep to back them up: Dutch is
    // written in plain ASCII, so the umlaut-and-`ß` check that catches a stray
    // German word in `de.test.ts` has no Dutch equivalent. Naming the words is
    // the whole check here.
    expect(JSON.stringify(area)).not.toMatch(/vierkante|hectaren|hektar/i);
  });

  test("the squared units print their symbol, because Dutch names them with two words", () => {
    // The decision this file takes against `@smartput/area/locale/de`, which
    // does give all three a table. German writes the concept as the single token
    // `Quadratmeter`; the Dutch name is `vierkante meter`, an inflected
    // adjective plus a noun, and `lex` ends a word token at a space — so a
    // printed form would be text no analyzer is ever handed whole, which
    // `assertLocaleContract` fails by name. `en` and `uk` refuse a table for
    // this exact reason and Dutch joins them, which is the sharpest place in
    // these six packages where "Dutch is German with different words" is wrong.
    for (const unit of SQUARED) {
      expect(areaNl.units[unit as "m2"]?.forms, unit).toBeUndefined();
    }
    expect(areaNl.units.m2?.symbol).toBe("m²");
    // Listed for *reading* all the same: the closed-up spelling is one token, so
    // the index can hold it, and reading a word and printing it are separate
    // decisions.
    expect(areaNl.units.m2?.aliases).toContain("vierkantemeter");
    const e = engine();
    expect(e.evaluate("10 vierkantemeter").value.unit).toBe("m2");
    expect(e.evaluate("1 vierkantekilometer").value.unit).toBe("km2");
  });

  test("every unit with a table carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows two is all `dutch.selectForm` can ever ask for. The
    // slot loop is the load-bearing half here — Dutch reads `slot` and discards
    // it, so a language that had grown a case axis would show up as a third key
    // (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          dutch.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "area",
            unit: "hectare",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // The three squared units have no table at all — asserted above, and skipped
    // here rather than softened, because a *partial* table is the failure this
    // check exists to catch.
    for (const [unit, words] of Object.entries(areaNl.units)) {
      if (SQUARED.includes(unit)) continue;
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs. Dutch
    // capitalises no noun, so the table prints `hectare` and the alias index
    // holds `hectare` — the two halves of this file are the same strings, and
    // asserting that is the point rather than an oversight.
    for (const [unit, words] of Object.entries(areaNl.units)) {
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
      assertLocaleContract(composeLocale(dutch, [areaNl]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so `Intl.PluralRules("nl")` answers
    // from the integer side alone and the fractional reading of `other` is never
    // reached. 1.5 is what makes the contract sample it — and in Dutch that row
    // holds the same invariant noun as every other count ("1,5 hectare").
    expect(() =>
      assertLocaleContract(composeLocale(dutch, [areaNl]), [area], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("neither named unit moves on the number axis", () => {
    // The Dutch measure rule: "een boerderij van 40 hectare", "200 acre". Both
    // rows of both tables are one word, and the free-noun plurals — `hectaren`,
    // `hectares`, `acres` — are listed for reading only. Compare
    // `@smartput/angle/locale/nl`, where `graad`/`graden` does move because an
    // angle is counted rather than measured out.
    for (const unit of ["hectare", "acre"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2));
      expect(word(unit, 1), unit).toBe(word(unit, 1.5));
    }
    expect(word("hectare", 40)).toBe("hectare");
    expect(word("acre", 200)).toBe("acre");
  });

  test("a conversion target is spelled like a bare quantity", () => {
    // `in` and `naar` govern nothing in Dutch, so the count-free target (ruling
    // R5 sends it to `other`) is the bare noun. `de.ts` needs a whole second
    // axis for this kind, and three of its five units use it.
    for (const unit of ["hectare", "acre"]) {
      expect(word(unit, undefined, "conversion-target"), unit).toBe(word(unit, 1));
    }
    expect(word("hectare", undefined, "conversion-target")).toBe("hectare");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // `compoundSplitter` finds `meter` inside `vierkantemeter` at -3 and the
    // alias is weight 0. There is no metre in this kind for the split to reach,
    // but the ordering is what keeps a square metre intact in an engine that
    // also speaks `@smartput/length/locale/nl`.
    const e = engine();
    expect(e.evaluate("10 vierkantemeter").value.unit).toBe("m2");
    // `vierkantecentimeter` ends in `centimeter` *and* in `meter`, so the
    // splitter offers two readings and neither is this unit; the exact alias is
    // what settles it.
    expect(e.evaluate("10 vierkantecentimeter").value.unit).toBe("cm2");
  });

  test("an engine built from it reads and writes Dutch area", () => {
    const e = engine();
    expect(e.evaluate("2 hectare").formatted).toBe("2 hectare");
    expect(e.evaluate("2 acre").formatted).toBe("2 acre");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun does not move.
    expect(e.evaluate("1 hectare + 0,5 hectare").formatted).toBe("1,5 hectare");
    // A conversion into a unit that has no word — it answers with the symbol,
    // spaced, because `dutch.renderQuantity` sets a symbol off from the number
    // the way SI asks where the default template writes English's tight "10m²".
    expect(e.evaluate("10 vierkantemeter").formatted).toBe("10 m²");
    expect(e.evaluate("100 vierkantemeter in hectare").formatted).toBe("0,01 hectare");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("1 hectare in m2").formatted).toBe("10.000 m²");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: Dutch groups with ".", which the lexer does not
    // read back as a group, so a grouped output is asserted above as a string
    // instead.
    const e = engine();
    for (const input of [
      "1 hectare + 0,5 hectare",
      "100 vierkantemeter in hectare",
      "10 vierkantemeter",
      "2 acre",
      "1,5 m2",
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
