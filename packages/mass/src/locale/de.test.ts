import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massDe from "./de";

const engine = () =>
  createEngine({
    locales: [composeLocale(german, [massDe])],
    kinds: [mass],
  });

/** The four keys `german.selectForm` can produce, sorted. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no German word", () => {
    // The nouns first — German shares the unit ids' script, so a bare
    // "no non-ASCII" sweep would pass a kind that had grown a `Gramm` — then
    // the umlauts and `ß`, which no ratio or magnitude band can contain.
    expect(JSON.stringify(mass)).not.toMatch(/gramm|tonnen|unze|pfund/i);
    expect(JSON.stringify(mass)).not.toMatch(/[äöüß]/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows four is all `german.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean
    // something (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          german.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(massDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Folded on both sides, which is German-specific rather than a loosening:
    // every German noun is capitalised, so the table prints `Gramm` while the
    // alias index — whose keys `buildRegistry` writes through
    // `toLocaleLowerCase` — holds `gramm`.
    for (const [unit, words] of Object.entries(massDe.units)) {
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
      assertLocaleContract(composeLocale(german, [massDe]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached. 1.5 is what makes the contract sample it — and
    // in German that row is a plural ("1,5 Tonnen"), where Ukrainian's same row
    // is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(german, [massDe]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the number axis moves on the feminine nouns and nowhere else", () => {
    // Neuter measure nouns stay uninflected after a numeral, so all four rows
    // are one string. This is the mirror image of English, where the number is
    // always marked and the case never is.
    expect(word("g", 1)).toBe("Gramm");
    expect(word("g", 2)).toBe("Gramm");
    expect(word("g", 1.5)).toBe("Gramm");
    expect(word("kg", 5)).toBe("Kilogramm");
    expect(word("lb", 5)).toBe("Pfund");
    // `die Tonne` and `die Unze` are feminine and take their ordinary plural,
    // so these two are the only rows in the file where `nom-one` and
    // `nom-other` differ.
    expect(word("t", 1)).toBe("Tonne");
    expect(word("t", 2)).toBe("Tonnen");
    expect(word("t", 1.5)).toBe("Tonnen");
    expect(word("oz", 1)).toBe("Unze");
    expect(word("oz", 2)).toBe("Unzen");
  });

  test("a conversion target is dative, with or without a count", () => {
    // "in Gramm" is the whole German phrase: a `-gramm` noun adds nothing in
    // the dative plural, so the case axis is inert here — unlike
    // `@smartput/length/locale/de`, where the same slot prints "in Metern".
    // Ruling R5 sends a count-free target to `dat-other`.
    expect(word("g", undefined, "conversion-target")).toBe("Gramm");
    expect(word("kg", 2, "conversion-target")).toBe("Kilogramm");
    expect(word("lb", undefined, "conversion-target")).toBe("Pfund");
    // The feminine plural already ends in `-n`, so its dative is its
    // nominative — the number axis carries this unit and the case axis does
    // not.
    expect(word("t", undefined, "conversion-target")).toBe("Tonnen");
    expect(word("t", 1, "conversion-target")).toBe("Tonne");
    expect(word("oz", undefined, "conversion-target")).toBe("Unzen");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // `compoundSplitter` finds `gramm` inside `Kilogramm` at -3 and the alias
    // written out above is weight 0, so the kilogram wins. That ordering is the
    // only reason the head list may contain a morpheme as productive as
    // `-gramm` at all.
    const e = engine();
    expect(e.evaluate("10 Kilogramm").value.unit).toBe("kg");
    expect(e.evaluate("10 Milligramm").value.unit).toBe("mg");
    expect(e.evaluate("10 Gramm").value.unit).toBe("g");
  });

  test("an engine built from it reads and writes German mass", () => {
    const e = engine();
    expect(e.evaluate("1 Gramm").formatted).toBe("1 Gramm");
    expect(e.evaluate("5 Gramm").formatted).toBe("5 Gramm");
    // The feminine pair, across the CLDR boundary in both directions.
    expect(e.evaluate("1 Tonne").formatted).toBe("1 Tonne");
    expect(e.evaluate("2 Tonnen").formatted).toBe("2 Tonnen");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the neuter noun does not move.
    expect(e.evaluate("1 kg + 500 g").formatted).toBe("1,5 Kilogramm");
    // The same fraction on a noun that does move.
    expect(e.evaluate("1 Tonne + 500 kg").formatted).toBe("1,5 Tonnen");
    // A conversion written with a German keyword. "zu" and "nach" reach the
    // same `in` keyword, which is `german.keywords`' doing and not this file's.
    expect(e.evaluate("0,5 kg in Gramm").formatted).toBe("500 Gramm");
    expect(e.evaluate("500 g zu Kilogramm").formatted).toBe("0,5 Kilogramm");
    // `Pfund` reads as the avoirdupois pound, which is the ambiguity the
    // vocabulary documents: a German cook means 500 g by it, and this kind has
    // no 500 g unit for that sense to resolve to.
    expect(e.evaluate("2 Pfund").value.unit).toBe("lb");
    expect(e.evaluate("2 Pfund").formatted).toBe("2 Pfund");
    // Latin input still reads, and answers in German.
    expect(e.evaluate("2 kg").formatted).toBe("2 Kilogramm");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("2 kg in Gramm").formatted).toBe("2.000 Gramm");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: German groups with ".", which the lexer does
    // not read back as a group, so a grouped output is asserted above as a
    // string instead.
    const e = engine();
    for (const input of [
      "1 kg + 500 g",
      "0,5 kg in Gramm",
      "5 Unzen",
      "2 Tonnen",
      "1,5 Pfund",
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
