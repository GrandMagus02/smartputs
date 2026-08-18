import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeEs from "./es";

const es = composeLocale(spanish, [volumeEs]);
const engine = createEngine({ locales: [es], kinds: [volume] });

/**
 * The two keys `spanish.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short.
 */
const KEYS = ["one", "other"];

/** The unit whose Spanish name is a phrase, and therefore has no `forms`. */
const WORDLESS = "m3";

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Spanish word", () => {
    // Spanish shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Spanish orthography (accented vowels and `ñ`, which no ASCII unit id can
    // contain), and none of the nouns spelled out.
    expect(JSON.stringify(volume)).not.toMatch(/[áéíóúüñ]/i);
    expect(JSON.stringify(volume)).not.toMatch(/litros?|mililitro|galon|pinta/i);
  });

  test("every unit that has words at all carries exactly the key set", () => {
    // Rule 6: no more keys and no fewer. `m3` is the deliberate exception and
    // is asserted below rather than skipped quietly here.
    for (const [unit, words] of Object.entries(volumeEs.units)) {
      if (unit === WORDLESS) continue;
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
    }
    // ...and the list above is the whole of what the language can ask for,
    // swept over the counts that separate CLDR's Spanish categories: 1 is
    // `one`, 1e6 is `many` before `spanish.selectForm` folds it, and the rest
    // are `other`.
    const seen = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1e6]) {
        seen.add(
          spanish.selectForm({
            count: new Decimal(count),
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
      seen.add(spanish.selectForm({ kind: "volume", unit: "l", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("`m3` has no forms and no Spanish alias, because its name is two words", () => {
    // "metro cúbico" is a phrase, and `lex` ends a word token at the space, so
    // no single analyzer is ever handed it: a two-word alias is unreachable by
    // the index that would have to hold it, and a two-word form would be text
    // the printer emits and the parser refuses. Spanish has no one-word
    // colloquial name to fall back on either, the way Ukrainian has "кубометр".
    expect(volumeEs.units[WORDLESS]?.forms).toBeUndefined();
    expect(volumeEs.units[WORDLESS]?.symbol).toBe("m³");
    for (const alias of volumeEs.units[WORDLESS]?.aliases ?? []) {
      expect(alias).not.toMatch(/\s/u);
    }
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. `galón` is the
    // entry that makes this more than a formality — its plural moves the
    // written accent, so no suffix rule reaches it from the singular.
    for (const [unit, words] of Object.entries(volumeEs.units)) {
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
    for (const [unit, words] of Object.entries(volumeEs.units)) {
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
    expect(() => assertLocaleContract(es, [volume])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Spanish spells both
    // with the same row — that is the claim being tested, and it is a claim,
    // not a tautology: Ukrainian's fractional row is a *different* word from
    // its plural, so a language that gets this wrong is one this sweep is the
    // only thing to catch.
    assertLocaleContract(es, [volume], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("l", 1)).toBe("litro");
    expect(word("l", 0)).toBe("litros");
    expect(word("l", 1.5)).toBe("litros");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Spanish reuses `other`, the generic category CLDR
    // requires every locale to define.
    expect(word("l", undefined, "conversion-target")).toBe("litros");
    // The million, the row CLDR files under `many` and `spanish.selectForm`
    // folds into `other`.
    expect(word("l", 1e6)).toBe("litros");
    // The accent that only the singular writes.
    expect(word("gal", 1)).toBe("galón");
    expect(word("gal", 2)).toBe("galones");
  });

  test("an engine built from it reads and writes Spanish volume", () => {
    expect(engine.evaluate("2 litros").formatted).toBe("2 litros");
    expect(engine.evaluate("1 litro").formatted).toBe("1 litro");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural.
    expect(engine.evaluate("1 l + 500 ml").formatted).toBe("1,5 litros");
    // A conversion, written with `en`, over the gallon — and the accented
    // singular printing as the accent-free plural, which is Spanish spelling
    // and not a stripped stem.
    expect(engine.evaluate("2 galones en litros").formatted).toBe("7,570823568 litros");
    expect(engine.evaluate("1 galón").formatted).toBe("1 galón");
    // The accent-free spelling a keyboard without dead keys produces. NFKC
    // does not strip the acute, so it is a different string to the index and is
    // declared rather than derived.
    expect(engine.evaluate("2 galon").formatted).toBe("2 galones");
    // `m3` has no words, so it renders through the symbol branch — number and
    // symbol with no space, exactly as `en` and `uk` render it.
    expect(engine.evaluate("1 m³ en litros").formatted).toBe("1.000 litros");
    expect(engine.evaluate("2 m3 + 1 m3").formatted).toBe("3 m³");
    // Spanish groups with "." (Spain's CLDR default, which the bare `es` tag
    // resolves to) and the engine groups uniformly every three digits.
    expect(engine.evaluate("2000 ml").formatted).toBe("2.000 mililitros");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the
    // one interesting difference between the two: Ukrainian groups with U+00A0
    // and the lexer does not accept that separator on the way back in, while
    // Spanish groups with "." and it does.
    for (const input of [
      "1 l + 500 ml",
      "2 galones en litros",
      "3 pintas",
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
