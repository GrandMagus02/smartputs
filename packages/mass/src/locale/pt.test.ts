import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massPt from "./pt";

const pt = composeLocale(portuguese, [massPt]);
const engine = createEngine({ locales: [pt], kinds: [mass] });

/**
 * The two keys `portuguese.selectForm` can return. Written out rather than
 * derived so that a language that grew a third category would fail *here*, on a
 * list somebody has to read, instead of silently leaving every table below a row
 * short. CLDR does give Portuguese a third — `many`, for whole multiples of a
 * million — and the language folds it into `other`; a `many` row here would be a
 * word no count could ever select.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Portuguese word", () => {
    // Portuguese shares its script with the kind's own unit ids, so this cannot
    // be the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Portuguese orthography (the accented vowels, `ã`/`õ` and `ç`, none of
    // which an ASCII unit id can contain), and none of the six nouns spelled
    // out. `kilogram` and `kilos` stay — they are `units.ts`'s English — and it
    // is the `qu` spellings that must be absent.
    expect(JSON.stringify(mass)).not.toMatch(/[áàâãéêíóôõúüç]/i);
    expect(JSON.stringify(mass)).not.toMatch(/gramas|quilo|tonelada|on[çc]as?|libra/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(massPt.units)) {
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
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
      seen.add(portuguese.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared.
    for (const [unit, words] of Object.entries(massPt.units)) {
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
    for (const [unit, words] of Object.entries(massPt.units)) {
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
    expect(() => assertLocaleContract(pt, [mass])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so a fraction is never sampled at
    // all — and in Portuguese the fractional row is the interesting one, because
    // it is not the plural: `Intl.PluralRules("pt")` puts 1,5 in `one`. A
    // vocabulary that shipped only an `other` row would pass the default sweep
    // and print nothing for "1,5 quilograma".
    assertLocaleContract(pt, [mass], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one covers 0 and 1,5 as well as 1", () => {
    expect(word("kg", 1)).toBe("quilograma");
    expect(word("kg", 2)).toBe("quilogramas");
    // CLDR's Portuguese rule is `i = 0..1`, so zero is singular: "0 grama".
    expect(word("g", 0)).toBe("grama");
    // And so is a fraction — "1,5 quilograma", the opposite of English.
    expect(word("kg", 1.5)).toBe("quilograma");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this; Portuguese has no case, so "em gramas" is spelled like any
    // other plural and reuses `other`.
    expect(word("g", undefined, "conversion-target")).toBe("gramas");
    // The million, the row CLDR files under `many` and `portuguese.selectForm`
    // folds into `other`: "um milhão de gramas" is the compact register this
    // engine never prints, and in full digits it is an ordinary plural.
    expect(word("g", 1e6)).toBe("gramas");
    // The feminine nouns take the same two rows as the masculine ones, because
    // gender lives on the noun and not on the slot. What it would change is the
    // numeral in front ("uma libra"), which no `forms` key can reach.
    expect(word("lb", 1)).toBe("libra");
    expect(word("lb", 2)).toBe("libras");
  });

  test("an engine built from it reads and writes Portuguese mass", () => {
    expect(engine.evaluate("2 quilogramas").formatted).toBe("2 quilogramas");
    expect(engine.evaluate("1 quilograma").formatted).toBe("1 quilograma");
    // The clipping Portuguese spells with a `qu`, which `units.ts` does not
    // carry — it has only English's `kilo`. Both read, and both print as the
    // full noun.
    expect(engine.evaluate("2 quilos").formatted).toBe("2 quilogramas");
    expect(engine.evaluate("2 kilos").formatted).toBe("2 quilogramas");
    // A sum landing on a fraction: the decimal comma comes from CLDR through
    // `numberFormat: "intl"`, and the noun goes *singular* — "1,5 quilograma" —
    // which is the whole difference from `en` and `es` next door.
    expect(engine.evaluate("1 kg + 500 g").formatted).toBe("1,5 quilograma");
    // A conversion, written with `em`, over the imperial pound.
    expect(engine.evaluate("2 libras em gramas").formatted).toBe("907,1847 gramas");
    // `para` is the second spelling of the same keyword, and the cedilla's
    // accent-free twin reads on the way in.
    expect(engine.evaluate("16 oncas para libras").formatted).toBe("1 libra");
    // Latin input still reads: a Brazilian keyboard produces "gramas", a
    // Brazilian developer types "g", and both are the same unit. Portuguese
    // groups with "." and the engine groups uniformly every three digits.
    expect(engine.evaluate("2000 g").formatted).toBe("2.000 gramas");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while
    // Portuguese groups with "." and it does.
    for (const input of [
      "1 kg + 500 g",
      "2 libras em gramas",
      "3 onças",
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
