import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massFr from "./fr";

const fr = composeLocale(french, [massFr]);
const engine = createEngine({ locales: [fr], kinds: [mass] });

/**
 * The two keys `french.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short — which is a live possibility for French and not a hypothetical one:
 * `Intl.PluralRules("fr")` declares three categories and `fr.ts` folds the
 * third away on purpose.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = french.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

describe("mass fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no French word", () => {
    // French shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no French
    // orthography (the accented vowels and the cedilla, none of which an ASCII
    // unit id can contain), and none of the six nouns spelled out. "tonne" is
    // deliberately absent from the second pattern — it is `units.ts`'s own
    // English alias and finding it would prove nothing about French.
    expect(JSON.stringify(mass)).not.toMatch(/[àâäéèêëîïôöùûüÿç]/i);
    expect(JSON.stringify(mass)).not.toMatch(/grammes?|once|livre/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(massFr.units)) {
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
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
      seen.add(french.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared.
    for (const [unit, words] of Object.entries(massFr.units)) {
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
    for (const [unit, words] of Object.entries(massFr.units)) {
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
    expect(() => assertLocaleContract(fr, [mass])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so without this sweep the fractional
    // category is never reached at all. For French that is the category the
    // whole language differs from English on: 1,5 selects `one`, not `other`,
    // and a table that had copied English's two columns would still pass every
    // integer row above.
    assertLocaleContract(fr, [mass], {
      counts: [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("singular below two, plural from two — the French boundary", () => {
    expect(word("kg", 1)).toBe("kilogramme");
    // The two rows English gets wrong. French writes the singular on zero and
    // on every fraction under two.
    expect(word("kg", 0)).toBe("kilogramme");
    expect(word("kg", 1.5)).toBe("kilogramme");
    expect(word("kg", 1.9)).toBe("kilogramme");
    // ...and the plural from two upwards, fractions included.
    expect(word("kg", 2)).toBe("kilogrammes");
    expect(word("kg", 2.5)).toBe("kilogrammes");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; French reuses `other`, which is also what French
    // grammar wants: "1 kg en grammes" names the target in the plural.
    expect(word("g", undefined, "conversion-target")).toBe("grammes");
    // The million, the row CLDR files under `many` and `french.selectForm`
    // folds into `other`: that category governs a compact *scale word* ("2
    // millions"), never the noun beside it, and French writes "2 000 000
    // grammes" with the same plural as "2 grammes".
    expect(word("g", 1e6)).toBe("grammes");
    // The feminine nouns take the same two rows as the masculine ones, because
    // gender lives on the noun and not on the slot. What it would change is the
    // numeral in front ("une livre"), which no `forms` key can reach.
    expect(word("lb", 1)).toBe("livre");
    expect(word("lb", 2)).toBe("livres");
  });

  test("an engine built from it reads and writes French mass", () => {
    expect(engine.evaluate("2 kilogrammes").formatted).toBe("2 kilogrammes");
    expect(engine.evaluate("1 kilogramme").formatted).toBe("1 kilogramme");
    // The clipping `units.ts` already carried, and the word French actually
    // says. It reads as `kg` and prints as the full noun.
    expect(engine.evaluate("2 kilos").formatted).toBe("2 kilogrammes");
    // Arithmetic landing on a fraction, and the whole French plural rule in one
    // string: the decimal comma comes from CLDR through `numberFormat: "intl"`,
    // and the noun is *singular* because 1,5 < 2. English prints "1.5
    // kilograms" for the same sum.
    expect(engine.evaluate("1 kg + 500 g").formatted).toBe("1,5 kilogramme");
    // A conversion, written with `en` — French's own conversion keyword, which
    // happens to be spelled like English's.
    expect(engine.evaluate("2 livres en grammes").formatted).toBe("907,1847 grammes");
    // `tonne` is `units.ts`'s English alias and French's own spelling at once,
    // so it reads without this file adding a thing.
    expect(engine.evaluate("2 t").formatted).toBe("2 tonnes");
    expect(engine.evaluate("1,5 tonne").formatted).toBe("1,5 tonne");
  });

  test("groups with U+202F, and reads its own grouped output back", () => {
    // The separator this runtime's CLDR data hands French, pinned by codepoint.
    // Ukrainian groups with U+00A0 and made the point that a whitespace
    // separator has to survive its own round trip; French adds that the
    // character is a *different* invisible space, so an implementation that had
    // hardcoded the non-breaking space would pass every Ukrainian test and lose
    // every French group.
    const grouped = engine.evaluate("2000 g").formatted;
    expect(grouped).toBe(`2${NNBSP}000 grammes`);
    // And the round trip that separator has to survive: `normalize()` folds
    // U+202F to a plain space before `lex` sees it, and `lex`'s three-digit
    // lookahead is what keeps "2 000 grammes" one number instead of two.
    expect(engine.evaluate(grouped).value.canonical.toString()).toBe("2000");
    // The lookahead's other side: a gap that is not three digits wide stays two
    // tokens, so the fold cannot swallow a word boundary.
    expect(engine.evaluate("2 000 grammes").value.canonical.toString()).toBe("2000");
  });

  test("its own output reads back to the same value, grouping included", () => {
    for (const input of [
      "1 kg + 500 g",
      "2 livres en grammes",
      "3 onces",
      "1,5 tonne",
      "2000 g",
      "0 gramme",
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
