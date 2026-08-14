import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthIt from "./it";

const it = composeLocale(italian, [lengthIt]);
const engine = createEngine({ locales: [it], kinds: [length] });

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
    kind: "length",
    unit,
    slot,
  });
  return (lengthIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Italian word", () => {
    // Italian shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses — and it cannot be `es`'s
    // orthography test either, because not one Italian word in this file carries
    // a diacritic: Italian writes a stress mark only on a final vowel, and every
    // noun here is stressed earlier. So the check is the noun list itself, in
    // both numbers, with word boundaries where an English alias contains the
    // Italian string as a prefix.
    expect(JSON.stringify(length)).not.toMatch(/\bmetr[oi]\b|chilometr[oi]|pollic[ei]/i);
    expect(JSON.stringify(length)).not.toMatch(/\bpied[ei]\b|\biard[ae]\b|migli[oa]/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(lengthIt.units)) {
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
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
      seen.add(italian.selectForm({ kind: "length", unit: "m", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone. It matters more in Italian than in Spanish: a Spanish
    // plural adds `-s` and the language's stripper takes it off again, while an
    // Italian plural *substitutes* the final vowel, so `it.ts` can only reach
    // "miglio" from "miglia" through a substitution table at `weight: -2`. A
    // printed word left to that path is a word this file guessed rather than
    // declared.
    for (const [unit, words] of Object.entries(lengthIt.units)) {
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
    for (const [unit, words] of Object.entries(lengthIt.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  // `in` is one of Italian's own conversion keywords (`italian.keywords.in` is
  // in/a), so `lex` emits a keyword token for it and no alias index could claim
  // it here anyway. It would stay out regardless, because `registry.aliasIndex`
  // is one flat map that `isUnitAlias` reads without a locale, so an Italian
  // entry for `in` would put it back in front of `@smartput/datetime`'s
  // accept-gate for any engine speaking both languages.
  test("`in` is left to the conversion keyword here too", () => {
    for (const words of Object.values(lengthIt.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthIt.units.in?.aliases).toContain("pollice");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(it, [length])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Italian spells both
    // with the same row — that is the claim being tested, and it is a claim, not
    // a tautology: Ukrainian's fractional row is a *different* word from its
    // plural, so a language that gets this wrong is one this sweep is the only
    // thing to catch.
    assertLocaleContract(it, [length], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("m", 1)).toBe("metro");
    expect(word("m", 0)).toBe("metri");
    expect(word("m", 2)).toBe("metri");
    expect(word("m", 1.5)).toBe("metri");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this because "в" governs the locative; Italian reuses `other`,
    // since its nouns do not decline and "in metri" is the same word as "5
    // metri".
    expect(word("m", undefined, "conversion-target")).toBe("metri");
    expect(word("m", 5, "conversion-target")).toBe(word("m", 5, "after-number"));
    // The million, the row CLDR files under `many` and `italian.selectForm`
    // folds into `other`. "un milione di metri" is the compact register this
    // engine does not print; in full digits it is an ordinary plural.
    expect(word("m", 1e6)).toBe("metri");
    // The third declension: `-e → -i`, a different singular reaching the same
    // plural vowel as `metro`/`metri`.
    expect(word("ft", 1)).toBe("piede");
    expect(word("ft", 2)).toBe("piedi");
    // The irregular class: a masculine singular whose plural is feminine in
    // `-a`, like `paio`/`paia`. Nothing about the singular predicts it.
    expect(word("mi", 1)).toBe("miglio");
    expect(word("mi", 5)).toBe("miglia");
  });

  test("an engine built from it reads and writes Italian length", () => {
    expect(engine.evaluate("2 metri").formatted).toBe("2 metri");
    expect(engine.evaluate("1 metro").formatted).toBe("1 metro");
    // A conversion, written with either preposition: `in` is the one Italian
    // shares spelling with English, and `a` the other half of "da … a …".
    expect(engine.evaluate("3 piedi in pollici").formatted).toBe("36 pollici");
    expect(engine.evaluate("3 piedi a pollici").formatted).toBe("36 pollici");
    // Italian welds its cardinals into one word, and `italian.numerals` reads
    // them back out: "tre" is 3, "ventidue" is 22.
    expect(engine.evaluate("tre piedi in pollici").formatted).toBe("36 pollici");
    expect(engine.evaluate("ventidue metri").formatted).toBe("22 metri");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural.
    expect(engine.evaluate("1 km + 500 m").formatted).toBe("1,5 chilometri");
    // Latin input still reads: an Italian keyboard produces "chilometri", an
    // Italian developer types "km", and both are the same unit. `kilometri` is
    // the technical variant spelling, read and normalised to the official one.
    expect(engine.evaluate("2 km").formatted).toBe("2 chilometri");
    expect(engine.evaluate("1,5 kilometri").formatted).toBe("1,5 chilometri");
    // The irregular plural, end to end.
    expect(engine.evaluate("5 miglia").formatted).toBe("5 miglia");
    // Italian groups with "." and the engine groups uniformly every three
    // digits rather than following CLDR's minimumGroupingDigits.
    expect(engine.evaluate("2000 m").formatted).toBe("2.000 metri");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while Italian
    // groups with "." and it does.
    for (const input of [
      "1 km + 500 m",
      "3 piedi in pollici",
      "5 miglia",
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
