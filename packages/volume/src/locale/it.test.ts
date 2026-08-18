import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeIt from "./it";

const it = composeLocale(italian, [volumeIt]);
const engine = createEngine({ locales: [it], kinds: [volume] });

/**
 * The two keys `italian.selectForm` can return. Written out rather than derived
 * so that a language that stopped folding CLDR's `many` into `other` would fail
 * *here*, on a list somebody has to read, instead of silently leaving every
 * table below a row short.
 */
const KEYS = ["one", "other"];

/** The one unit whose Italian name is a phrase, and therefore has no `forms`. */
const WORDLESS = ["m3"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = italian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeIt.units)) {
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
    // both numbers — which is enough to separate it from the English aliases,
    // since "litre" and "litri" differ in the very letter the plural changes.
    expect(JSON.stringify(volume)).not.toMatch(/litr[oi]|gallon[ei]|pint[ae]|³/i);
  });

  test("every unit that has words at all carries exactly the key set", () => {
    // Rule 6: no more keys and no fewer. The cubic metre is the deliberate
    // exception and is asserted below rather than skipped quietly.
    for (const [unit, words] of Object.entries(volumeIt.units)) {
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
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
      seen.add(italian.selectForm({ kind: "volume", unit: "l", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("the cubic metre has no forms and no Italian alias", () => {
    // "metro cubo" is a phrase, and `lex` ends a word token at the space, so no
    // single analyzer is ever handed it: a two-word alias is unreachable by the
    // index that would have to hold it, and a two-word form would be text the
    // printer emits and the parser refuses. Italian has no one-word colloquial
    // name to fall back on the way Ukrainian has "кубометр", so `m³` is the
    // whole of what this unit reads and prints.
    for (const unit of WORDLESS) {
      expect(volumeIt.units[unit]?.forms, unit).toBeUndefined();
      for (const alias of volumeIt.units[unit]?.aliases ?? []) {
        expect(alias, unit).not.toMatch(/\s/u);
      }
    }
    expect(volumeIt.units.m3?.symbol).toBe("m³");
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone. It matters more in Italian than in Spanish: a Spanish
    // plural adds `-s` and the language's stripper takes it off again, while an
    // Italian plural *substitutes* the final vowel, so `it.ts` can only reach
    // "gallone" from "galloni" through a substitution table at `weight: -2`. A
    // printed word left to that path is a word this file guessed rather than
    // declared.
    for (const [unit, words] of Object.entries(volumeIt.units)) {
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
    for (const [unit, words] of Object.entries(volumeIt.units)) {
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
    expect(() => assertLocaleContract(it, [volume])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Italian spells both
    // with the same row — that is the claim being tested, and it is a claim, not
    // a tautology: Ukrainian's fractional row is a *different* word from its
    // plural, so a language that gets this wrong is one this sweep is the only
    // thing to catch.
    assertLocaleContract(it, [volume], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("l", 1)).toBe("litro");
    expect(word("l", 0)).toBe("litri");
    expect(word("l", 1.5)).toBe("litri");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this because "в" governs the locative; Italian reuses `other`,
    // since its nouns do not decline and "in litri" is the same word as "5
    // litri".
    expect(word("l", undefined, "conversion-target")).toBe("litri");
    expect(word("l", 5, "conversion-target")).toBe(word("l", 5, "after-number"));
    // The million, the row CLDR files under `many` and `italian.selectForm`
    // folds into `other`.
    expect(word("l", 1e6)).toBe("litri");
    // The third declension: `-e → -i`, reaching the same plural vowel as
    // `litro`/`litri` from a different singular.
    expect(word("gal", 1)).toBe("gallone");
    expect(word("gal", 2)).toBe("galloni");
    // The feminine: `-a → -e`, the other of Italian's two ordinary endings.
    expect(word("pint", 1)).toBe("pinta");
    expect(word("pint", 2)).toBe("pinte");
  });

  test("an engine built from it reads and writes Italian volume", () => {
    expect(engine.evaluate("2 litri").formatted).toBe("2 litri");
    expect(engine.evaluate("1 litro").formatted).toBe("1 litro");
    // Italian welds its cardinals into one word, and `italian.numerals` reads
    // them back out.
    expect(engine.evaluate("due litri").formatted).toBe("2 litri");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural.
    expect(engine.evaluate("1 l + 500 ml").formatted).toBe("1,5 litri");
    // A conversion, written with `in` and then with `a` — Italian claims both.
    expect(engine.evaluate("2 galloni in litri").formatted).toBe("7,5708 litri");
    expect(engine.evaluate("2 galloni a litri").formatted).toBe("7,5708 litri");
    // The cubic metre renders through the symbol branch — number and symbol with
    // no space — and reads back through the same symbol.
    expect(engine.evaluate("1 m3 in litri").formatted).toBe("1.000 litri");
    expect(engine.evaluate("2000 litri in m3").formatted).toBe("2 m³");
    // Latin input still reads: an Italian keyboard produces "millilitri", an
    // Italian developer types "ml", and both are the same unit. Italian groups
    // with "." and the engine groups uniformly every three digits.
    expect(engine.evaluate("2000 ml").formatted).toBe("2.000 millilitri");
    expect(engine.evaluate("3 pinte").formatted).toBe("3 pinte");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while Italian
    // groups with "." and it does.
    for (const input of [
      "1 l + 500 ml",
      "2 galloni in litri",
      "3 pinte",
      "1 m3 in litri",
      "2000 ml",
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
