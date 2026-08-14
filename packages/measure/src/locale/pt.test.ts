import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measurePt from "./pt";

const pt = composeLocale(portuguese, [measurePt]);
const engine = createEngine({ locales: [pt], kinds: [measure] });

/**
 * The two keys `portuguese.selectForm` can return. Written out rather than
 * derived so that a language that grew a third category would fail *here*, on a
 * list somebody has to read, instead of silently leaving every table below a row
 * short. CLDR does give Portuguese a third — `many`, for whole multiples of a
 * million — and the language folds it into `other`.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measurePt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measurePt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measurePt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Portuguese word", () => {
    // Portuguese shares its script with the kind's own unit ids, so this cannot
    // be the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Portuguese orthography (the accented vowels, `ã`/`õ` and `ç`, none of
    // which an ASCII unit id can contain), and none of the Portuguese-only nouns
    // spelled out. `pixel`/`pixels` are *not* in this list on purpose: they are
    // `units.ts`'s English aliases and they are also the Brazilian words, which
    // is why this vocabulary prints them without declaring them.
    expect(JSON.stringify(measure)).not.toMatch(/[áàâãéêíóôõúüç]/i);
    expect(JSON.stringify(measure)).not.toMatch(/polegada|pontos|paica|milimetros/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(measurePt.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
    }
    // ...and the list above is the whole of what the language can ask for,
    // swept over the counts that separate CLDR's Portuguese categories: 0 and 1
    // are `one` (the rule is `i = 0..1`), 1e6 is `many` before
    // `portuguese.selectForm` folds it, and the rest are `other`.
    const seen = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1e6]) {
        seen.add(
          portuguese.selectForm({
            count: new Decimal(count),
            kind: "measure",
            unit: "pt",
            slot,
          }),
        );
      }
      seen.add(portuguese.selectForm({ kind: "measure", unit: "pt", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared.
    for (const [unit, words] of Object.entries(measurePt.units)) {
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
    for (const [unit, words] of Object.entries(measurePt.units)) {
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
    expect(() => assertLocaleContract(pt, [measure])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so a fraction is never sampled at
    // all — and in Portuguese the fractional row is the interesting one, because
    // it is not the plural: `Intl.PluralRules("pt")` puts 1,5 in `one`. This
    // kind is where that matters most, since typographic arithmetic lands on a
    // fraction almost every time.
    assertLocaleContract(pt, [measure], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one covers 0 and 1,5 as well as 1", () => {
    expect(word("pt", 1)).toBe("ponto");
    expect(word("pt", 2)).toBe("pontos");
    // CLDR's Portuguese rule is `i = 0..1`, so zero is singular: "0 ponto".
    expect(word("pt", 0)).toBe("ponto");
    // And so is a fraction — "1,5 ponto", the opposite of English. Any value
    // under 1 lands here too, which is what the subtraction below turns on.
    expect(word("pt", 1.5)).toBe("ponto");
    expect(word("inch", 0.5)).toBe("polegada");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this; Portuguese has no case, so "em pontos" is spelled like any
    // other plural and reuses `other`.
    expect(word("pt", undefined, "conversion-target")).toBe("pontos");
    // The million, the row CLDR files under `many` and `portuguese.selectForm`
    // folds into `other`.
    expect(word("px", 1e6)).toBe("pixels");
    expect(word("px", 1)).toBe("pixel");
  });

  test("an engine built from it reads and writes Portuguese typography", () => {
    expect(engine.evaluate("1 polegada em pontos").formatted).toBe("72 pontos");
    expect(engine.evaluate("72 pontos para polegadas").formatted).toBe("1 polegada");
    // `px` is the one dynamic ratio in the repo, and the default 96 dpi reaches
    // Portuguese exactly as it reaches every other language: through the kind.
    expect(engine.evaluate("1 polegada em pixels").formatted).toBe("96 pixels");
    // The European spelling of the same loanword, and its accent-free twin.
    // Both read; Brazil's `pixels` is what prints.
    expect(engine.evaluate("3 píxeis").formatted).toBe("3 pixels");
    expect(engine.evaluate("3 pixeis").formatted).toBe("3 pixels");
    // The Brazilian name for the twelve-point measure, beside the international
    // one `units.ts` already carries.
    expect(engine.evaluate("2 paicas").formatted).toBe("2 paicas");
    expect(engine.evaluate("2 picas").formatted).toBe("2 paicas");
    // Latin aliases still read: a designer types `pc` whatever the keyboard is.
    expect(engine.evaluate("6 pc em polegadas").formatted).toBe("1 polegada");
    // A subtraction landing on a repeating fraction — and the row this kind
    // exists to pin. The decimal comma comes from CLDR through
    // `numberFormat: "intl"`, and because the integer part is 0 the noun goes
    // *singular*: "polegada", where English writes "inches" and Spanish
    // "pulgadas".
    expect(engine.evaluate("1 polegada - 12 pontos").formatted).toBe(
      "0,83333333333333333333333333 polegada",
    );
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 polegada em pontos",
      "1 polegada em pixels",
      "6 pc em polegadas",
      "2 picas",
      "1,5 milímetros",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
