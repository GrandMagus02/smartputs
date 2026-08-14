import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthDe from "./de";

const engine = () =>
  createEngine({
    locales: [composeLocale(german, [lengthDe])],
    kinds: [length],
  });

/** The four keys `german.selectForm` can produce, sorted. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "length",
    unit,
    slot,
  });
  return (lengthDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no German word", () => {
    // Two checks, because German is written in the same script as the unit ids
    // and a bare "no non-ASCII" sweep would pass a kind that had grown a
    // `Meter`. The nouns come first; the umlauts and the `ß` are the characters
    // no ratio, unit id or magnitude band can legitimately contain.
    expect(JSON.stringify(length)).not.toMatch(/meter|zoll|fu(ß|ss)|yard|meile/i);
    expect(JSON.stringify(length)).not.toMatch(/[äöüß]/i);
  });

  // `in` is a German conversion keyword too — `german.keywords.in` is
  // in/nach/zu — so `lex` emits it as a keyword token here exactly as it does
  // in English, and the alias would be unreachable on the engine path even
  // before the cross-language `isUnitAlias` argument applies. See the
  // vocabulary's own comment.
  test("`in` is left to the conversion keyword here too", () => {
    for (const words of Object.values(lengthDe.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthDe.units.in?.aliases).toContain("zoll");
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // The key set is closed and is derived here rather than trusted: sweeping
    // every slot against a spread of counts is the only way to show that four
    // is all `german.selectForm` can ever ask for, which is what makes an
    // exact-match assertion on each table meaningful (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          german.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(lengthDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Folded on both sides, which is a German-specific step rather than a
    // loosening: every German noun is capitalised, so the table prints `Meter`
    // while the alias index — whose keys `buildRegistry` writes through
    // `toLocaleLowerCase` — holds `meter`. Comparing the two verbatim would
    // demand a capitalised duplicate of every alias that reads nothing extra.
    for (const [unit, words] of Object.entries(lengthDe.units)) {
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
      assertLocaleContract(composeLocale(german, [lengthDe]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so `Intl.PluralRules("de")` answers
    // `one` or `other` from the integer side alone and the fractional reading of
    // `other` is never reached. 1.5 is what makes the contract sample the row a
    // German vocabulary is likeliest to get wrong — "1,5 Meilen", plural, where
    // Ukrainian's same row is a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(german, [lengthDe]), [length], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the number axis moves on the feminine noun and nowhere else", () => {
    // Duden's Maßangabe rule: a masculine or neuter measure noun stays
    // uninflected after a numeral. Three of `Meter`'s four rows are therefore
    // the same string, which is German and not an unfinished table.
    expect(word("m", 1)).toBe("Meter");
    expect(word("m", 2)).toBe("Meter");
    expect(word("m", 1.5)).toBe("Meter");
    expect(word("in", 12)).toBe("Zoll");
    expect(word("ft", 6)).toBe("Fuß");
    expect(word("yd", 3)).toBe("Yard");
    // `die Meile` is feminine and takes its ordinary plural, so this is the one
    // unit here where `nom-one` and `nom-other` are different words. A
    // vocabulary that wrote `Meile` four times would look like the rows above
    // and be wrong.
    expect(word("mi", 1)).toBe("Meile");
    expect(word("mi", 2)).toBe("Meilen");
    expect(word("mi", 1.5)).toBe("Meilen");
  });

  test("a conversion target is dative, with or without a count", () => {
    // "in 100 Metern", and the row no `Result` can reach: "in Metern", chosen
    // with no magnitude in hand at all (ruling R5 sends a count-free target to
    // `dat-other`).
    expect(word("m", 1, "conversion-target")).toBe("Meter");
    expect(word("m", 2, "conversion-target")).toBe("Metern");
    expect(word("m", undefined, "conversion-target")).toBe("Metern");
    expect(word("cm", undefined, "conversion-target")).toBe("Zentimetern");
    // The imperial four decline nowhere: German writes "in Zoll" and "in Fuß",
    // so their dative row equals their nominative one — the case axis is inert
    // exactly where the number axis was.
    expect(word("in", undefined, "conversion-target")).toBe("Zoll");
    expect(word("ft", 2, "conversion-target")).toBe("Fuß");
    // And on the feminine noun the two axes swap roles: `Meilen` already ends
    // in `-n`, so the dative adds nothing.
    expect(word("mi", undefined, "conversion-target")).toBe("Meilen");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // The whole reason `Zentimeter` is written out above. `compoundSplitter`
    // finds `meter` inside it at -3; the alias here is weight 0, and the
    // centimetre wins. Flip that ordering and this answers ten metres.
    const e = engine();
    expect(e.evaluate("10 Zentimeter").value.unit).toBe("cm");
    expect(e.evaluate("10 Kilometer").value.unit).toBe("km");
    // And the compound no vocabulary would ever list, which is what the split
    // is for: a Bandmeter is a measuring tape, and it is a metre by its head.
    expect(e.evaluate("10 Bandmeter").value.unit).toBe("m");
  });

  test("an engine built from it reads and writes German length", () => {
    const e = engine();
    // The invariant plural, in both directions across the CLDR boundary.
    expect(e.evaluate("1 Meter").formatted).toBe("1 Meter");
    expect(e.evaluate("7 Meter").formatted).toBe("7 Meter");
    // The marked one, which is the same boundary on a word that moves.
    expect(e.evaluate("1 Meile").formatted).toBe("1 Meile");
    expect(e.evaluate("2 Meilen").formatted).toBe("2 Meilen");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays uninflected.
    expect(e.evaluate("1 km + 500 m").formatted).toBe("1,5 Kilometer");
    expect(e.evaluate("1 Meile + 0,5 Meilen").formatted).toBe("1,5 Meilen");
    // A conversion written with the German keyword, read and answered in
    // German nouns.
    expect(e.evaluate("3 Fuß in Zoll").formatted).toBe("36 Zoll");
    expect(e.evaluate("1 Meile nach Kilometer").formatted).toBe("1,609344 Kilometer");
    // Latin input still reads: a German developer types "2 km" and a German
    // engine answers in German.
    expect(e.evaluate("2 km").formatted).toBe("2 Kilometer");
    // The group separator, which is the exact inverse of English's. This is
    // asserted as text and deliberately kept out of the round trip below.
    expect(e.evaluate("10 Kilometer in Meter").formatted).toBe("10.000 Meter");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: German groups with ".", which the lexer reads
    // as nothing at all on the way back in, so a grouped output is asserted
    // above as a string instead.
    const e = engine();
    for (const input of [
      "1 km + 500 m",
      "3 Fuß in Zoll",
      "5 Meilen",
      "10 Zentimeter",
      "1,5 m",
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
