import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleEs from "./es";

const es = composeLocale(spanish, [angleEs]);
const engine = createEngine({ locales: [es], kinds: [angle] });

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
    kind: "angle",
    unit,
    slot,
  });
  return (angleEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Spanish word", () => {
    // Spanish shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Spanish orthography (accented vowels and `ñ`, which no ASCII unit id can
    // contain), and none of the four nouns spelled out.
    expect(JSON.stringify(angle)).not.toMatch(/[áéíóúüñ]/i);
    expect(JSON.stringify(angle)).not.toMatch(/radianes|grados|gradianes|vuelta/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. Ukrainian next door needs eight here
    // because it composes a case with a plural category; Spanish composes
    // nothing, so a third row would be a word no count could ever select.
    for (const [unit, words] of Object.entries(angleEs.units)) {
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
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
      seen.add(spanish.selectForm({ kind: "angle", unit: "deg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. `radián` and
    // `gradián` are what make this more than a formality — their plurals drop
    // the written accent, so no suffix rule reaches one from the other.
    for (const [unit, words] of Object.entries(angleEs.units)) {
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
    for (const [unit, words] of Object.entries(angleEs.units)) {
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
    expect(() => assertLocaleContract(es, [angle])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Spanish spells both
    // with the same row — that is the claim being tested, and it is a claim,
    // not a tautology: Ukrainian's fractional row is a *different* word from
    // its plural, so a language that gets this wrong is one this sweep is the
    // only thing to catch.
    assertLocaleContract(es, [angle], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("deg", 1)).toBe("grado");
    expect(word("deg", 0)).toBe("grados");
    expect(word("deg", 1.5)).toBe("grados");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Spanish reuses `other`, the generic category CLDR
    // requires every locale to define.
    expect(word("deg", undefined, "conversion-target")).toBe("grados");
    // The million, the row CLDR files under `many` and `spanish.selectForm`
    // folds into `other`.
    expect(word("deg", 1e6)).toBe("grados");
    // The accent the singular writes and the plural does not.
    expect(word("rad", 1)).toBe("radián");
    expect(word("rad", 2)).toBe("radianes");
    expect(word("grad", 1)).toBe("gradián");
    expect(word("grad", 2)).toBe("gradianes");
  });

  test("the turn is read by both its names and printed by one", () => {
    // `vuelta` is what a person says and `revolución` what a datasheet says.
    // Both read; the printer has to pick one, and it picks the everyday word.
    expect(engine.evaluate("3 revoluciones").formatted).toBe("3 vueltas");
    expect(engine.evaluate("3 vueltas").formatted).toBe("3 vueltas");
    // `rev` rides in from `units.ts` as English's clipping and keeps working.
    expect(engine.evaluate("3 rev").formatted).toBe("3 vueltas");
  });

  test("an engine built from it reads and writes Spanish angle", () => {
    expect(engine.evaluate("2 radianes").formatted).toBe("2 radianes");
    expect(engine.evaluate("1 radián").formatted).toBe("1 radián");
    // The accent-free spelling: here it needs no entry of its own, because
    // "radian" is already `units.ts`'s English name and one string in the index
    // serves both languages.
    expect(engine.evaluate("1 radian").formatted).toBe("1 radián");
    // A conversion, written with `en`. Spanish groups with "." (Spain's CLDR
    // default, which the bare `es` tag resolves to) and the engine groups
    // uniformly every three digits.
    expect(engine.evaluate("10 vueltas en grados").formatted).toBe("3.600 grados");
    // Arithmetic and reading both landing on a fraction: the decimal comma
    // comes from CLDR through `numberFormat: "intl"`, and the noun stays the
    // plain plural — "1,5 grados", not the genitive singular Ukrainian needs.
    expect(engine.evaluate("1,5 grados").formatted).toBe("1,5 grados");
    // Latin input still reads: `deg` and `gon` are `units.ts`'s, and `gon` is
    // also the international name Spanish itself uses.
    expect(engine.evaluate("2 deg").formatted).toBe("2 grados");
    expect(engine.evaluate("1 gon").formatted).toBe("1 gradián");
  });

  test("`°` is declared as an alias, and `lex` cannot hand it back yet", () => {
    // The degree sign is the only written short form for an angular degree in
    // any Latin-script language, so it is the honest `symbol` (uk makes the
    // same call). It is a declared alias, so `assertLocaleContract` — which
    // consults the alias index — finds it readable, and the day `lex` learns
    // the sign it resolves with no change here.
    //
    // Today it does not: `lex` builds a word token out of a run of letters and
    // the sign is not one, so "90°" loses it silently and reads as a bare
    // number. That is a gap in core's lexing rather than in this vocabulary, so
    // it is pinned here instead of being avoided — and it is why a
    // `symbols: true` print is kept out of the round-trip loop below.
    expect(angleEs.units.deg?.aliases).toContain("°");
    expect(engine.evaluate("90°").value.kind).toBe("number");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the
    // one interesting difference between the two: Ukrainian groups with U+00A0
    // and the lexer does not accept that separator on the way back in, while
    // Spanish groups with "." and it does.
    for (const input of [
      "10 vueltas en grados",
      "1,5 grados",
      "2 radianes",
      "1 gon",
      "180 grados",
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
