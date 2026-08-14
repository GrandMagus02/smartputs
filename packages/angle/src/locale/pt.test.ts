import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import anglePt from "./pt";

const pt = composeLocale(portuguese, [anglePt]);
const engine = createEngine({ locales: [pt], kinds: [angle] });

/**
 * The two keys `portuguese.selectForm` can return. Written out rather than
 * derived so that a language that grew a third category would fail *here*, on a
 * list somebody has to read, instead of silently leaving every table below a row
 * short. CLDR does give Portuguese a third — `many`, for whole multiples of a
 * million — and the language folds it into `other`; a `many` row in this
 * vocabulary would be a word no count could ever select.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (anglePt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(anglePt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(anglePt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Portuguese word", () => {
    // Portuguese shares its script with the kind's own unit ids, so this cannot
    // be the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Portuguese orthography (the accented vowels, `ã`/`õ` and `ç`, none of
    // which an ASCII unit id can contain), and none of the four nouns spelled
    // out. "grad" is a unit **id** and stays in the descriptor, so it is the
    // Portuguese "grado"/"grados" that must have left.
    expect(JSON.stringify(angle)).not.toMatch(/[áàâãéêíóôõúüç]/i);
    expect(JSON.stringify(angle)).not.toMatch(/radianos?|graus?|grados|voltas?|°/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(anglePt.units)) {
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
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
      seen.add(portuguese.selectForm({ kind: "angle", unit: "deg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared.
    for (const [unit, words] of Object.entries(anglePt.units)) {
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
    for (const [unit, words] of Object.entries(anglePt.units)) {
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
    expect(() => assertLocaleContract(pt, [angle])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so a fraction is never sampled at
    // all — and in Portuguese the fractional row is the interesting one, because
    // it is not the plural: `Intl.PluralRules("pt")` puts 1,5 in `one`. A
    // vocabulary that shipped only an `other` row would pass the default sweep
    // and print nothing for "1,5 grau".
    assertLocaleContract(pt, [angle], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one covers 0 and 1,5 as well as 1", () => {
    expect(word("deg", 1)).toBe("grau");
    expect(word("deg", 2)).toBe("graus");
    // CLDR's Portuguese rule is `i = 0..1`, so zero is singular: "0 grau".
    expect(word("deg", 0)).toBe("grau");
    // And so is a fraction — "1,5 grau", the opposite of English.
    expect(word("deg", 1.5)).toBe("grau");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Portuguese has no case, so "em graus" is spelled like
    // any other plural and reuses `other`.
    expect(word("deg", undefined, "conversion-target")).toBe("graus");
    // The million, the row CLDR files under `many` and `portuguese.selectForm`
    // folds into `other`: "um milhão de graus" is the compact register this
    // engine never prints, and in full digits it is an ordinary plural.
    expect(word("deg", 1e6)).toBe("graus");
  });

  test("the turn is read by both its names and printed by one", () => {
    expect(engine.evaluate("3 voltas").formatted).toBe("3 voltas");
    expect(engine.evaluate("3 revoluções").formatted).toBe("3 voltas");
    // The unaccented spelling a keyboard without dead keys produces. NFKC folds
    // neither the tilde nor the cedilla away, so it is a different string to the
    // index and is declared rather than derived.
    expect(engine.evaluate("3 revolucoes").formatted).toBe("3 voltas");
    // `rev` rides in from `units.ts` as English's clipping and keeps working.
    expect(engine.evaluate("3 rev").formatted).toBe("3 voltas");
  });

  test("an engine built from it reads and writes Portuguese angle", () => {
    expect(engine.evaluate("2 radianos").formatted).toBe("2 radianos");
    expect(engine.evaluate("1 radiano").formatted).toBe("1 radiano");
    // A conversion, written with `em` — the preposition `portuguese` lists
    // first under `in`. Portuguese groups thousands with "." and the engine
    // groups uniformly every three digits.
    expect(engine.evaluate("10 voltas em graus").formatted).toBe("3.600 graus");
    // `para` is the second spelling of the same keyword and reaches the same
    // reading, which is what a many-to-one keyword table is for.
    expect(engine.evaluate("10 voltas para graus").formatted).toBe("3.600 graus");
    // A sum landing on a fraction: the decimal comma comes from CLDR through
    // `numberFormat: "intl"`, and the noun goes *singular* — "1,5 grau" — which
    // is the whole difference from `en` and `es` next door.
    expect(engine.evaluate("1 grau + 0,5 graus").formatted).toBe("1,5 grau");
    // Latin input still reads: `deg` and `gon` are `units.ts`'s, and `gon` is
    // also the international name Portuguese itself uses.
    expect(engine.evaluate("2 deg").formatted).toBe("2 graus");
    expect(engine.evaluate("1 gon").formatted).toBe("1 grado");
  });

  test("`°` is declared as an alias, and `lex` cannot hand it back yet", () => {
    // The degree sign is the only written short form for an angular degree in
    // any Latin-script language, so it is the honest `symbol` (`uk` and `es`
    // make the same call). It is a declared alias, so `assertLocaleContract` —
    // which consults the alias index — finds it readable, and the day `lex`
    // learns the sign it resolves with no change here. Today it does not: `lex`
    // builds a word token out of a run of letters and the sign is not one, so
    // "90°" loses it silently and reads as a bare number.
    expect(anglePt.units.deg?.aliases).toContain("°");
    expect(engine.evaluate("90°").value.kind).toBe("number");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while
    // Portuguese groups with "." and it does.
    for (const input of [
      "10 voltas em graus",
      // The printed fractional singular, fed back in as itself. The *sum* that
      // produces it is deliberately not in this list: `1 grau + 0,5 graus`
      // rounds `r + r/2` where re-reading the answer rounds `1,5 · r`, and the
      // degree's ratio is a 30-digit literal, so the two differ in the last
      // place — a property of the constant, not of anything this file spells.
      "1,5 grau",
      "2 radianos",
      "1 gon",
      "180 graus",
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
