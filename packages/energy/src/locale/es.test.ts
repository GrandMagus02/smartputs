import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyEs from "./es";

const locale = () => composeLocale(spanish, [energyEs]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `spanish.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    spanish.selectForm({ kind: "energy", unit: "j", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      spanish.selectForm({ count: new Decimal(count), kind: "energy", unit: "j", slot }),
    ),
  ]),
);

/** The units that carry words, and the three that deliberately do not. */
const WORDED = ["j", "kj", "mj", "cal", "kcal", "btu"];
const SYMBOL_ONLY = ["wh", "kwh", "mwh"];

describe("energy es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Spanish cannot
  // borrow it — the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids — so the words are the check: the kind is
  // ratios, unit ids, magnitude bands and four bridge signatures naming their
  // operands by string, and no Spanish noun may appear in any of it.
  test("the kind itself carries no Spanish word", () => {
    expect(JSON.stringify(energy)).not.toMatch(
      /julio|kilojulio|megajulio|calor[íi]a|vatio/i,
    );
  });

  test("`spanish` asks for exactly two keys, and every worded unit fills those", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const unit of WORDED) {
      expect(Object.keys(energyEs.units[unit]?.forms ?? {}).sort(), unit).toEqual([
        "one",
        "other",
      ]);
    }
    // The watt-hour family, for the reason `en.ts` records and Spanish
    // restates: "kilovatio-hora" carries a hyphen the lexer reads as
    // subtraction and "kilovatio hora" carries a space that ends the token, so
    // a `forms` table here would be prose no input could reach.
    for (const unit of SYMBOL_ONLY) {
      expect(energyEs.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "kWh" be the symbol while "kwh" is the alias. What this catches
    // is a printed word reachable only through `spanish`'s suffix stripper, at
    // its -2 penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(energyEs.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [energy])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Spanish folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, except where Spanish makes them one", () => {
    expect(word("j", 1)).toBe("julio");
    expect(word("j", 2)).toBe("julios");
    expect(word("j", 0)).toBe("julios");
    // 21 stays plural in Spanish where Ukrainian makes it singular, and a
    // fraction is plural too.
    expect(word("j", 21)).toBe("julios");
    expect(word("j", 1.5)).toBe("julios");
    // The feminine unit inflects for number exactly as the masculine one does;
    // gender never reaches this table.
    expect(word("cal", 1)).toBe("caloría");
    expect(word("cal", 2)).toBe("calorías");
    // And the borrowed initialism, where both rows are the same string on
    // purpose rather than by omission.
    expect(word("btu", 1)).toBe("BTU");
    expect(word("btu", 5)).toBe("BTU");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("j", undefined, "conversion-target")).toBe("julios");
  });

  test("an engine built from it reads and writes Spanish energy", () => {
    // The plural boundary, both sides of it.
    expect(engine.evaluate("1 julio").formatted).toBe("1 julio");
    expect(engine.evaluate("2 julios").formatted).toBe("2 julios");
    // The Latin American spelling reads and the RAE's spelling prints — the
    // many-to-one recognition the model is built on, with one generation.
    expect(engine.evaluate("2 joules").formatted).toBe("2 julios");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma throughout: "1.5" is not a Spanish number, since the
    // full stop is this language's group separator.
    expect(engine.evaluate("1 kj + 500 j").formatted).toBe("1,5 kilojulios");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 kj en julios").formatted).toBe("2.000 julios");
    expect(engine.evaluate("2 kj a julios").formatted).toBe("2.000 julios");
    // Accents typed and untyped, since NFKC folds neither into the other.
    expect(engine.evaluate("300 calorías").formatted).toBe("300 calorías");
    expect(engine.evaluate("300 calorias").formatted).toBe("300 calorías");
    // The watt-hour family prints its symbol tight against the number, because
    // it has no forms to print instead.
    expect(engine.evaluate("5 kwh").formatted).toBe("5 kWh");
    expect(engine.evaluate("1 kwh en kj").formatted).toBe("3.600 kilojulios");
    // The invariant initialism, spaced by its `forms` table.
    expect(engine.evaluate("2 btu").formatted).toBe("2 BTU");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 kj + 500 j",
      "2 kj en julios",
      "300 calorias",
      "5 kwh",
      "2 btu",
      "1 julio",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
