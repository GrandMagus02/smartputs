import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeFr from "./fr";

const fr = composeLocale(french, [volumeFr]);
const engine = createEngine({ locales: [fr], kinds: [volume] });

/**
 * The two keys `french.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short — a live possibility for French rather than a hypothetical one:
 * `Intl.PluralRules("fr")` declares three categories and `fr.ts` folds the
 * third away on purpose.
 */
const KEYS = ["one", "other"];

/** The units that have words at all — `m3` prints through its symbol. */
const SPELLED = ["l", "ml", "gal", "pint"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = french.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

describe("volume fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no French word", () => {
    // French shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no French
    // orthography (the accented vowels and the cedilla, none of which an ASCII
    // unit id can contain), and neither the pint's French name nor the two-word
    // wording for `m3`. `litre` and `gallon` are deliberately absent from the
    // second pattern — they are `units.ts`'s own English aliases, and finding
    // them there would prove nothing about French.
    expect(JSON.stringify(volume)).not.toMatch(/[àâäéèêëîïôöùûüÿç]/i);
    expect(JSON.stringify(volume)).not.toMatch(/pinte|cube/i);
  });

  test("only the spelled units carry forms, and they carry exactly the key set", () => {
    // Rule 6: no more keys and no fewer, on the units that have words at all.
    // `m3` has none on purpose — "mètre cube" is two words and `lex` ends a word
    // token at the space — so its absence is the assertion here rather than an
    // exemption from one.
    for (const [unit, words] of Object.entries(volumeFr.units)) {
      if (SPELLED.includes(unit)) {
        expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
      } else {
        expect(words.forms, `${unit} should print through its symbol`).toBeUndefined();
      }
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
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
      seen.add(french.selectForm({ kind: "volume", unit: "l", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. `pinte`/`pintes`
    // is what makes this more than a formality — it is the one pair no borrowing
    // put in the index for free.
    for (const [unit, words] of Object.entries(volumeFr.units)) {
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
    for (const [unit, words] of Object.entries(volumeFr.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("no unit word is a phrase", () => {
    // The rule `assertLocaleContract` states in as many words, restated here on
    // the vocabulary alone because this is a kind where breaking it is tempting:
    // "mètre cube" is the correct French name for `m3` and it can never be a
    // unit word, because `lex` builds a word token out of a run of letters and a
    // space ends it.
    for (const [unit, words] of Object.entries(volumeFr.units)) {
      for (const surface of [...words.aliases, words.symbol ?? ""]) {
        expect(/\s/u.test(surface), `${unit} declares the phrase ${surface}`).toBe(false);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(fr, [volume])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so without this sweep the fractional
    // category is never reached at all. For French that is the category the
    // whole language differs from English on: 1,5 selects `one`, not `other`,
    // and a table that had copied English's two columns would still pass every
    // integer row above.
    assertLocaleContract(fr, [volume], {
      counts: [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("singular below two, plural from two — the French boundary", () => {
    expect(word("l", 1)).toBe("litre");
    // The two rows English gets wrong. French writes the singular on zero and
    // on every fraction under two.
    expect(word("l", 0)).toBe("litre");
    expect(word("l", 1.5)).toBe("litre");
    expect(word("l", 1.9)).toBe("litre");
    // ...and the plural from two upwards, fractions included.
    expect(word("l", 2)).toBe("litres");
    expect(word("l", 2.5)).toBe("litres");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; French reuses `other`, which is also what French
    // grammar wants: "1 gallon en litres" names the target in the plural.
    expect(word("ml", undefined, "conversion-target")).toBe("millilitres");
    // The million, the row CLDR files under `many` and `french.selectForm`
    // folds into `other`: that category governs a compact *scale word* ("2
    // millions"), never the noun beside it.
    expect(word("l", 1e6)).toBe("litres");
    // The feminine noun takes the same two rows as the masculine ones, because
    // gender lives on the noun and not on the slot.
    expect(word("pint", 1)).toBe("pinte");
    expect(word("pint", 2)).toBe("pintes");
  });

  test("an engine built from it reads and writes French volume", () => {
    expect(engine.evaluate("2 litres").formatted).toBe("2 litres");
    expect(engine.evaluate("1 litre").formatted).toBe("1 litre");
    // The one French noun this file had to add, in both numbers.
    expect(engine.evaluate("3 pintes").formatted).toBe("3 pintes");
    expect(engine.evaluate("1 pinte").formatted).toBe("1 pinte");
    // Arithmetic landing on a fraction, and the whole French plural rule in one
    // string: the decimal comma comes from CLDR through `numberFormat: "intl"`,
    // and the noun is *singular* because 1,5 < 2. English prints "1.5 litres"
    // for the same sum.
    expect(engine.evaluate("1 l + 500 ml").formatted).toBe("1,5 litre");
    // A conversion, written with `en` — French's own conversion keyword, which
    // happens to be spelled like English's.
    expect(engine.evaluate("2 gallons en litres").formatted).toBe("7,570823568 litres");
    // The unit with no words at all: `m³` is the whole of what it reads and
    // prints, in French as in every other language here.
    expect(engine.evaluate("2 m3").formatted).toBe("2 m³");
  });

  test("groups with U+202F, and reads its own grouped output back", () => {
    // The separator this runtime's CLDR data hands French, pinned by codepoint.
    // Ukrainian groups with U+00A0 and made the point that a whitespace
    // separator has to survive its own round trip; French adds that the
    // character is a *different* invisible space, so an implementation that had
    // hardcoded the non-breaking space would pass every Ukrainian test and lose
    // every French group.
    const grouped = engine.evaluate("2000 l").formatted;
    expect(grouped).toBe(`2${NNBSP}000 litres`);
    // And the round trip that separator has to survive: `normalize()` folds
    // U+202F to a plain space before `lex` sees it, and `lex`'s three-digit
    // lookahead is what keeps "2 000 litres" one number instead of two.
    expect(engine.evaluate(grouped).value.canonical.toString()).toBe("2000");
    expect(engine.evaluate("2 000 litres").value.canonical.toString()).toBe("2000");
  });

  test("its own output reads back to the same value, grouping included", () => {
    for (const input of [
      "1 l + 500 ml",
      "2 gallons en litres",
      "3 pintes",
      "1,5 litre",
      "2000 l",
      "2 m3",
      "0 litre",
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
