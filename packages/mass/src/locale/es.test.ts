import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massEs from "./es";

const es = composeLocale(spanish, [massEs]);
const engine = createEngine({ locales: [es], kinds: [mass] });

/**
 * The two keys `spanish.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Spanish word", () => {
    // Spanish shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Spanish orthography (accented vowels and `ñ`, which no ASCII unit id can
    // contain), and none of the six nouns spelled out.
    expect(JSON.stringify(mass)).not.toMatch(/[áéíóúüñ]/i);
    expect(JSON.stringify(mass)).not.toMatch(/gramos?|tonelada|onza|libra/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(massEs.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
    }
    // ...and the list above is the whole of what the language can ask for,
    // swept over the counts that separate CLDR's Spanish categories: 1 is
    // `one`, 1e6 is `many` before `spanish.selectForm` folds it, and the rest
    // are `other`.
    const seen = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1e6]) {
        seen.add(
          spanish.selectForm({
            count: new Decimal(count),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
      seen.add(spanish.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared.
    for (const [unit, words] of Object.entries(massEs.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit} prints ${form}`).toContain(form);
      }
      if (words.symbol !== undefined) {
        expect(words.aliases, `${unit} prints ${words.symbol}`).toContain(words.symbol);
      }
    }
  });

  test("every alias is unique within the kind, so no reading is ambiguous", () => {
    const seen = new Map<string, string>();
    for (const [unit, words] of Object.entries(massEs.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(es, [mass])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Spanish spells both
    // with the same row — that is the claim being tested, and it is a claim,
    // not a tautology: Ukrainian's fractional row is a *different* word from
    // its plural, so a language that gets this wrong is one this sweep is the
    // only thing to catch.
    assertLocaleContract(es, [mass], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("kg", 1)).toBe("kilogramo");
    expect(word("kg", 0)).toBe("kilogramos");
    expect(word("kg", 2)).toBe("kilogramos");
    expect(word("kg", 1.5)).toBe("kilogramos");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Spanish reuses `other`, the generic category CLDR
    // requires every locale to define.
    expect(word("g", undefined, "conversion-target")).toBe("gramos");
    // The million, the row CLDR files under `many` and `spanish.selectForm`
    // folds into `other`: "un millón de gramos" is the compact register this
    // engine never prints, and in full digits it is an ordinary plural.
    expect(word("g", 1e6)).toBe("gramos");
    // The feminine nouns take the same two rows as the masculine ones, because
    // gender lives on the noun and not on the slot. What it would change is the
    // numeral in front ("una libra"), which no `forms` key can reach.
    expect(word("lb", 1)).toBe("libra");
    expect(word("lb", 2)).toBe("libras");
  });

  test("an engine built from it reads and writes Spanish mass", () => {
    expect(engine.evaluate("2 kilogramos").formatted).toBe("2 kilogramos");
    expect(engine.evaluate("1 kilogramo").formatted).toBe("1 kilogramo");
    // The clipping `units.ts` already carried, and the word Spanish actually
    // says at a market stall. It reads as `kg` and prints as the full noun.
    expect(engine.evaluate("2 kilos").formatted).toBe("2 kilogramos");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural —
    // "1,5 kilogramos", not a genitive singular the way Ukrainian would.
    expect(engine.evaluate("1 kg + 500 g").formatted).toBe("1,5 kilogramos");
    // A conversion, written with `en`, over the imperial pound.
    expect(engine.evaluate("2 libras en gramos").formatted).toBe("907,1847 gramos");
    // Latin input still reads: a Spanish keyboard produces "gramos", a Spanish
    // developer types "g", and both are the same unit. Spanish groups with "."
    // (Spain's CLDR default, which the bare `es` tag resolves to) and the
    // engine groups uniformly every three digits.
    expect(engine.evaluate("2000 g").formatted).toBe("2.000 gramos");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the
    // one interesting difference between the two: Ukrainian groups with U+00A0
    // and the lexer does not accept that separator on the way back in, while
    // Spanish groups with "." and it does.
    for (const input of [
      "1 kg + 500 g",
      "2 libras en gramos",
      "3 onzas",
      "1,5 toneladas",
      "2000 g",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
