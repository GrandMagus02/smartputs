import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureEs from "./es";

const es = composeLocale(spanish, [measureEs]);
const engine = createEngine({ locales: [es], kinds: [measure] });

/**
 * The two keys `spanish.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Spanish word", () => {
    // Spanish shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Spanish orthography (accented vowels and `ñ`, which no ASCII unit id can
    // contain), and none of the six nouns spelled out. `pica` is matched with a
    // word boundary in front of it, because the kind's own `typical` band map
    // contains those four letters and a bare substring test reads that as a
    // Spanish word.
    expect(JSON.stringify(measure)).not.toMatch(/[áéíóúüñ]/i);
    expect(JSON.stringify(measure)).not.toMatch(/pulgada|punto|\bpicas?\b|p[íi]xel/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. Ukrainian next door needs eight here
    // because it composes a case with a plural category; Spanish composes
    // nothing, so a third row would be a word no count could ever select.
    for (const [unit, words] of Object.entries(measureEs.units)) {
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
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
      seen.add(spanish.selectForm({ kind: "measure", unit: "px", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. `píxel` is what
    // makes this more than a formality — its plural moves the written accent to
    // a syllable the singular does not mark, so no suffix rule reaches it.
    for (const [unit, words] of Object.entries(measureEs.units)) {
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
    for (const [unit, words] of Object.entries(measureEs.units)) {
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
    // `pt`, `pc` and `px` are what a Spanish designer writes in a stylesheet;
    // inventing `pnt` or `píx` would be a word this file made up. The inch has
    // no Spanish abbreviation at all, and the English one is core's conversion
    // keyword, so the noun is the only honest symbol.
    expect(measureEs.units.pt?.symbol).toBe("pt");
    expect(measureEs.units.pc?.symbol).toBe("pc");
    expect(measureEs.units.px?.symbol).toBe("px");
    expect(measureEs.units.inch?.symbol).toBe("pulgada");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(es, [measure])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Spanish spells both
    // with the same row — that is the claim being tested, and it is a claim,
    // not a tautology: Ukrainian's fractional row is a *different* word from
    // its plural, so a language that gets this wrong is one this sweep is the
    // only thing to catch.
    assertLocaleContract(es, [measure], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("pt", 1)).toBe("punto");
    expect(word("pt", 0)).toBe("puntos");
    expect(word("pt", 1.5)).toBe("puntos");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Spanish reuses `other`, the generic category CLDR
    // requires every locale to define.
    expect(word("pt", undefined, "conversion-target")).toBe("puntos");
    // The million, the row CLDR files under `many` and `spanish.selectForm`
    // folds into `other`.
    expect(word("px", 1e6)).toBe("píxeles");
    // The accent that moves rather than disappears.
    expect(word("px", 1)).toBe("píxel");
    expect(word("px", 2)).toBe("píxeles");
  });

  test("an engine built from it reads and writes Spanish typography", () => {
    expect(engine.evaluate("1 pulgada en puntos").formatted).toBe("72 puntos");
    expect(engine.evaluate("72 puntos en pulgadas").formatted).toBe("1 pulgada");
    // `px` is the one dynamic ratio in the repo, and the default 96 dpi reaches
    // Spanish exactly as it reaches every other language: through the kind.
    expect(engine.evaluate("1 pulgada en píxeles").formatted).toBe("96 píxeles");
    // The accent-free spelling a keyboard without dead keys produces. NFKC does
    // not strip the acute, so "pixeles" is a different string to the index and
    // is declared; "pixel" needs no entry, because `units.ts` already carries
    // it as the English name.
    expect(engine.evaluate("3 pixeles").formatted).toBe("3 píxeles");
    // Latin aliases still read: a designer types `pc` whatever the keyboard is.
    expect(engine.evaluate("6 pc en pulgadas").formatted).toBe("1 pulgada");
    // A subtraction landing on a repeating fraction: the decimal comma comes
    // from CLDR through `numberFormat: "intl"`, and the noun stays the plain
    // plural — Ukrainian would need a genitive singular here.
    expect(engine.evaluate("1 pulgada - 12 puntos").formatted).toBe("0,8333 pulgadas");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 pulgada en puntos",
      "1 pulgada en píxeles",
      "6 pc en pulgadas",
      "2 picas",
      "1,5 milímetros",
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
