import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureIt from "./it";

const it = composeLocale(italian, [measureIt]);
const engine = createEngine({ locales: [it], kinds: [measure] });

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
    kind: "measure",
    unit,
    slot,
  });
  return (measureIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureIt.units)) {
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
    // word boundaries on the short ones, because the kind's own `typical` band
    // map and unit ids contain those letters.
    //
    // `pixel` is on the list for completeness rather than for evidence: Italian
    // borrows it unchanged, so its absence from the descriptor says the same
    // thing English's does. The rows that carry the weight are the four whose
    // Italian spelling no English alias could produce.
    expect(JSON.stringify(measure)).not.toMatch(/pollic[ei]|\bpunt[oi]\b/i);
    expect(JSON.stringify(measure)).not.toMatch(/\bpiche\b|\bpixel\b|millimetr[oi]/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer — `pixel` included, whose two rows hold
    // the same string because the noun is invariant. Ukrainian next door needs
    // eight keys here because it composes a case with a plural category; Italian
    // composes nothing, so a third row would be a word no count could select.
    for (const [unit, words] of Object.entries(measureIt.units)) {
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
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
      seen.add(italian.selectForm({ kind: "measure", unit: "px", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone. `piche` is what makes it more than a formality: an
    // Italian plural *substitutes* the final vowel rather than adding to it, and
    // the feminine velar class writes an `h` in to keep the `c` hard, so the
    // fold table in `it.ts` — which carries `chi → co` and `ghi → go` for the
    // masculine velars and no `che → ca` row at all — cannot reach `pica` from
    // it at any weight.
    for (const [unit, words] of Object.entries(measureIt.units)) {
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
    for (const [unit, words] of Object.entries(measureIt.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("the typographic symbols stay Latin and the inch gets its noun", () => {
    // `pt`, `pc` and `px` are what an Italian designer writes in a stylesheet;
    // inventing `pnt` would be a word this file made up. The inch has no Italian
    // abbreviation at all, and the English one is `in` — which is Italian's own
    // conversion keyword besides, so `lex` emits a keyword token for it and no
    // alias index could claim it. The noun is the only honest symbol.
    expect(measureIt.units.pt?.symbol).toBe("pt");
    expect(measureIt.units.pc?.symbol).toBe("pc");
    expect(measureIt.units.px?.symbol).toBe("px");
    expect(measureIt.units.inch?.symbol).toBe("pollice");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(it, [measure])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Italian spells both
    // with the same row — that is the claim being tested, and it is a claim, not
    // a tautology: Ukrainian's fractional row is a *different* word from its
    // plural, so a language that gets this wrong is one this sweep is the only
    // thing to catch.
    assertLocaleContract(it, [measure], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("pt", 1)).toBe("punto");
    expect(word("pt", 0)).toBe("punti");
    expect(word("pt", 1.5)).toBe("punti");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this because "в" governs the locative; Italian reuses `other`,
    // since its nouns do not decline and "in punti" is the same word as "72
    // punti".
    expect(word("pt", undefined, "conversion-target")).toBe("punti");
    expect(word("pt", 5, "conversion-target")).toBe(word("pt", 5, "after-number"));
    // The million, the row CLDR files under `many` and `italian.selectForm`
    // folds into `other`.
    expect(word("px", 1e6)).toBe("pixel");
    // The invariant loanword: a consonant-final borrowing has no vowel to
    // substitute, so both rows hold one string — "due pixel", never "due
    // pixeli". Spanish needs `píxel`/`píxeles` and an accent that moves.
    expect(word("px", 1)).toBe("pixel");
    expect(word("px", 2)).toBe("pixel");
    // The feminine velar class, where Italian writes an `h` to keep the `c`
    // hard in front of the plural `-e`, exactly as `amica` → `amiche`.
    expect(word("pc", 1)).toBe("pica");
    expect(word("pc", 2)).toBe("piche");
    // The third declension: `-e → -i`, a different singular reaching the same
    // plural vowel as `punto`/`punti`.
    expect(word("inch", 1)).toBe("pollice");
    expect(word("inch", 2)).toBe("pollici");
  });

  test("an engine built from it reads and writes Italian typography", () => {
    expect(engine.evaluate("1 pollice in punti").formatted).toBe("72 punti");
    expect(engine.evaluate("72 punti in pollici").formatted).toBe("1 pollice");
    // …and the same conversion written with `a`, the other half of Italian's
    // "da … a …", which `italian.keywords.in` also claims.
    expect(engine.evaluate("1 pollice a punti").formatted).toBe("72 punti");
    // `px` is the one dynamic ratio in the repo, and the default 96 dpi reaches
    // Italian exactly as it reaches every other language: through the kind. The
    // noun does not move between 1 and 96, which is the invariance in print.
    expect(engine.evaluate("1 pollice in pixel").formatted).toBe("96 pixel");
    expect(engine.evaluate("1 pixel").formatted).toBe("1 pixel");
    // Italian welds its cardinals into one word, and `italian.numerals` reads
    // them back out: "settantadue" is 72, one token and no spaces.
    expect(engine.evaluate("settantadue punti in pollici").formatted).toBe("1 pollice");
    // Latin aliases still read: a designer types `pc` whatever the keyboard is,
    // and the Italian plural prints.
    expect(engine.evaluate("6 pc in pollici").formatted).toBe("1 pollice");
    expect(engine.evaluate("2 piche").formatted).toBe("2 piche");
    // A subtraction landing on a repeating fraction: the decimal comma comes
    // from CLDR through `numberFormat: "intl"`, and the noun stays the plain
    // plural — Ukrainian would need a genitive singular here.
    expect(engine.evaluate("1 pollice - 12 punti").formatted).toBe(
      "0,83333333333333333333333333 pollici",
    );
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 pollice in punti",
      "1 pollice in pixel",
      "6 pc in pollici",
      "2 piche",
      "1,5 millimetri",
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
