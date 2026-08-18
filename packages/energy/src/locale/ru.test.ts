import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationRu from "@smartput/duration/locale/ru";
import { power } from "@smartput/power";
import powerRu from "@smartput/power/locale/ru";
import { energy } from "../index";
import energyRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [energyRu])],
    kinds: [energy],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "energy",
    unit,
    slot,
  });

const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

describe("energy ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and four bridge signatures that name their operand
  // kinds by string. Cyrillic anywhere in the descriptor would mean a
  // translation had leaked into the language-free half of the package.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(energy)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("the watt-hour family still ships no forms", () => {
    // The same call `en.ts` makes, for the same reason on both sides: the
    // spelled-out compound ("киловатт-час") is hyphenated and cannot lex as one
    // unit token, so absent `forms` keeps the formatter on the symbol.
    for (const unit of ["wh", "kwh", "mwh"]) {
      expect(energyRu.units[unit]?.forms, `${unit} has forms`).toBeUndefined();
    }
  });

  test("every unit that has forms carries exactly the eight keys", () => {
    // The contract check does this too, but it samples counts and slots and
    // reports what it happened to miss. This states the shape directly, so a
    // table with seven rows fails on the count rather than on a lucky sample —
    // and a ninth key nothing can select fails here too, which the sampling
    // check cannot see at all.
    for (const [unit, words] of Object.entries(energyRu.units)) {
      if (words.forms === undefined) continue;
      expect(Object.keys(words.forms).sort(), unit).toEqual(EIGHT_KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 кДж в килоджоуле" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(energyRu.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(russian, [energyRu]), [energy]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Russian that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [energyRu]), [energy], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine soft stem. `nom-few` is a genitive *singular*, so it coincides
    // with the fractional row — the opposite grouping to Ukrainian's "2 джоулі"
    // against "1,5 джоуля", where the same two cells stand apart.
    const j = energyRu.units.j?.forms;
    expect(j?.[key("j", "after-number", 1)]).toBe("джоуль");
    expect(j?.[key("j", "after-number", 2)]).toBe("джоуля");
    expect(j?.[key("j", "after-number", 5)]).toBe("джоулей");
    expect(j?.[key("j", "after-number", 1.5)]).toBe("джоуля");
    // The two counts that catch a hand-written plural rule: 21 is `one` in
    // Russian and 11 is not.
    expect(j?.[key("j", "after-number", 21)]).toBe("джоуль");
    expect(j?.[key("j", "after-number", 11)]).toBe("джоулей");
    // The feminine -ия paradigm collapses three cells onto one spelling, and its
    // genitive plural is the soft "калорий" rather than a bare stem.
    const cal = energyRu.units.cal?.forms;
    expect(cal?.[key("cal", "after-number", 2)]).toBe("калории");
    expect(cal?.[key("cal", "after-number", 5)]).toBe("калорий");
    expect(cal?.[key("cal", "after-number", 1.5)]).toBe("калории");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // prepositional one as a conversion target, and a target with no count at
    // all lands on `loc-other` — the row a one-dimensional plural table could
    // not hold.
    const kj = energyRu.units.kj?.forms;
    expect(kj?.[key("kj", "after-number", 5)]).toBe("килоджоулей");
    expect(kj?.[key("kj", "conversion-target", 5)]).toBe("килоджоулях");
    expect(key("kj", "conversion-target")).toBe("loc-other");
    expect(kj?.[key("kj", "conversion-target")]).toBe("килоджоулях");
    // The prepositional singular is its own ending, so the case axis is not one
    // suffix applied to every count: "в 1 килоджоуле", not "в 1 килоджоулях".
    expect(kj?.[key("kj", "conversion-target", 1)]).toBe("килоджоуле");
    // ...and the -ия paradigm collapses it back onto the genitive: "в 1
    // калории" is the same string as "1,5 калории", which is why an ending table
    // alone cannot generate this vocabulary.
    expect(energyRu.units.cal?.forms?.[key("cal", "conversion-target", 1)]).toBe(
      "калории",
    );
  });

  test("an engine built from it reads and writes Russian energy", () => {
    const e = engine();
    // Cyrillic in, Cyrillic out, across the numeral boundary Russian has and
    // English does not: 2 takes `nom-few` and 5 takes `nom-many`.
    expect(e.evaluate("2 кДж").formatted).toBe("2 килоджоуля");
    expect(e.evaluate("5 кДж").formatted).toBe("5 килоджоулей");
    // The fractional row. `nom-other` is the genitive *singular*, so this reads
    // "1,5 килоджоуля" — printing "1,5 килоджоулей" here is the specific mistake
    // the eight-key table exists to prevent.
    expect(e.evaluate("1,5 кДж").formatted).toBe("1,5 килоджоуля");
    // The same fraction reached by a sum, and by a sum whose operands are
    // written in two scripts.
    expect(e.evaluate("1 кДж + 500 Дж").formatted).toBe("1,5 килоджоуля");
    // A conversion, with the Russian preposition and the Russian group separator
    // (U+00A0, written as an escape so it survives being retyped).
    expect(e.evaluate("1 кДж в джоулях").formatted).toBe("1\u00A0000 джоулей");
    // The feminine -ия noun, where "few" and the fractional category coincide
    // ("2 калории", "1,5 калории") and "many" takes the soft -ий.
    expect(e.evaluate("2 калории").formatted).toBe("2 калории");
    expect(e.evaluate("5 калорий").formatted).toBe("5 калорий");
    // BTU does not decline, so every count prints the same label — and it prints
    // the Russian initialism, where `uk.ts` prints the Latin one because
    // Ukrainian has no settled abbreviation to print.
    expect(e.evaluate("2 btu").formatted).toBe("2 БТЕ");
    expect(e.evaluate("5 бте").formatted).toBe("5 БТЕ");
  });

  test("the watt-hour symbol prints, and is a product where its operands exist", () => {
    // "кВт·ч" is the correct Russian symbol, and `parse/lex.ts` builds a unit
    // word out of letters plus trailing digits, so the interpunct ends the token
    // and the printed symbol reaches the resolver as "кВт" and "ч" — never as one
    // alias, however many times the alias is listed. What sits between them is
    // U+00B7, which `lex` reads as `*`, so the symbol is an expression and this
    // kind's own `* | power | duration` signature turns kilowatts times hours
    // into joules. The same route "m/s" takes in English.
    //
    // Which means the two operands have to be *registered*, and the engine here
    // is deliberately this kind alone — the point of a per-package locale test is
    // that the vocabulary is checked without the rest of the repo propping it up.
    // So the symbol fails to read here for a stated reason ("кВт" is no unit of
    // any registered kind) rather than for want of an operator.
    const e = engine();
    expect(e.evaluate("2 kwh").formatted).toBe("2 кВт·ч");
    expect(() => e.evaluate("2 кВт·ч")).toThrow(/кВт/);
  });

  test("wired to power and duration, the printed symbol reads back as a product", () => {
    // The other half of the paragraph above, and the reason this package's `ru`
    // vocabulary can be shipped beside `@smartput/power`'s and
    // `@smartput/duration`'s rather than only with them: all three are Russian,
    // all three name their kind by id string, and `composeLocale` is where they
    // meet. "ч" is duration's Russian symbol for the hour and "кВт" is power's
    // for the kilowatt, so the product is spelled entirely out of words those two
    // vocabularies already declare.
    const wired = createEngine({
      locales: [composeLocale(russian, [energyRu, powerRu, durationRu])],
      kinds: [energy, power, duration],
    });
    // 5 kW for an hour: 5000 W × 3600 s, in canonical joules.
    const product = wired.evaluate("5 кВт·ч");
    expect(product.value?.kind).toBe("energy");
    expect(product.value?.canonical.toFixed()).toBe("18000000");
    // And it converts like any other energy, into a unit that does decline.
    expect(wired.evaluate("2 кВт·ч в мдж").formatted).toBe("7,2 мегаджоуля");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose. Russian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "1 000 джоулей" would come back
    // as two numbers if `lex` did not accept that folded separator for a language
    // whose own separator is a non-breaking space. This is the one input a
    // Russian engine is guaranteed to be handed: its own output.
    for (const input of [
      "1,5 кДж",
      "5 калорий",
      "1 кДж + 500 Дж",
      "1 кДж в джоулях",
      "2000 Дж в килоджоулях",
      "5 btu",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
