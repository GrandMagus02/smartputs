import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureNl from "./nl";

const engine = () =>
  createEngine({
    locales: [composeLocale(dutch, [measureNl])],
    kinds: [measure],
  });

/** The two keys `dutch.selectForm` can produce, sorted. */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Dutch word", () => {
    // Only the nouns, and there is no second sweep to back them up: Dutch is
    // written in plain ASCII, so the umlaut-and-`ß` check that catches a stray
    // German word in `de.test.ts` has no Dutch equivalent.
    //
    // `pica` is anchored on word boundaries and the others are not, for the
    // reason `de.test.ts` records: the kind's own `ty-pica-l` map contains the
    // substring, so an unanchored alternative fails on a string that is not a
    // Dutch word at all.
    expect(JSON.stringify(measure)).not.toMatch(/duim|punt|\bpica\b|centimeter/i);
  });

  test("cicero and augustijn are not picas and are not listed", () => {
    // The two Dutch words a translator would add and should not. Both name
    // twelve *Didot* points (~4.512 mm) where a pica is 4.233 mm, so listing
    // either would answer a wrong number for a word a Dutch typesetter really
    // types. The kind has no Didot unit for the right reading to land on, so
    // both stay out and the engine refuses them — which says "unknown", where a
    // 6 % error would say nothing. `@smartput/measure/locale/de` makes the same
    // ruling about `Cicero`; Dutch inherits the trap and a second name for it.
    for (const words of Object.values(measureNl.units)) {
      expect(words.aliases).not.toContain("cicero");
      expect(words.aliases).not.toContain("augustijn");
    }
    expect(() => engine().evaluate("12 cicero")).toThrow();
    expect(() => engine().evaluate("12 augustijn")).toThrow();
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows two is all `dutch.selectForm` can ever ask for. The
    // slot loop is the load-bearing half here — Dutch reads `slot` and discards
    // it, so a language that had grown a case axis (German's, which needs four
    // keys for this same kind) would show up as a third key (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          dutch.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(measureNl.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs. Dutch
    // capitalises no noun, so the table prints `punt` and the alias index holds
    // `punt` — the two halves of this file are the same strings, and asserting
    // that is the point rather than an oversight.
    for (const [unit, words] of Object.entries(measureNl.units)) {
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
      assertLocaleContract(composeLocale(dutch, [measureNl]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so `Intl.PluralRules("nl")` answers
    // from the integer side alone and the fractional reading of `other` is never
    // reached. 1.5 is what makes the contract sample it — the row where "1,5
    // punt" stays invariant and "1,5 pixels" does not, which is the split this
    // kind exists to show.
    expect(() =>
      assertLocaleContract(composeLocale(dutch, [measureNl]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the pixel marks its plural and the five measures do not", () => {
    // The Dutch rule and its exception, inside one kind. A measure noun stays
    // singular after a numeral — "twaalf punt", "twee inch", "zes pica" — while
    // a pixel is a thing you can count, and Dutch marks that: "een afbeelding
    // van 800 bij 600 pixels", never "600 pixel".
    for (const unit of ["inch", "mm", "cm", "pt", "pc"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2));
      expect(word(unit, 1), unit).toBe(word(unit, 1.5));
    }
    expect(word("pt", 12)).toBe("punt");
    expect(word("inch", 2)).toBe("inch");
    expect(word("pc", 6)).toBe("pica");
    expect(word("px", 1)).toBe("pixel");
    expect(word("px", 1920)).toBe("pixels");
    expect(word("px", 1.5)).toBe("pixels");
  });

  test("a conversion target is spelled like a bare quantity", () => {
    // `in` and `naar` govern nothing in Dutch, so a count-free target (ruling R5
    // sends it to `other`) is simply the plural where there is one — "in
    // pixels" — and the bare noun where there is not. `de.ts` needs a whole
    // second axis to write "in Pixeln".
    expect(word("px", undefined, "conversion-target")).toBe("pixels");
    expect(word("px", 1, "conversion-target")).toBe("pixel");
    for (const unit of ["inch", "mm", "cm", "pt", "pc"]) {
      expect(word(unit, undefined, "conversion-target"), unit).toBe(word(unit, 1));
    }
    expect(word("pt", undefined, "conversion-target")).toBe("punt");
    expect(word("cm", undefined, "conversion-target")).toBe("centimeter");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // `compoundSplitter` finds `meter` inside `centimeter` at -3 and the alias
    // is weight 0. There is no metre in this kind for the split to reach, but
    // the ordering is what keeps a typographic centimetre intact in an engine
    // that also speaks a length vocabulary.
    const e = engine();
    expect(e.evaluate("10 centimeter").value.unit).toBe("cm");
    expect(e.evaluate("10 millimeter").value.unit).toBe("mm");
  });

  test("an engine built from it reads and writes Dutch typography", () => {
    const e = engine();
    expect(e.evaluate("12 punt").formatted).toBe("12 punt");
    expect(e.evaluate("1 punt").formatted).toBe("1 punt");
    // The apostrophe plural, which `lex` keeps whole because the apostrophe
    // stands between two letters — answered with the invariant measure form.
    expect(e.evaluate("6 pica's").formatted).toBe("6 pica");
    // The conversions a typesetter actually asks for, written with both Dutch
    // keywords and answered in Dutch nouns.
    expect(e.evaluate("1 inch in punt").formatted).toBe("72 punt");
    expect(e.evaluate("72 punt in inch").formatted).toBe("1 inch");
    expect(e.evaluate("1 inch in pixels").formatted).toBe("96 pixels");
    expect(e.evaluate("6 pc naar inch").formatted).toBe("1 inch");
    // Arithmetic landing on a fraction, with the decimal comma CLDR gives this
    // language through `numberFormat: "intl"`, and a noun that does not move.
    expect(e.evaluate("0,5 inch + 0,25 inch").formatted).toBe("0,75 inch");
    // The one that does move, across the CLDR boundary.
    expect(e.evaluate("1 pixel + 1 pixel").formatted).toBe("2 pixels");
    // Latin input still reads, and answers in Dutch.
    expect(e.evaluate("72 pt").formatted).toBe("72 punt");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("20 inch in pixels").formatted).toBe("1.920 pixels");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: Dutch groups with ".", which the lexer does not
    // read back as a group, so the grouped conversion above is asserted as a
    // string instead.
    const e = engine();
    for (const input of [
      "0,5 inch + 0,25 inch",
      "72 punt in inch",
      "1 inch in pixels",
      "10 centimeter",
      "6 pica's",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toFixed(20), input).toBe(
        first.value.canonical.toFixed(20),
      );
    }
  });
});
