import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureFr from "./fr";

const fr = composeLocale(french, [measureFr]);
const engine = createEngine({ locales: [fr], kinds: [measure] });

/**
 * The two keys `french.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short — a live possibility for French rather than a hypothetical one:
 * `Intl.PluralRules("fr")` declares three categories and `fr.ts` folds the
 * third away on purpose.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = french.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

describe("measure fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no French word", () => {
    // French shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no French
    // orthography (the accented vowels and the cedilla, none of which an ASCII
    // unit id can contain), and neither of the two nouns French does not share
    // with English. `point`, `pica` and `pixel` are deliberately absent from the
    // second pattern — they are `units.ts`'s own English aliases, and finding
    // them there would prove nothing about French.
    expect(JSON.stringify(measure)).not.toMatch(/[àâäéèêëîïôöùûüÿç]/i);
    expect(JSON.stringify(measure)).not.toMatch(/pouce|mètre/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(measureFr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
    }
    // ...and the list above is the whole of what the language can ask for,
    // swept over the counts that separate French's categories: 0, 1 and every
    // fraction below two are `one`, 1e6 is CLDR's `many` before
    // `french.selectForm` folds it into `other`, and the rest are `other`.
    const seen = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000, 1e6]) {
        seen.add(
          french.selectForm({
            count: new Decimal(count),
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
      seen.add(french.selectForm({ kind: "measure", unit: "px", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. The three
    // accented metric nouns are what make this more than a formality — NFKC
    // leaves a precomposed `è` alone, so an accented printed form has to be a
    // declared alias in its own right.
    for (const [unit, words] of Object.entries(measureFr.units)) {
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
    for (const [unit, words] of Object.entries(measureFr.units)) {
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
    expect(() => assertLocaleContract(fr, [measure])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so without this sweep the fractional
    // category is never reached at all. For French that is the category the
    // whole language differs from English on: 1,5 selects `one`, not `other`,
    // and a table that had copied English's two columns would still pass every
    // integer row above. It matters more in this kind than in any other here:
    // a pixel is 1/96 of an inch, so almost every conversion out of `px` lands
    // on a fraction.
    assertLocaleContract(fr, [measure], {
      counts: [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("singular below two, plural from two — the French boundary", () => {
    expect(word("pt", 1)).toBe("point");
    // The two rows English gets wrong. French writes the singular on zero and
    // on every fraction under two.
    expect(word("pt", 0)).toBe("point");
    expect(word("pt", 1.5)).toBe("point");
    expect(word("pt", 1.9)).toBe("point");
    // ...and the plural from two upwards, fractions included.
    expect(word("pt", 2)).toBe("points");
    expect(word("pt", 2.5)).toBe("points");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; French reuses `other`, which is also what French
    // grammar wants: "1 pouce en points" names the target in the plural.
    expect(word("pt", undefined, "conversion-target")).toBe("points");
    // The million, the row CLDR files under `many` and `french.selectForm`
    // folds into `other`: that category governs a compact *scale word* ("2
    // millions"), never the noun beside it.
    expect(word("px", 1e6)).toBe("pixels");
    expect(word("inch", 1)).toBe("pouce");
    expect(word("inch", 2)).toBe("pouces");
  });

  test("an engine built from it reads and writes French typographic units", () => {
    expect(engine.evaluate("2 pouces").formatted).toBe("2 pouces");
    expect(engine.evaluate("1 pouce").formatted).toBe("1 pouce");
    // The accent-free spellings need no entry of their own: British English
    // spells the metric units the French way minus the grave, so "millimetres"
    // is already in `units.ts` and one string in the index serves both
    // languages.
    expect(engine.evaluate("10 millimetres").formatted).toBe("10 millimètres");
    expect(engine.evaluate("10 millimètres").formatted).toBe("10 millimètres");
    // Two conversions, written with `en` — French's own conversion keyword,
    // which happens to be spelled like English's.
    expect(engine.evaluate("1 pouce en points").formatted).toBe("72 points");
    expect(engine.evaluate("96 px en pouces").formatted).toBe("1 pouce");
    // A fraction below two, which is where French and English part company and
    // which this kind reaches constantly: 1,5 takes the singular noun.
    expect(engine.evaluate("1,5 point").formatted).toBe("1,5 point");
    expect(engine.evaluate("2 picas").formatted).toBe("2 picas");
  });

  test("groups with U+202F, and reads its own grouped output back", () => {
    // The separator this runtime's CLDR data hands French, pinned by codepoint.
    // Ukrainian groups with U+00A0 and made the point that a whitespace
    // separator has to survive its own round trip; French adds that the
    // character is a *different* invisible space, so an implementation that had
    // hardcoded the non-breaking space would pass every Ukrainian test and lose
    // every French group.
    const grouped = engine.evaluate("2000 px").formatted;
    expect(grouped).toBe(`2${NNBSP}000 pixels`);
    // And the round trip that separator has to survive: `normalize()` folds
    // U+202F to a plain space before `lex` sees it, and `lex`'s three-digit
    // lookahead is what keeps "2 000 pixels" one number instead of two.
    expect(engine.evaluate(grouped).value.unit).toBe("px");
    expect(engine.evaluate("2 000 pixels").value.unit).toBe("px");
  });

  test("its own output reads back to the same value, grouping included", () => {
    for (const input of [
      "1 pouce en points",
      "96 px en pouces",
      "1,5 point",
      "2 picas",
      "10 millimètres",
      "2000 px",
      "0 pouce",
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
