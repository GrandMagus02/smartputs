import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumePt from "./pt";

const pt = composeLocale(portuguese, [volumePt]);
const engine = createEngine({ locales: [pt], kinds: [volume] });

/**
 * The two keys `portuguese.selectForm` can return. Written out rather than
 * derived so that a language that grew a third category would fail *here*, on a
 * list somebody has to read, instead of silently leaving every table below a row
 * short. CLDR does give Portuguese a third — `many`, for whole multiples of a
 * million — and the language folds it into `other`.
 */
const KEYS = ["one", "other"];

/** The unit whose Portuguese name is a phrase, and therefore has no `forms`. */
const WORDLESS = "m3";

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumePt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumePt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumePt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Portuguese word", () => {
    // Portuguese shares its script with the kind's own unit ids, so this cannot
    // be the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Portuguese orthography (the accented vowels, `ã`/`õ` and `ç`, none of
    // which an ASCII unit id can contain), and none of the four nouns spelled
    // out. `gal` and `pint` are unit **ids** and stay in the descriptor, so it
    // is the Portuguese spellings that must have left.
    expect(JSON.stringify(volume)).not.toMatch(/[áàâãéêíóôõúüç]/i);
    expect(JSON.stringify(volume)).not.toMatch(/litros?|gal[aã]o|pintas?|quartilho|³/i);
  });

  test("every unit that has words at all carries exactly the key set", () => {
    // Rule 6: no more keys and no fewer. `m3` is the deliberate exception and is
    // asserted below rather than skipped quietly.
    for (const [unit, words] of Object.entries(volumePt.units)) {
      if (unit === WORDLESS) continue;
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
    }
    // ...and the list above is the whole of what the language can ask for,
    // swept over the counts that separate CLDR's Portuguese categories: 0 and 1
    // are `one` (the rule is `i = 0..1`), 1e6 is `many` before
    // `portuguese.selectForm` folds it, and the rest are `other`.
    const seen = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1e6]) {
        seen.add(
          portuguese.selectForm({
            count: new Decimal(count),
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
      seen.add(portuguese.selectForm({ kind: "volume", unit: "l", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("the cubic metre has no forms and no Portuguese alias", () => {
    // "metro cúbico" is a phrase, and `lex` ends a word token at the space, so
    // no single analyzer is ever handed it. Portuguese has no one-word
    // colloquial name to fall back on the way Ukrainian has "кубометр", so the
    // superscript symbol is the whole of what this unit reads and prints.
    expect(volumePt.units[WORDLESS]?.forms).toBeUndefined();
    for (const alias of volumePt.units[WORDLESS]?.aliases ?? []) {
      expect(alias).not.toMatch(/\s/u);
    }
    expect(volumePt.units.m3?.symbol).toBe("m³");
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone. `galões` is the row that makes this more than a
    // formality: it is a *rewritten* plural, the class `suffixStripper`
    // structurally cannot reach, so leaving it undeclared would mean the printer
    // emitted a word only `portuguese`'s penalised rewriting analyzer could get
    // back — or, in a language without one, no word at all.
    for (const [unit, words] of Object.entries(volumePt.units)) {
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
    for (const [unit, words] of Object.entries(volumePt.units)) {
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
    expect(() => assertLocaleContract(pt, [volume])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so a fraction is never sampled at
    // all — and in Portuguese the fractional row is the interesting one, because
    // it is not the plural: `Intl.PluralRules("pt")` puts 1,5 in `one`. A
    // vocabulary that shipped only an `other` row would pass the default sweep
    // and print nothing for "1,5 litro".
    assertLocaleContract(pt, [volume], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one covers 0 and 1,5 as well as 1", () => {
    expect(word("l", 1)).toBe("litro");
    expect(word("l", 2)).toBe("litros");
    // CLDR's Portuguese rule is `i = 0..1`, so zero is singular: "0 litro".
    expect(word("l", 0)).toBe("litro");
    // And so is a fraction — "1,5 litro", the opposite of English.
    expect(word("l", 1.5)).toBe("litro");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of its
    // own for this; Portuguese has no case, so "em litros" is spelled like any
    // other plural and reuses `other`.
    expect(word("l", undefined, "conversion-target")).toBe("litros");
    // The million, the row CLDR files under `many` and `portuguese.selectForm`
    // folds into `other`.
    expect(word("l", 1e6)).toBe("litros");
    // The rewriting plural class, on the table rather than through the printer.
    expect(word("gal", 1)).toBe("galão");
    expect(word("gal", 2)).toBe("galões");
  });

  test("an engine built from it reads and writes Portuguese volume", () => {
    expect(engine.evaluate("2 litros").formatted).toBe("2 litros");
    expect(engine.evaluate("1 litro").formatted).toBe("1 litro");
    // A sum landing on a fraction: the decimal comma comes from CLDR through
    // `numberFormat: "intl"`, and the noun goes *singular* — "1,5 litro" — which
    // is the whole difference from `en` and `es` next door.
    expect(engine.evaluate("1 l + 500 ml").formatted).toBe("1,5 litro");
    // A conversion, written with `em`, over the gallon — the unit whose plural
    // replaces an ending rather than adding to one.
    expect(engine.evaluate("2 galões em litros").formatted).toBe("7,570823568 litros");
    expect(engine.evaluate("1 galão").formatted).toBe("1 galão");
    // The accent-free spellings a keyboard without dead keys produces. NFKC
    // folds neither the tilde on `ã` nor the one on `õ`, so both are different
    // strings to the index and are declared rather than derived.
    expect(engine.evaluate("2 galoes").formatted).toBe("2 galões");
    expect(engine.evaluate("2 galao").formatted).toBe("2 galões");
    // The historical name a European text uses for the same measure. It reads;
    // the borrowing is what prints.
    expect(engine.evaluate("3 quartilhos").formatted).toBe("3 pintas");
    // `m3` has no words, so it renders through the symbol branch — number and
    // symbol with no space, exactly as `en`, `uk` and `es` render it.
    expect(engine.evaluate("1 m³ para litros").formatted).toBe("1.000 litros");
    expect(engine.evaluate("2 m3 + 1 m3").formatted).toBe("3m³");
    // Portuguese groups with "." and the engine groups uniformly every three
    // digits.
    expect(engine.evaluate("2000 ml").formatted).toBe("2.000 mililitros");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while
    // Portuguese groups with "." and it does.
    for (const input of [
      "1 l + 500 ml",
      "2 galões em litros",
      "3 quartilhos",
      "2 m3 + 1 m3",
      "2000 ml",
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
