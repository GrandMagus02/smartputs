import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureDe from "./de";

const engine = () =>
  createEngine({
    locales: [composeLocale(german, [measureDe])],
    kinds: [measure],
  });

/** The four keys `german.selectForm` can produce, sorted. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no German word", () => {
    // German shares the unit ids' script, so the nouns have to be named — a
    // bare "no non-ASCII" sweep would pass a kind that had grown a `Punkt`.
    // The umlaut check beside it catches everything else German at once.
    //
    // `pica` is anchored on word boundaries and the others are not, for a
    // reason worth keeping: the kind's own `ty-pica-l` map contains the
    // substring, so an unanchored alternative fails this test on a string that
    // is not a German word at all.
    expect(JSON.stringify(measure)).not.toMatch(/zoll|punkt|\bpica\b|pixel|zentimeter/i);
    expect(JSON.stringify(measure)).not.toMatch(/[äöüß]/i);
  });

  test("Cicero is not a pica and is not listed", () => {
    // The one German word a translator would add and should not: a Cicero is
    // twelve Didot points (~4.512 mm) where a pica is 4.233 mm, so listing it
    // would answer a wrong number for the word a German typesetter types first.
    // The kind has no Didot unit for the right reading to land on, so the word
    // stays out and the engine refuses it — which says "unknown", where a 6 %
    // error would say nothing.
    for (const words of Object.values(measureDe.units)) {
      expect(words.aliases).not.toContain("cicero");
    }
    expect(() => engine().evaluate("12 Cicero")).toThrow();
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
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(measureDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Folded on both sides, which is German-specific rather than a loosening:
    // every German noun is capitalised, so the table prints `Pixel` while the
    // alias index — whose keys `buildRegistry` writes through
    // `toLocaleLowerCase` — holds `pixel`.
    for (const [unit, words] of Object.entries(measureDe.units)) {
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
      assertLocaleContract(composeLocale(german, [measureDe]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached at all. 1.5 is what makes the contract sample
    // it — the row a language that inflects for number would get wrong, and the
    // row German answers with the same word as every other count.
    expect(() =>
      assertLocaleContract(composeLocale(german, [measureDe]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("no unit in this kind moves on the number axis", () => {
    // None of the six is feminine, so Duden's Maßangabe rule covers all of them
    // and `nom-one` equals `nom-other` everywhere. Compare
    // `@smartput/length/locale/de`, where `die Meile` gives `Meile`/`Meilen`.
    for (const unit of ["inch", "mm", "cm", "pt", "pc", "px"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2));
      expect(word(unit, 1), unit).toBe(word(unit, 1.5));
    }
    expect(word("pt", 12)).toBe("Punkt");
    expect(word("px", 1920)).toBe("Pixel");
    expect(word("inch", 2)).toBe("Zoll");
  });

  test("a conversion target is dative where the stem declines", () => {
    // "eine Angabe in Pixeln", "in Zentimetern" — and ruling R5 sends a
    // count-free target to `dat-other`, which is the row a `Result` can never
    // reach.
    expect(word("px", undefined, "conversion-target")).toBe("Pixeln");
    expect(word("px", 1, "conversion-target")).toBe("Pixel");
    expect(word("cm", undefined, "conversion-target")).toBe("Zentimetern");
    expect(word("mm", undefined, "conversion-target")).toBe("Millimetern");
    // And the three that stay bare: German sets type "in 12 Punkt", where "in
    // 12 Punkten" would be twelve items on a list.
    expect(word("pt", undefined, "conversion-target")).toBe("Punkt");
    expect(word("inch", undefined, "conversion-target")).toBe("Zoll");
    expect(word("pc", undefined, "conversion-target")).toBe("Pica");
  });

  test("an exact alias outranks the compound split inside it", () => {
    // `compoundSplitter` finds `meter` inside `Zentimeter` at -3 and the alias
    // is weight 0. There is no metre in this kind for the split to reach, but
    // the ordering is what keeps a typographic centimetre intact in an engine
    // that also speaks a length vocabulary.
    const e = engine();
    expect(e.evaluate("10 Zentimeter").value.unit).toBe("cm");
    expect(e.evaluate("10 Millimeter").value.unit).toBe("mm");
  });

  test("an engine built from it reads and writes German typography", () => {
    const e = engine();
    expect(e.evaluate("12 Punkt").formatted).toBe("12 Punkt");
    expect(e.evaluate("1 Punkt").formatted).toBe("1 Punkt");
    // The conversions a typesetter actually asks for, written with the German
    // keyword and answered in German nouns.
    expect(e.evaluate("1 Zoll in Punkt").formatted).toBe("72 Punkt");
    expect(e.evaluate("72 Punkt in Zoll").formatted).toBe("1 Zoll");
    expect(e.evaluate("1 Zoll in Pixel").formatted).toBe("96 Pixel");
    expect(e.evaluate("6 pc nach Zoll").formatted).toBe("1 Zoll");
    // Arithmetic landing on a fraction, with the decimal comma CLDR gives this
    // language through `numberFormat: "intl"`, and a noun that does not move.
    expect(e.evaluate("0,5 Zoll + 0,25 Zoll").formatted).toBe("0,75 Zoll");
    // Latin input still reads, and answers in German.
    expect(e.evaluate("72 pt").formatted).toBe("72 Punkt");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("20 Zoll in Pixel").formatted).toBe("1.920 Pixel");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: German groups with ".", which the lexer does
    // not read back as a group, so the grouped conversion above is asserted as
    // a string instead.
    const e = engine();
    for (const input of [
      "0,5 Zoll + 0,25 Zoll",
      "72 Punkt in Zoll",
      "1 Zoll in Pixel",
      "10 Zentimeter",
      "6 Pica",
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
