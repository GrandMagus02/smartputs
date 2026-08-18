import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaIt from "./it";

const it = composeLocale(italian, [areaIt]);
const engine = createEngine({ locales: [it], kinds: [area] });

/**
 * The two keys `italian.selectForm` can return. Written out rather than derived
 * so that a language that stopped folding CLDR's `many` into `other` would fail
 * *here*, on a list somebody has to read, instead of silently leaving every
 * table below a row short.
 */
const KEYS = ["one", "other"];

/** The three units whose Italian names are phrases, and therefore have no `forms`. */
const WORDLESS = ["m2", "cm2", "km2"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = italian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Italian word", () => {
    // Italian shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses — and it cannot be `es`'s
    // orthography test either, because neither Italian noun here carries a
    // diacritic: Italian writes a stress mark only on a final vowel, and both
    // `ettaro` and `acro` are stressed earlier. So the check is the noun list
    // itself, in both numbers, plus the superscripts. `hectare` and `acre` are
    // unit **ids** and stay in the descriptor, which is why the Italian `acro`
    // is matched with word boundaries rather than as a substring.
    expect(JSON.stringify(area)).not.toMatch(/ettar[oi]|\bacr[oi]\b|²/i);
  });

  test("every unit that has words at all carries exactly the key set", () => {
    // Rule 6: no more keys and no fewer. The three squared units are the
    // deliberate exception and are asserted below rather than skipped quietly.
    for (const [unit, words] of Object.entries(areaIt.units)) {
      if (WORDLESS.includes(unit)) continue;
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
            kind: "area",
            unit: "hectare",
            slot,
          }),
        );
      }
      seen.add(italian.selectForm({ kind: "area", unit: "hectare", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("the squared units have no forms and no Italian alias", () => {
    // "metro quadrato" is a phrase, and `lex` ends a word token at the space, so
    // no single analyzer is ever handed it: a two-word alias is unreachable by
    // the index that would have to hold it, and a two-word form would be text
    // the printer emits and the parser refuses. Italian has no one-word
    // colloquial name to fall back on, so the superscript symbol is the whole of
    // what these three read and print — which is what an Italian reader writes
    // anyway.
    for (const unit of WORDLESS) {
      expect(areaIt.units[unit]?.forms, unit).toBeUndefined();
      for (const alias of areaIt.units[unit]?.aliases ?? []) {
        expect(alias, unit).not.toMatch(/\s/u);
      }
    }
    expect(areaIt.units.m2?.symbol).toBe("m²");
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone. It matters more in Italian than in Spanish: a Spanish
    // plural adds `-s` and the language's stripper takes it off again, while an
    // Italian plural *substitutes* the final vowel, so `it.ts` can only reach
    // "ettaro" from "ettari" through a substitution table at `weight: -2`. A
    // printed word left to that path is a word this file guessed rather than
    // declared.
    for (const [unit, words] of Object.entries(areaIt.units)) {
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
    for (const [unit, words] of Object.entries(areaIt.units)) {
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
    expect(() => assertLocaleContract(it, [area])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Italian spells both
    // with the same row — that is the claim being tested, and it is a claim, not
    // a tautology: Ukrainian's fractional row is a *different* word from its
    // plural, so a language that gets this wrong is one this sweep is the only
    // thing to catch.
    assertLocaleContract(it, [area], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("hectare", 1)).toBe("ettaro");
    expect(word("hectare", 0)).toBe("ettari");
    expect(word("hectare", 1.5)).toBe("ettari");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this because "в" governs the locative; Italian reuses `other`,
    // since its nouns do not decline and "in ettari" is the same word as "5
    // ettari".
    expect(word("hectare", undefined, "conversion-target")).toBe("ettari");
    expect(word("hectare", 5, "conversion-target")).toBe(
      word("hectare", 5, "after-number"),
    );
    // The million, the row CLDR files under `many` and `italian.selectForm`
    // folds into `other`.
    expect(word("acre", 1e6)).toBe("acri");
    // `ettaro` is masculine in Italian where Spanish's `hectárea` is feminine —
    // which changes the article and nothing about the two rows, because gender
    // lives on the noun and selects nothing (rule 6).
    expect(word("acre", 1)).toBe("acro");
  });

  test("an engine built from it reads and writes Italian area", () => {
    expect(engine.evaluate("2 ettari").formatted).toBe("2 ettari");
    expect(engine.evaluate("1 ettaro").formatted).toBe("1 ettaro");
    // Italian welds its cardinals into one word, and `italian.numerals` reads
    // them back out.
    expect(engine.evaluate("due ettari").formatted).toBe("2 ettari");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural.
    expect(engine.evaluate("1 ha + 5000 m2").formatted).toBe("1,5 ettari");
    // The squared units render through the symbol branch — number and symbol
    // with no space, exactly as `en`, `uk` and `es` render them — and Italian
    // groups with ".".
    expect(engine.evaluate("1 ettaro in m2").formatted).toBe("10.000 m²");
    expect(engine.evaluate("10000 m2 in ettari").formatted).toBe("1 ettaro");
    // The English spellings still read, and print back in Italian.
    expect(engine.evaluate("3 acres").formatted).toBe("3 acri");
    expect(engine.evaluate("3 acri").formatted).toBe("3 acri");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while Italian
    // groups with "." and it does.
    for (const input of [
      "1 ha + 5000 m2",
      "1 ettaro in m2",
      "3 acri",
      "2 km²",
      "10000 m2 in ettari",
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
