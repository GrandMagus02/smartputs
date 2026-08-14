import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthEs from "./es";

const es = composeLocale(spanish, [lengthEs]);
const engine = createEngine({ locales: [es], kinds: [length] });

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
    kind: "length",
    unit,
    slot,
  });
  return (lengthEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Spanish word", () => {
    // Spanish shares its script with the kind's own unit ids, so this cannot be
    // the block test `uk` next door uses. Two checks instead: no Spanish
    // orthography (the acute-accented vowels and `ñ`, which no ASCII unit id or
    // English alias can contain), and none of the eight nouns spelled out.
    expect(JSON.stringify(length)).not.toMatch(/[áéíóúüñ]/i);
    expect(JSON.stringify(length)).not.toMatch(/metro|pulgada|pie|yarda|milla/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // can ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(lengthEs.units)) {
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
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
      seen.add(spanish.selectForm({ kind: "length", unit: "m", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural that only the penalised suffix
    // stripper can recover is a word this file guessed rather than declared.
    for (const [unit, words] of Object.entries(lengthEs.units)) {
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
    for (const [unit, words] of Object.entries(lengthEs.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  // `in` is not a Spanish keyword — `spanish.keywords.in` is en/a — so nothing
  // in this language's own lexer would shadow the alias. It is left out because
  // `registry.aliasIndex` is one flat map that `isUnitAlias` reads without a
  // locale, so a Spanish entry for `in` would put it back in front of
  // `@smartput/datetime`'s accept-gate for any engine speaking both languages.
  test("`in` is left to the conversion keyword here too", () => {
    for (const words of Object.values(lengthEs.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthEs.units.in?.aliases).toContain("pulgada");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(es, [length])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Spanish spells both
    // with the same row — that is exactly the claim being tested, and it is a
    // claim, not a tautology: Ukrainian's fractional row is a *different* word
    // from its plural, so a language that gets this wrong is a language this
    // sweep is the only thing to catch.
    assertLocaleContract(es, [length], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("m", 1)).toBe("metro");
    expect(word("m", 0)).toBe("metros");
    expect(word("m", 2)).toBe("metros");
    expect(word("m", 1.5)).toBe("metros");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Spanish reuses `other`, which is the generic category
    // CLDR requires every locale to define.
    expect(word("m", undefined, "conversion-target")).toBe("metros");
    // The million, the row CLDR files under `many` and `spanish.selectForm`
    // folds into `other`. "un millón de metros" is the compact register this
    // engine does not print; in full digits it is an ordinary plural.
    expect(word("m", 1e6)).toBe("metros");
  });

  test("an engine built from it reads and writes Spanish length", () => {
    expect(engine.evaluate("2 metros").formatted).toBe("2 metros");
    expect(engine.evaluate("1 metro").formatted).toBe("1 metro");
    // A conversion, written with either preposition: `en` is the locative one
    // and `a` the directional one, and both are ordinary Spanish here.
    expect(engine.evaluate("3 pies en pulgadas").formatted).toBe("36 pulgadas");
    expect(engine.evaluate("3 pies a pulgadas").formatted).toBe("36 pulgadas");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural.
    expect(engine.evaluate("1 km + 500 m").formatted).toBe("1,5 kilómetros");
    // Latin input still reads: a Spanish keyboard produces "kilómetros", a
    // Spanish developer types "km", and both are the same unit.
    expect(engine.evaluate("2 km").formatted).toBe("2 kilómetros");
    // The accent-free spelling a keyboard without dead keys produces. NFKC
    // does not strip the acute, so this is a different string to the index and
    // is declared rather than derived.
    expect(engine.evaluate("1,5 kilometros").formatted).toBe("1,5 kilómetros");
    // Spanish groups with "." (Spain's CLDR default, which the bare `es` tag
    // resolves to) and the engine groups uniformly every three digits rather
    // than following CLDR's minimumGroupingDigits — see `es.test.ts` in core.
    expect(engine.evaluate("2000 m").formatted).toBe("2.000 metros");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the
    // one interesting difference between the two: Ukrainian groups with U+00A0
    // and the lexer does not accept that separator on the way back in, while
    // Spanish groups with "." and it does.
    for (const input of [
      "1 km + 500 m",
      "3 pies en pulgadas",
      "5 millas",
      "10 cm",
      "1,5 m",
      "2000 m",
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
