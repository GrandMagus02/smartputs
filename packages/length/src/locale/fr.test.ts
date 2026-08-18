import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthFr from "./fr";

const fr = composeLocale(french, [lengthFr]);
const engine = createEngine({ locales: [fr], kinds: [length] });

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
    kind: "length",
    unit,
    slot,
  });
  return (lengthFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

describe("length fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no French word", () => {
    // French shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no French
    // orthography (the accented vowels and the cedilla, none of which an ASCII
    // unit id can contain), and none of the distinctly French nouns spelled
    // out. `yard` and `mile` are deliberately absent from the second pattern —
    // they are `units.ts`'s own English aliases and finding them would prove
    // nothing about French.
    expect(JSON.stringify(length)).not.toMatch(/[àâäéèêëîïôöùûüÿç]/i);
    expect(JSON.stringify(length)).not.toMatch(/pouce|pied|mètre/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(lengthFr.units)) {
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
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
      seen.add(french.selectForm({ kind: "length", unit: "m", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. `mile`/`miles`
    // is what makes this more than a formality — the printed form is not the
    // French noun the reader is likeliest to type, so it has to be a declared
    // alias in its own right.
    for (const [unit, words] of Object.entries(lengthFr.units)) {
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
    for (const [unit, words] of Object.entries(lengthFr.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("keeps `in` out of the index, as every other language here does", () => {
    // Not for French's own sake — French converts with "en" and "vers", so
    // nothing French would shadow it — but because the alias index is one flat
    // map and `@smartput/datetime`'s accept-gate reads it without a locale.
    expect(lengthFr.units.in?.aliases).not.toContain("in");
    expect(lengthFr.units.in?.aliases).toContain("pouce");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(fr, [length])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so without this sweep the fractional
    // category is never reached at all. For French that is the category the
    // whole language differs from English on: 1,5 selects `one`, not `other`,
    // and a table that had copied English's two columns would still pass every
    // integer row above.
    assertLocaleContract(fr, [length], {
      counts: [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("singular below two, plural from two — the French boundary", () => {
    expect(word("m", 1)).toBe("mètre");
    // The two rows English gets wrong. French writes the singular on zero and
    // on every fraction under two.
    expect(word("m", 0)).toBe("mètre");
    expect(word("m", 1.5)).toBe("mètre");
    expect(word("m", 1.9)).toBe("mètre");
    // ...and the plural from two upwards, fractions included.
    expect(word("m", 2)).toBe("mètres");
    expect(word("m", 2.5)).toBe("mètres");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; French reuses `other`, which is also what French
    // grammar wants: "1 km en mètres" names the target in the plural.
    expect(word("cm", undefined, "conversion-target")).toBe("centimètres");
    // The million, the row CLDR files under `many` and `french.selectForm`
    // folds into `other`: that category governs a compact *scale word* ("2
    // millions"), never the noun beside it.
    expect(word("m", 1e6)).toBe("mètres");
    expect(word("in", 1)).toBe("pouce");
    expect(word("in", 2)).toBe("pouces");
  });

  test("an engine built from it reads and writes French length", () => {
    expect(engine.evaluate("2 mètres").formatted).toBe("2 mètres");
    expect(engine.evaluate("1 mètre").formatted).toBe("1 mètre");
    // The accent-free spelling needs no entry of its own here: British English
    // spells the metric units the French way minus the accent, so "metres" is
    // already in `units.ts` and one string in the index serves both languages.
    expect(engine.evaluate("5 metres").formatted).toBe("5 mètres");
    // Arithmetic landing on a fraction, and the whole French plural rule in one
    // string: the decimal comma comes from CLDR through `numberFormat: "intl"`,
    // and the noun is *singular* because 1,5 < 2. English prints "1.5
    // kilometres" for the same sum.
    expect(engine.evaluate("1 km + 500 m").formatted).toBe("1,5 kilomètre");
    // Two conversions, written with `en` — French's own conversion keyword,
    // which happens to be spelled like English's.
    expect(engine.evaluate("12 pouces en centimètres").formatted).toBe(
      "30,48 centimètres",
    );
    expect(engine.evaluate("2 milles en kilomètres").formatted).toBe("3,2187 kilomètres");
    // Borrowed intact, so both numbers arrive from `units.ts`.
    expect(engine.evaluate("6 yards").formatted).toBe("6 yards");
  });

  test("the mile reads as `milles` and prints as `mile`, and the bare `mille` is a number", () => {
    // The plural is unambiguous — the numeral `mille` is invariable, so French
    // never writes "deux milles" for 2000 — and it is what this vocabulary
    // declares.
    expect(engine.evaluate("3 milles").formatted).toBe("3 miles");
    // The singular is not, and the numeral fold gets there first: `mille` is in
    // `fr-cardinals.ts`'s `scales` table, so "1 mille" is the number 1000 and no
    // alias could outrank it. Pinned rather than avoided — the day `lex` learns
    // to prefer a unit reading after a count, this assertion is what says so.
    expect(engine.evaluate("1 mille").value.kind).toBe("number");
    expect(engine.evaluate("1 mille").value.canonical.toString()).toBe("1000");
    // The printed form, which is the borrowed spelling and reads back as itself.
    expect(engine.evaluate("1 mile").formatted).toBe("1 mile");
    expect(engine.evaluate("2 miles").formatted).toBe("2 miles");
  });

  test("groups with U+202F, and reads its own grouped output back", () => {
    // The separator this runtime's CLDR data hands French, pinned by codepoint.
    // Ukrainian groups with U+00A0 and made the point that a whitespace
    // separator has to survive its own round trip; French adds that the
    // character is a *different* invisible space, so an implementation that had
    // hardcoded the non-breaking space would pass every Ukrainian test and lose
    // every French group.
    const grouped = engine.evaluate("2000 m").formatted;
    expect(grouped).toBe(`2${NNBSP}000 mètres`);
    // And the round trip that separator has to survive: `normalize()` folds
    // U+202F to a plain space before `lex` sees it, and `lex`'s three-digit
    // lookahead is what keeps "2 000 mètres" one number instead of two.
    expect(engine.evaluate(grouped).value.canonical.toString()).toBe("2000");
    expect(engine.evaluate("2 000 mètres").value.canonical.toString()).toBe("2000");
  });

  test("its own output reads back to the same value, grouping included", () => {
    for (const input of [
      "1 km + 500 m",
      "12 pouces en centimètres",
      "3 pieds",
      "1,5 kilomètre",
      "2000 m",
      "3 milles",
      "0 mètre",
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
