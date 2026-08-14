import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyPt from "./pt";

const locale = () => composeLocale(portuguese, [energyPt]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `portuguese.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    portuguese.selectForm({ kind: "energy", unit: "j", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      portuguese.selectForm({
        count: new Decimal(count),
        kind: "energy",
        unit: "j",
        slot,
      }),
    ),
  ]),
);

/** The units that carry words, and the three that deliberately do not. */
const WORDED = ["j", "kj", "mj", "cal", "kcal", "btu"];
const SYMBOL_ONLY = ["wh", "kwh", "mwh"];

describe("energy pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Portuguese
  // cannot borrow it — the kind is already full of Latin letters, so a script
  // test would fail on its own unit ids — so the words are the check: the kind
  // is ratios, unit ids, magnitude bands and four bridge signatures naming their
  // operands by string, and no Portuguese noun may appear in any of it.
  test("the kind itself carries no Portuguese word", () => {
    expect(JSON.stringify(energy)).not.toMatch(
      /quilojoule|megajoule|caloria|quilocaloria|quilowatt/i,
    );
  });

  test("`portuguese` asks for exactly two keys, and every worded unit fills those", () => {
    // The contract the language author pinned: one axis, two rows, no slot
    // dimension. `one` covers 1 — and also 0 and 1,5, since CLDR's Portuguese
    // rule is `i = 0..1` — while `other` covers everything else including CLDR's
    // third Portuguese category `many`, which `Intl` really returns at 1e6 and
    // which `selectForm` folds away because it is a fact about the numeral
    // ("1 milhão") rather than about the noun. 1e6 is in the sweep so the fold
    // is sampled rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const unit of WORDED) {
      expect(Object.keys(energyPt.units[unit]?.forms ?? {}).sort(), unit).toEqual([
        "one",
        "other",
      ]);
    }
    // The watt-hour family, for the reason `en.ts` records and Portuguese
    // restates: "quilowatt-hora" carries a hyphen the lexer reads as subtraction
    // and "quilowatt hora" carries a space that ends the token, so a `forms`
    // table here would be prose no input could reach.
    for (const unit of SYMBOL_ONLY) {
      expect(energyPt.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "kWh" be the symbol while "kwh" is the alias. What this catches
    // is a printed word reachable only through `portuguese`'s suffix stripper,
    // at its -2 penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(energyPt.units)) {
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
    // fraction takes. Portuguese sends it to `one` rather than `other`, which is
    // the row a table copied from `es.ts` would have filled the other way — so
    // it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, except where Portuguese makes them one", () => {
    expect(word("j", 1)).toBe("joule");
    expect(word("j", 2)).toBe("joules");
    // The two rows a translator borrowing an English or Spanish intuition gets
    // wrong: the integer part decides, so 0 and 1,5 are singular.
    expect(word("j", 0)).toBe("joule");
    expect(word("j", 1.5)).toBe("joule");
    // 21 stays plural in Portuguese where Ukrainian makes it singular.
    expect(word("j", 21)).toBe("joules");
    // The feminine unit inflects for number exactly as the masculine one does;
    // gender never reaches this table.
    expect(word("cal", 1)).toBe("caloria");
    expect(word("cal", 2)).toBe("calorias");
    // And the borrowed initialism, where both rows are the same string on
    // purpose rather than by omission.
    expect(word("btu", 1)).toBe("BTU");
    expect(word("btu", 5)).toBe("BTU");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("j", undefined, "conversion-target")).toBe("joules");
  });

  test("an engine built from it reads and writes Portuguese energy", () => {
    // The plural boundary, both sides of it — and the eponym Portuguese does not
    // Hispanicise, so what goes in is what comes out.
    expect(engine.evaluate("1 joule").formatted).toBe("1 joule");
    expect(engine.evaluate("2 joules").formatted).toBe("2 joules");
    // A sum landing on a fraction, which is where the decimal comma shows and
    // where the noun stays singular. Written with a comma throughout: "1.5" is
    // not a Portuguese number, since the full stop is the group separator.
    expect(engine.evaluate("1 kj + 500 j").formatted).toBe("1,5 quilojoule");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 kj em joules").formatted).toBe("2.000 joules");
    expect(engine.evaluate("2 kj para joules").formatted).toBe("2.000 joules");
    // The Portuguese prefix prints; the k-spelling only reads.
    expect(engine.evaluate("300 kilocalorias").formatted).toBe("300 quilocalorias");
    expect(engine.evaluate("300 quilocalorias").formatted).toBe("300 quilocalorias");
    // No accent to type twice: "caloria" is stressed on the penult, which
    // Portuguese leaves unmarked.
    expect(engine.evaluate("300 calorias").formatted).toBe("300 calorias");
    // The watt-hour family prints its symbol tight against the number, because
    // it has no forms to print instead.
    expect(engine.evaluate("5 kwh").formatted).toBe("5kWh");
    expect(engine.evaluate("1 kwh em kj").formatted).toBe("3.600 quilojoules");
    // The invariant initialism, spaced by its `forms` table.
    expect(engine.evaluate("2 btu").formatted).toBe("2 BTU");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 kj + 500 j",
      "2 kj em joules",
      "300 calorias",
      "300 kilocalorias",
      "5 kwh",
      "2 btu",
      "1 joule",
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
