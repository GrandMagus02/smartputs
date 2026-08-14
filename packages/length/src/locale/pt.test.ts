import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthPt from "./pt";

const pt = composeLocale(portuguese, [lengthPt]);
const engine = createEngine({ locales: [pt], kinds: [length] });

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
    kind: "length",
    unit,
    slot,
  });
  return (lengthPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Portuguese word", () => {
    // Portuguese shares its script with the kind's own unit ids, so this cannot
    // be the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Portuguese orthography (the accented vowels, `ã`/`õ` and `ç`, none of
    // which an ASCII unit id can contain), and none of the eight nouns spelled
    // out. The English `meter`/`metre` families stay, of course — they are
    // `units.ts`'s, and the Portuguese `metro` is the string that must be absent.
    expect(JSON.stringify(length)).not.toMatch(/[áàâãéêíóôõúüç]/i);
    expect(JSON.stringify(length)).not.toMatch(
      /metros|quil[oôó]metro|polegada|jarda|milha/i,
    );
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(lengthPt.units)) {
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
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
      seen.add(portuguese.selectForm({ kind: "length", unit: "m", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. `pés` is the row
    // that makes this more than a formality — its stem is one character, below
    // the `minStem: 2` floor `portuguese` sets, so no analyzer in the language
    // can reach it and only the declared alias can.
    for (const [unit, words] of Object.entries(lengthPt.units)) {
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
    for (const [unit, words] of Object.entries(lengthPt.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("the inch keeps `in` out of its aliases", () => {
    // Not because a Portuguese lexer would shadow it — `portuguese`'s
    // conversion keywords are `em` and `para` — but because
    // `registry.aliasIndex` is one flat map with no locale in it, so an entry
    // here would put `in` back in front of `@smartput/datetime`'s accept-gate
    // for any engine that also speaks English.
    expect(lengthPt.units.in?.aliases).not.toContain("in");
    expect(lengthPt.units.in?.aliases).toContain("polegada");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(pt, [length])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so a fraction is never sampled at
    // all — and in Portuguese the fractional row is the interesting one, because
    // it is not the plural: `Intl.PluralRules("pt")` puts 1,5 in `one`. A
    // vocabulary that shipped only an `other` row would pass the default sweep
    // and print nothing for "1,5 metro".
    assertLocaleContract(pt, [length], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one covers 0 and 1,5 as well as 1", () => {
    expect(word("m", 1)).toBe("metro");
    expect(word("m", 2)).toBe("metros");
    // CLDR's Portuguese rule is `i = 0..1`, so zero is singular: "0 metro".
    expect(word("m", 0)).toBe("metro");
    // And so is a fraction — "1,5 metro", the opposite of English.
    expect(word("m", 1.5)).toBe("metro");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this and German a dative; Portuguese has no case, so "em metros"
    // is spelled like any other plural and reuses `other`.
    expect(word("m", undefined, "conversion-target")).toBe("metros");
    // The million, the row CLDR files under `many` and `portuguese.selectForm`
    // folds into `other`.
    expect(word("m", 1e6)).toBe("metros");
    // The feminine nouns take the same two rows as the masculine ones, because
    // gender lives on the noun and not on the slot. What it would change is the
    // numeral in front ("uma polegada"), which no `forms` key can reach.
    expect(word("in", 1)).toBe("polegada");
    expect(word("in", 2)).toBe("polegadas");
  });

  test("an engine built from it reads and writes Portuguese length", () => {
    expect(engine.evaluate("2 metros").formatted).toBe("2 metros");
    expect(engine.evaluate("1 metro").formatted).toBe("1 metro");
    // A conversion, written with `em` — the preposition `portuguese` lists first
    // under `in`. Portuguese groups thousands with "." and the engine groups
    // uniformly every three digits.
    expect(engine.evaluate("2 quilômetros em metros").formatted).toBe("2.000 metros");
    // The European acute reads and prints back as the Brazilian circumflex,
    // which is what the bare `pt` tag means in this repo.
    expect(engine.evaluate("2 quilómetros").formatted).toBe("2 quilômetros");
    // The accent-free spelling a keyboard without dead keys produces. NFKC does
    // not strip the circumflex, so it is a different string to the index and is
    // declared rather than derived.
    expect(engine.evaluate("2 quilometros").formatted).toBe("2 quilômetros");
    // A sum landing on a fraction: the decimal comma comes from CLDR through
    // `numberFormat: "intl"`, and the noun goes *singular* — "1,5 metro" — which
    // is the whole difference from `en` and `es` next door.
    expect(engine.evaluate("1 m + 50 cm").formatted).toBe("1,5 metro");
    // `para` is the second spelling of the same keyword.
    expect(engine.evaluate("1 polegada para milímetros").formatted).toBe(
      "25,4 milímetros",
    );
    // The shortest spelled noun in the language, printed in both numbers.
    expect(engine.evaluate("2 pés em centímetros").formatted).toBe("60,96 centímetros");
    expect(engine.evaluate("1 pé").formatted).toBe("1 pé");
    // Latin input still reads: a Brazilian keyboard produces "metros", a
    // Brazilian developer types "m", and both are the same unit.
    expect(engine.evaluate("3 mi").formatted).toBe("3 milhas");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while
    // Portuguese groups with "." and it does.
    for (const input of [
      "2 quilômetros em metros",
      "1 m + 50 cm",
      "1 polegada para milímetros",
      "2 pés em centímetros",
      "3 milhas",
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
