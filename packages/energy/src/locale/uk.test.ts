import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyUk from "./uk";

const engine = () =>
  createEngine({
    locales: [composeLocale(ukrainian, [energyUk])],
    kinds: [energy],
  });

/** The key `ukrainian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  ukrainian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "energy",
    unit,
    slot,
  });

describe("energy uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Ukrainian word either", () => {
    expect(JSON.stringify(energy)).not.toMatch(/джоул|калор/);
  });

  test("the watt-hour family still ships no forms", () => {
    // The same call `en.ts` makes, for the same reason on both sides: the
    // spelled-out compound ("кіловат-година") is hyphenated and cannot lex as
    // one unit token, so absent `forms` keeps the formatter on the symbol.
    for (const unit of ["wh", "kwh", "mwh"]) {
      expect(energyUk.units[unit]?.forms, `${unit} has forms`).toBeUndefined();
    }
  });

  test("every unit that has forms has all eight keys Ukrainian can ask for", () => {
    // The contract check does this too, but it samples counts and slots and
    // reports what it happened to miss. This states the shape directly, so a
    // table with seven rows fails on the count rather than on a lucky sample.
    const eight = [
      "nom-one",
      "nom-few",
      "nom-many",
      "nom-other",
      "loc-one",
      "loc-few",
      "loc-many",
      "loc-other",
    ];
    for (const [unit, words] of Object.entries(energyUk.units)) {
      if (words.forms === undefined) continue;
      expect(Object.keys(words.forms).sort(), `${unit}`).toEqual([...eight].sort());
    }
  });

  test("the composed locale satisfies the locale contract", () => {
    assertLocaleContract(composeLocale(ukrainian, [energyUk]), [energy]);
  });

  test("an engine built from it reads and writes Ukrainian energy", () => {
    const e = engine();
    // Cyrillic in, Cyrillic out, across the plural boundary Ukrainian has and
    // English does not: 2 takes the "few" form and 5 the "many" one.
    expect(e.evaluate("2 кДж").formatted).toBe("2 кілоджоулі");
    expect(e.evaluate("5 кДж").formatted).toBe("5 кілоджоулів");
    // The fractional row. `nom-other` is the genitive *singular*, so this reads
    // "1,5 кілоджоуля" — printing "1,5 кілоджоулів" here is the specific
    // mistake the eight-key table exists to prevent.
    expect(e.evaluate("1,5 кДж").formatted).toBe("1,5 кілоджоуля");
    // A conversion, with the Ukrainian preposition and the Ukrainian group
    // separator (U+00A0, written as an escape so it survives being retyped).
    expect(e.evaluate("1 кДж в джоулях").formatted).toBe("1\u00A0000 джоулів");
    // Feminine, where "few" and the fractional category coincide ("2 калорії",
    // "1,5 калорії") but "many" drops the ending entirely.
    expect(e.evaluate("2 калорії").formatted).toBe("2 калорії");
    expect(e.evaluate("5 калорій").formatted).toBe("5 калорій");
    // Both scripts read: a Latin datasheet spelling and a Cyrillic one add up.
    expect(e.evaluate("1 кДж + 500 Дж").formatted).toBe("1,5 кілоджоуля");
    // BTU does not decline, so every count prints the same label.
    expect(e.evaluate("2 btu").formatted).toBe("2 BTU");
    expect(e.evaluate("5 btu").formatted).toBe("5 BTU");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — the row a one-dimensional plural table could not
    // hold.
    const kj = energyUk.units.kj?.forms;
    expect(kj?.[key("kj", "after-number", 5)]).toBe("кілоджоулів");
    expect(kj?.[key("kj", "conversion-target", 5)]).toBe("кілоджоулях");
    expect(key("kj", "conversion-target")).toBe("loc-other");
    expect(kj?.[key("kj", "conversion-target")]).toBe("кілоджоулях");
  });

  test("the watt-hour symbol prints, and is a product where its operands exist", () => {
    // "кВт·год" is the correct Ukrainian symbol, and `parse/lex.ts` builds a
    // unit word out of letters plus trailing digits, so the interpunct ends the
    // token and the printed symbol reaches the resolver as "кВт" and "год" —
    // never as one alias, however many times the alias is listed. What changed
    // is what sits between them: `lex` now reads U+00B7 as `*`, so the symbol is
    // an expression, and this kind's own `* | power | duration` signature turns
    // kilowatt times hour into joules. The same route "m/s" takes in English.
    //
    // Which means the two operands have to be *registered*, and the engine above
    // is deliberately this kind alone — the point of a per-package locale test is
    // that the vocabulary is checked without the rest of the repo propping it up.
    // So the symbol still fails to read here, now for a stated reason ("кВт" is
    // no unit of any registered kind) rather than for want of an operator, and
    // the wired-up case lives in `@smartput/kinds`' `ukrainian.test.ts`.
    const e = engine();
    expect(e.evaluate("2 kwh").formatted).toBe("2кВт·год");
    expect(() => e.evaluate("2 кВт·год")).toThrow(/кВт/);
  });

  test("round-trips: reparsing the formatted text gives the same quantity", () => {
    // The conversion here is deliberately one whose result stays under a
    // thousand. Ukrainian groups with U+00A0 and `parse/normalize.ts` folds
    // every `\s` — NBSP included — to a plain space before `lex()` sees it, so
    // "1 000 джоулів" comes back as two numbers and fails to parse. That is a
    // core-level round-trip gap between the group separator and the
    // normalizer, not something a vocabulary can express its way out of, so it
    // is reported rather than asserted: pinning it here would lock the bug in.
    const e = engine();
    for (const input of ["1,5 кДж", "5 калорій", "2000 Дж в кілоджоулях", "5 btu"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value, input).toEqual(first.value);
    }
  });
});
