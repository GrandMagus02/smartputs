import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaEs from "./es";

const es = composeLocale(spanish, [areaEs]);
const engine = createEngine({ locales: [es], kinds: [area] });

/**
 * The two keys `spanish.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short.
 */
const KEYS = ["one", "other"];

/** The three units whose Spanish names are phrases, and therefore have no `forms`. */
const WORDLESS = ["m2", "cm2", "km2"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Spanish word", () => {
    // Spanish shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Spanish orthography (accented vowels and `ñ`, which no ASCII unit id can
    // contain), and neither spelled noun. `hectare` and `acre` are unit **ids**
    // and stay in the descriptor, so the plurals are what must have left.
    expect(JSON.stringify(area)).not.toMatch(/[áéíóúüñ]/i);
    expect(JSON.stringify(area)).not.toMatch(/hect[áa]reas|acres|²/i);
  });

  test("every unit that has words at all carries exactly the key set", () => {
    // Rule 6: no more keys and no fewer. The three squared units are the
    // deliberate exception and are asserted below rather than skipped quietly.
    for (const [unit, words] of Object.entries(areaEs.units)) {
      if (WORDLESS.includes(unit)) continue;
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
            kind: "area",
            unit: "hectare",
            slot,
          }),
        );
      }
      seen.add(spanish.selectForm({ kind: "area", unit: "hectare", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("the squared units have no forms and no Spanish alias", () => {
    // "metro cuadrado" is a phrase, and `lex` ends a word token at the space,
    // so no single analyzer is ever handed it: a two-word alias is unreachable
    // by the index that would have to hold it, and a two-word form would be
    // text the printer emits and the parser refuses. The superscript symbol is
    // the whole of what these three read and print — which is what a Spanish
    // reader writes anyway.
    for (const unit of WORDLESS) {
      expect(areaEs.units[unit]?.forms, unit).toBeUndefined();
      for (const alias of areaEs.units[unit]?.aliases ?? []) {
        expect(alias, unit).not.toMatch(/\s/u);
      }
    }
    expect(areaEs.units.m2?.symbol).toBe("m²");
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared.
    for (const [unit, words] of Object.entries(areaEs.units)) {
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
    for (const [unit, words] of Object.entries(areaEs.units)) {
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
    expect(() => assertLocaleContract(es, [area])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so `other` is reached only through
    // the plural of 0/2/5/… and never through a fraction. Spanish spells both
    // with the same row — that is the claim being tested, and it is a claim,
    // not a tautology: Ukrainian's fractional row is a *different* word from
    // its plural, so a language that gets this wrong is one this sweep is the
    // only thing to catch.
    assertLocaleContract(es, [area], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one for exactly one, other for everything else", () => {
    expect(word("hectare", 1)).toBe("hectárea");
    expect(word("hectare", 0)).toBe("hectáreas");
    expect(word("hectare", 1.5)).toBe("hectáreas");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Spanish reuses `other`, the generic category CLDR
    // requires every locale to define.
    expect(word("hectare", undefined, "conversion-target")).toBe("hectáreas");
    // The million, the row CLDR files under `many` and `spanish.selectForm`
    // folds into `other`.
    expect(word("acre", 1e6)).toBe("acres");
    // Spelled as in English and pluralised identically — a coincidence of the
    // borrowing, and the reason the entry exists rather than being skipped.
    expect(word("acre", 1)).toBe("acre");
  });

  test("an engine built from it reads and writes Spanish area", () => {
    expect(engine.evaluate("2 hectáreas").formatted).toBe("2 hectáreas");
    expect(engine.evaluate("1 hectárea").formatted).toBe("1 hectárea");
    // The accent-free spelling a keyboard without dead keys produces. NFKC does
    // not strip the acute, so it is a different string to the index and is
    // declared rather than derived.
    expect(engine.evaluate("2 hectareas").formatted).toBe("2 hectáreas");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun stays the plain plural.
    expect(engine.evaluate("1 ha + 5000 m2").formatted).toBe("1,5 hectáreas");
    // The squared units render through the symbol branch — number and symbol
    // with no space, exactly as `en` and `uk` render them — and Spanish groups
    // with "." (Spain's CLDR default, which the bare `es` tag resolves to).
    expect(engine.evaluate("1 hectárea en m2").formatted).toBe("10.000m²");
    expect(engine.evaluate("10000 m2 en hectáreas").formatted).toBe("1 hectárea");
    expect(engine.evaluate("3 acres").formatted).toBe("3 acres");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the
    // one interesting difference between the two: Ukrainian groups with U+00A0
    // and the lexer does not accept that separator on the way back in, while
    // Spanish groups with "." and it does.
    for (const input of [
      "1 ha + 5000 m2",
      "1 hectárea en m2",
      "3 acres",
      "2 km²",
      "10000 m2 en hectáreas",
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
