import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeDe from "./de";

const engine = () =>
  createEngine({
    locales: [composeLocale(german, [volumeDe])],
    kinds: [volume],
  });

/** The four keys `german.selectForm` can produce, sorted. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no German word", () => {
    // `pint` is deliberately absent from the pattern: it is a *unit id*, so it
    // is in the kind by construction and matching on it would assert the
    // opposite of what this test means. The German-only nouns are what a
    // translation leaking into the language-free half would look like.
    expect(JSON.stringify(volume)).not.toMatch(/kubikmeter|gallone|litern/i);
    expect(JSON.stringify(volume)).not.toMatch(/[äöüß]/i);
  });

  test("m3 carries forms here, where en and uk carry none", () => {
    // The one place this vocabulary disagrees with its neighbours, and the
    // disagreement is about German rather than about the unit: "cubic metres"
    // and "кубічних метрів" are phrases, and `lex` ends a word token at a
    // space, so neither language can print a form it could read back.
    // `Kubikmeter` is one token, listed as an alias below, and round-trips.
    expect(volumeDe.units.m3?.forms?.["nom-one"]).toBe("Kubikmeter");
    expect(volumeDe.units.m3?.aliases).toContain("kubikmeter");
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows four is all `german.selectForm` can ever ask for,
    // which is what gives the exact-match assertion below its teeth (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          german.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(volumeDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Folded on both sides, which is German-specific rather than a loosening:
    // every German noun is capitalised, so the table prints `Liter` while the
    // alias index — whose keys `buildRegistry` writes through
    // `toLocaleLowerCase` — holds `liter`.
    for (const [unit, words] of Object.entries(volumeDe.units)) {
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
      assertLocaleContract(composeLocale(german, [volumeDe]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it —
    // "1,5 Gallonen", a plural, where Ukrainian's same row is a genitive
    // singular.
    expect(() =>
      assertLocaleContract(composeLocale(german, [volumeDe]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the number axis moves on the feminine noun and nowhere else", () => {
    expect(word("l", 1)).toBe("Liter");
    expect(word("l", 2)).toBe("Liter");
    expect(word("l", 1.5)).toBe("Liter");
    expect(word("m3", 2)).toBe("Kubikmeter");
    expect(word("pint", 2)).toBe("Pint");
    // `die Gallone` is feminine and takes its ordinary plural, so this is the
    // one pair in the file where the two nominative rows are different words.
    expect(word("gal", 1)).toBe("Gallone");
    expect(word("gal", 2)).toBe("Gallonen");
    expect(word("gal", 1.5)).toBe("Gallonen");
  });

  test("a conversion target is dative, with or without a count", () => {
    // "in Litern" and "in Kubikmetern" — the `-er` stems decline, and ruling R5
    // sends a count-free target to `dat-other`.
    expect(word("l", 1, "conversion-target")).toBe("Liter");
    expect(word("l", 2, "conversion-target")).toBe("Litern");
    expect(word("l", undefined, "conversion-target")).toBe("Litern");
    expect(word("m3", undefined, "conversion-target")).toBe("Kubikmetern");
    // And the two that do not: German writes "in Pint", and `Gallonen` already
    // ends in `-n`.
    expect(word("pint", undefined, "conversion-target")).toBe("Pint");
    expect(word("gal", undefined, "conversion-target")).toBe("Gallonen");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // `compoundSplitter` finds `meter` inside `Kubikmeter` at -3 and the alias
    // is weight 0. In this single-kind engine there is no metre for the split
    // to reach, but the ordering is what keeps the cubic metre intact in an
    // engine that also speaks `@smartput/length` — which is exactly the
    // arrangement `third-language.test.ts` measures for `Zentimeter`.
    const e = engine();
    expect(e.evaluate("10 Kubikmeter").value.unit).toBe("m3");
    expect(e.evaluate("10 Milliliter").value.unit).toBe("ml");
  });

  test("an engine built from it reads and writes German volume", () => {
    const e = engine();
    expect(e.evaluate("1 Liter").formatted).toBe("1 Liter");
    expect(e.evaluate("2 Liter").formatted).toBe("2 Liter");
    // The feminine pair, across the CLDR boundary in both directions.
    expect(e.evaluate("1 Gallone").formatted).toBe("1 Gallone");
    expect(e.evaluate("2 Gallonen").formatted).toBe("2 Gallonen");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the masculine noun does not move.
    expect(e.evaluate("1 l + 0,5 l").formatted).toBe("1,5 Liter");
    expect(e.evaluate("1 Gallone + 0,5 Gallonen").formatted).toBe("1,5 Gallonen");
    // A conversion written with a German keyword.
    expect(e.evaluate("0,5 Liter in Milliliter").formatted).toBe("500 Milliliter");
    // The compound, printed as a word rather than as `m³` — the one visible
    // consequence of giving `m3` a forms table.
    expect(e.evaluate("0,5 m3").formatted).toBe("0,5 Kubikmeter");
    expect(e.evaluate("0,5 m³").formatted).toBe("0,5 Kubikmeter");
    // Latin input still reads, and answers in German.
    expect(e.evaluate("2 l").formatted).toBe("2 Liter");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("1 Kubikmeter in Liter").formatted).toBe("1.000 Liter");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: German groups with ".", which the lexer does
    // not read back as a group, so a grouped output is asserted above as a
    // string instead.
    const e = engine();
    for (const input of [
      "1 l + 0,5 l",
      "0,5 Liter in Milliliter",
      "2 Gallonen",
      "3 Pint",
      "0,5 Kubikmeter",
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
