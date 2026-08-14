import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleIt from "./it";

const it = composeLocale(italian, [angleIt]);
const engine = createEngine({ locales: [it], kinds: [angle] });

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
    kind: "angle",
    unit,
    slot,
  });
  return (angleIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Italian word", () => {
    // Italian shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses — and it cannot be `es`'s
    // orthography test either, because not one Italian word in this file carries
    // a diacritic: Italian writes a stress mark only on a final vowel, and every
    // noun here is stressed earlier. So the check is the noun list itself, with
    // word boundaries on `grado`/`gradi`, because the kind's own English alias
    // `gradian` contains those five letters and a bare substring test would read
    // it as an Italian word.
    expect(JSON.stringify(angle)).not.toMatch(/\bgrad[oi]\b|radiant[ei]/i);
    expect(JSON.stringify(angle)).not.toMatch(/\bgir[oi]\b|rivoluzion[ei]|°/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer — `gon` included, whose two rows hold
    // the same string. A third row would be a word no count could ever select,
    // and a missing row renders the unit's Latin key at a reader without
    // throwing.
    for (const [unit, words] of Object.entries(angleIt.units)) {
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
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
      seen.add(italian.selectForm({ kind: "angle", unit: "deg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone. It matters more in Italian than in Spanish: a Spanish
    // plural adds `-s` and the language's stripper takes it off again, while an
    // Italian plural *substitutes* the final vowel, so `it.ts` can only reach
    // "radiante" from "radianti" through a substitution table at `weight: -2`. A
    // printed word left to that path is a word this file guessed rather than
    // declared.
    for (const [unit, words] of Object.entries(angleIt.units)) {
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
    for (const [unit, words] of Object.entries(angleIt.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("the gradian is invariant, and that is the language's answer", () => {
    // Italian's own name for this unit is "grado centesimale", two words, which
    // `lex` can never hand to an analyzer as one token. What Italian writes
    // instead is the international `gon` — a loanword ending in a consonant, so
    // it has no final vowel to substitute and takes no plural: "5 gon", never
    // "5 goni". Both rows therefore hold one string, which is the answer rather
    // than an unfinished table, and inventing `goni` to make the two differ
    // would be manufacturing a word Italian does not have.
    expect(word("grad", 1)).toBe("gon");
    expect(word("grad", 5)).toBe("gon");
    expect(angleIt.units.grad?.symbol).toBe("gon");
    for (const alias of angleIt.units.grad?.aliases ?? []) {
      expect(alias, "no invented Italian plural of gon").not.toBe("goni");
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(it, [angle])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Italian spells both
    // with the same row — that is the claim being tested, and it is a claim, not
    // a tautology: Ukrainian's fractional row is a *different* word from its
    // plural, so a language that gets this wrong is one this sweep is the only
    // thing to catch.
    assertLocaleContract(it, [angle], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("deg", 1)).toBe("grado");
    expect(word("deg", 0)).toBe("gradi");
    expect(word("deg", 1.5)).toBe("gradi");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this because "в" governs the locative; Italian reuses `other`,
    // since its nouns do not decline and "in gradi" is the same word as "5
    // gradi".
    expect(word("deg", undefined, "conversion-target")).toBe("gradi");
    expect(word("deg", 5, "conversion-target")).toBe(word("deg", 5, "after-number"));
    // The million, the row CLDR files under `many` and `italian.selectForm`
    // folds into `other`.
    expect(word("deg", 1e6)).toBe("gradi");
    // The third declension, `-e → -i`, beside the ordinary masculine `-o → -i`.
    expect(word("rad", 1)).toBe("radiante");
    expect(word("rad", 2)).toBe("radianti");
    expect(word("turn", 1)).toBe("giro");
    expect(word("turn", 2)).toBe("giri");
  });

  test("an engine built from it reads and writes Italian angle", () => {
    expect(engine.evaluate("2 gradi").formatted).toBe("2 gradi");
    expect(engine.evaluate("1 grado").formatted).toBe("1 grado");
    // A conversion, written with `in` and then with `a` — Italian claims both.
    // A turn is exactly 400 gon in the ratio table, so nothing rounds here.
    expect(engine.evaluate("1 giro in gon").formatted).toBe("400 gon");
    expect(engine.evaluate("1 giro a gon").formatted).toBe("400 gon");
    expect(engine.evaluate("1 giro in gradi").formatted).toBe("360 gradi");
    // Italian welds its cardinals into one word, and `italian.numerals` reads
    // them back out: "novanta" is 90, one token and no spaces.
    expect(engine.evaluate("novanta gradi").formatted).toBe("90 gradi");
    // The technical register beside the everyday one: both read, and `giro` is
    // what prints, because the printer has to pick one.
    expect(engine.evaluate("2 rivoluzioni").formatted).toBe("2 giri");
    // Arithmetic landing on a fraction, across two units: the decimal comma
    // comes from CLDR through `numberFormat: "intl"`, and the noun stays the
    // plain plural — "1,5 giri", not the genitive singular Ukrainian needs.
    expect(engine.evaluate("1 giro + 180 gradi").formatted).toBe("1,5 giri");
    expect(engine.evaluate("2 radianti").formatted).toBe("2 radianti");
  });

  test("`°` is declared as an alias, and `lex` cannot hand it back yet", () => {
    // The degree sign is the only written short form for an angular degree in
    // any Latin-script language, so it is the honest `symbol` (`uk` and `es`
    // make the same call). It is a declared alias, so `assertLocaleContract` —
    // which consults the alias index — finds it readable, and the day `lex`
    // learns the sign it resolves with no change here.
    //
    // Today it does not: `lex` builds a word token out of a run of letters and
    // the sign is not one, so "90°" loses it silently and reads as a bare
    // number. That is a gap in core's lexing rather than in this vocabulary, so
    // it is pinned here instead of being avoided — and it is why a
    // `symbols: true` print is kept out of the round-trip loop below.
    expect(angleIt.units.deg?.aliases).toContain("°");
    expect(engine.evaluate("90°").value.kind).toBe("number");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 giro + 180 gradi",
      "1 giro in gon",
      "2 rivoluzioni",
      "1 giro in gradi",
      "2 radianti",
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
