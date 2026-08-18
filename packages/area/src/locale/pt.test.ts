import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaPt from "./pt";

const pt = composeLocale(portuguese, [areaPt]);
const engine = createEngine({ locales: [pt], kinds: [area] });

/**
 * The two keys `portuguese.selectForm` can return. Written out rather than
 * derived so that a language that grew a third category would fail *here*, on a
 * list somebody has to read, instead of silently leaving every table below a row
 * short. CLDR does give Portuguese a third — `many`, for whole multiples of a
 * million — and the language folds it into `other`.
 */
const KEYS = ["one", "other"];

/** The three units whose Portuguese names are phrases, and therefore have no `forms`. */
const WORDLESS = ["m2", "cm2", "km2"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Portuguese word", () => {
    // Portuguese shares its script with the kind's own unit ids, so this cannot
    // be the Cyrillic-block test `uk` next door uses. Two checks instead: no
    // Portuguese orthography (the accented vowels, `ã`/`õ` and `ç`, none of
    // which an ASCII unit id can contain), and neither plural spelled out.
    // `hectare` and `acre` are unit **ids** and stay in the descriptor — which
    // is exactly why this vocabulary needed no alias of its own for them — so
    // the plurals are what must have left.
    expect(JSON.stringify(area)).not.toMatch(/[áàâãéêíóôõúüç]/i);
    expect(JSON.stringify(area)).not.toMatch(/hectares|acres|²/i);
  });

  test("every unit that has words at all carries exactly the key set", () => {
    // Rule 6: no more keys and no fewer. The three squared units are the
    // deliberate exception and are asserted below rather than skipped quietly.
    for (const [unit, words] of Object.entries(areaPt.units)) {
      if (WORDLESS.includes(unit)) continue;
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
            kind: "area",
            unit: "hectare",
            slot,
          }),
        );
      }
      seen.add(portuguese.selectForm({ kind: "area", unit: "hectare", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("the squared units have no forms and no Portuguese alias", () => {
    // "metro quadrado" is a phrase, and `lex` ends a word token at the space,
    // so no single analyzer is ever handed it: a two-word alias is unreachable
    // by the index that would have to hold it, and a two-word form would be text
    // the printer emits and the parser refuses.
    for (const unit of WORDLESS) {
      expect(areaPt.units[unit]?.forms, unit).toBeUndefined();
      for (const alias of areaPt.units[unit]?.aliases ?? []) {
        expect(alias, unit).not.toMatch(/\s/u);
      }
    }
    expect(areaPt.units.m2?.symbol).toBe("m²");
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. Here it also
    // pins the claim the doc comment makes — that `units.ts` already carries
    // both Portuguese words, so nothing had to be added.
    for (const [unit, words] of Object.entries(areaPt.units)) {
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
    for (const [unit, words] of Object.entries(areaPt.units)) {
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
    expect(() => assertLocaleContract(pt, [area])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so a fraction is never sampled at
    // all — and in Portuguese the fractional row is the interesting one, because
    // it is not the plural: `Intl.PluralRules("pt")` puts 1,5 in `one`. A
    // vocabulary that shipped only an `other` row would pass the default sweep
    // and print nothing for "1,5 hectare".
    assertLocaleContract(pt, [area], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("one covers 0 and 1,5 as well as 1", () => {
    expect(word("hectare", 1)).toBe("hectare");
    expect(word("hectare", 2)).toBe("hectares");
    // CLDR's Portuguese rule is `i = 0..1`, so zero is singular: "0 hectare".
    expect(word("hectare", 0)).toBe("hectare");
    // And so is a fraction — "1,5 hectare", the opposite of English.
    expect(word("hectare", 1.5)).toBe("hectare");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; Portuguese has no case, so "em hectares" is spelled like
    // any other plural and reuses `other`.
    expect(word("hectare", undefined, "conversion-target")).toBe("hectares");
    // The million, the row CLDR files under `many` and `portuguese.selectForm`
    // folds into `other`.
    expect(word("acre", 1e6)).toBe("acres");
    expect(word("acre", 1)).toBe("acre");
  });

  test("an engine built from it reads and writes Portuguese area", () => {
    expect(engine.evaluate("2 hectares").formatted).toBe("2 hectares");
    expect(engine.evaluate("1 hectare").formatted).toBe("1 hectare");
    // A sum landing on a fraction: the decimal comma comes from CLDR through
    // `numberFormat: "intl"`, and the noun goes *singular* — "1,5 hectare" —
    // which is the whole difference from `en` and `es` next door.
    expect(engine.evaluate("1 ha + 5000 m2").formatted).toBe("1,5 hectare");
    // A conversion, written with `em` — the preposition `portuguese` lists first
    // under `in`. The squared units render through the symbol branch, number and
    // symbol with no space, and Portuguese groups thousands with ".".
    expect(engine.evaluate("1 hectare em m2").formatted).toBe("10.000 m²");
    // `para` is the second spelling of the same keyword and reaches the same
    // reading, which is what a many-to-one keyword table is for.
    expect(engine.evaluate("10000 m2 para hectares").formatted).toBe("1 hectare");
    expect(engine.evaluate("3 acres").formatted).toBe("3 acres");
  });

  test("its own output reads back to the same value, grouping included", () => {
    // The grouped row is *in* this loop, unlike Ukrainian's, and that is the one
    // interesting difference between the two: Ukrainian groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, while
    // Portuguese groups with "." and it does.
    for (const input of [
      "1 ha + 5000 m2",
      "1 hectare em m2",
      "3 acres",
      "2 km²",
      "10000 m2 para hectares",
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
