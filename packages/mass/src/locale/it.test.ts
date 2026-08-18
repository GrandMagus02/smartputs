import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massIt from "./it";

const it = composeLocale(italian, [massIt]);
const engine = createEngine({ locales: [it], kinds: [mass] });

/**
 * The two keys `italian.selectForm` can return. Written out rather than derived
 * so that a language that stopped folding CLDR's `many` into `other` would fail
 * *here*, on a list somebody has to read, instead of silently leaving every
 * table below a row short.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = italian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Italian word", () => {
    // Italian shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses — and it cannot be `es`'s
    // orthography test either, because not one Italian word in this file carries
    // a diacritic: Italian writes a stress mark only on a final vowel, and every
    // noun here is stressed earlier. So the check is the noun list itself, both
    // numbers of it, since the plural is a different string from the singular in
    // every row.
    expect(JSON.stringify(mass)).not.toMatch(/grammo|grammi|tonnellat[ae]/i);
    expect(JSON.stringify(mass)).not.toMatch(/\boncia\b|\bonce\b|libbr[ae]/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(massIt.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
    }
    // ...and the list above is the whole of what the language can ask for,
    // swept over the counts that separate CLDR's Italian categories: 1 is `one`,
    // 1e6 is `many` before `italian.selectForm` folds it into `other`, and the
    // rest are `other` outright.
    const seen = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1e6]) {
        seen.add(
          italian.selectForm({
            count: new Decimal(count),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
      seen.add(italian.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone. It matters more in Italian than in Spanish: a Spanish
    // plural adds `-s` and the language's stripper takes it off again, while an
    // Italian plural *substitutes* the final vowel, so `it.ts` can only reach
    // "oncia" from "once" through a substitution table at `weight: -2`. A
    // printed word left to that path is a word this file guessed rather than
    // declared.
    for (const [unit, words] of Object.entries(massIt.units)) {
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
    for (const [unit, words] of Object.entries(massIt.units)) {
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
    expect(() => assertLocaleContract(it, [mass])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Italian spells both
    // with the same row — that is the claim being tested, and it is a claim, not
    // a tautology: Ukrainian's fractional row is a *different* word from its
    // plural (genitive singular, "1,5 кілограма"), so a language that gets this
    // wrong is one this sweep is the only thing to catch.
    assertLocaleContract(it, [mass], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("kg", 1)).toBe("chilogrammo");
    expect(word("kg", 0)).toBe("chilogrammi");
    expect(word("kg", 2)).toBe("chilogrammi");
    expect(word("kg", 1.5)).toBe("chilogrammi");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this because "в" governs the locative; Italian reuses `other`,
    // since its nouns do not decline and "in grammi" is the same word as "5
    // grammi".
    expect(word("g", undefined, "conversion-target")).toBe("grammi");
    expect(word("g", 5, "conversion-target")).toBe(word("g", 5, "after-number"));
    // The million, the row CLDR files under `many` and `italian.selectForm`
    // folds into `other`: "un milione di grammi" is the compact register this
    // engine never prints, and in full digits it is an ordinary plural.
    expect(word("g", 1e6)).toBe("grammi");
    // The feminine nouns take the same two rows as the masculine ones, because
    // gender lives on the noun and not on the slot. What it changes is the
    // ending: `-a → -e` here where `chilogrammo` takes `-o → -i`.
    expect(word("t", 1)).toBe("tonnellata");
    expect(word("t", 2)).toBe("tonnellate");
    // The palatal feminine: `-cia` drops its `i` before `-e`, because the `i`
    // was only there to keep the `c` soft and `e` does that itself.
    expect(word("oz", 1)).toBe("oncia");
    expect(word("oz", 5)).toBe("once");
  });

  test("an engine built from it reads and writes Italian mass", () => {
    expect(engine.evaluate("2 chilogrammi").formatted).toBe("2 chilogrammi");
    expect(engine.evaluate("1 chilogrammo").formatted).toBe("1 chilogrammo");
    // The everyday clipping, which is what is actually said at a market stall.
    // It reads as `kg` and prints as the full noun.
    expect(engine.evaluate("2 chili").formatted).toBe("2 chilogrammi");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural —
    // "1,5 chilogrammi", not the genitive singular Ukrainian would need.
    expect(engine.evaluate("1 kg + 500 g").formatted).toBe("1,5 chilogrammi");
    // A conversion over the imperial pound, written with `in`.
    expect(engine.evaluate("2 libbre in grammi").formatted).toBe("907,1847 grammi");
    // …and the same conversion written with `a`, the other half of Italian's
    // "da … a …", which `italian.keywords.in` also claims.
    expect(engine.evaluate("2 libbre a grammi").formatted).toBe("907,1847 grammi");
    // Italian welds its cardinals into one word, and `italian.numerals` reads
    // them: "due" is 2 and "ventidue" is 22, both in front of an ordinary noun.
    expect(engine.evaluate("due chilogrammi").formatted).toBe("2 chilogrammi");
    expect(engine.evaluate("ventidue once").formatted).toBe("22 once");
    // Latin input still reads: an Italian keyboard produces "grammi", an Italian
    // developer types "g", and both are the same unit. Italian groups with "."
    // and the engine groups uniformly every three digits.
    expect(engine.evaluate("2000 g").formatted).toBe("2.000 grammi");
    expect(engine.evaluate("1,5 t").formatted).toBe("1,5 tonnellate");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while Italian
    // groups with "." and it does.
    for (const input of [
      "1 kg + 500 g",
      "2 libbre in grammi",
      "3 once",
      "1,5 tonnellate",
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
