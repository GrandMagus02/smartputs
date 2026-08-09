import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentUk from "./uk";

const engine = () =>
  createEngine({
    locales: [composeLocale(ukrainian, [percentUk])],
    kinds: [percent],
  });

describe("percent uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so no script but ASCII may reach it.
  // Cyrillic anywhere in the descriptor would mean a translation had leaked into
  // the half of the package that is supposed to be language-free.
  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(percent)).not.toMatch(/[Ѐ-ӿ]/);
  });

  // No `forms`, and for `en`'s reason rather than `area`'s: Ukrainian really
  // does decline "відсоток", but the written form of this unit is the symbol.
  // Where the `en` unit decided against word forms, this file does not invent
  // them — otherwise every percentage in a Ukrainian engine's output would read
  // as a word, and the printer's spelled path would be offering completion text
  // no one wants to type.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentUk.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [percentUk]), [percent]),
    ).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach: the sweep is skipped, but the alias
    // half of the contract is what carries this kind, and running the same call
    // shape as every other uk vocabulary keeps the row comparable.
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [percentUk]), [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Ukrainian percentages", () => {
    const e = engine();
    // The plural boundary. 2 takes the nominative plural and 5 the genitive
    // plural, and *both* answer with the symbol — that identical output is the
    // point of a symbol-only unit, and it is only reachable because the aliases
    // spell out the whole paradigm the CLDR categories select between.
    expect(e.evaluate("2 відсотки").formatted).toBe("2%");
    expect(e.evaluate("5 відсотків").formatted).toBe("5%");
    // The fractional row — genitive singular on the way in, "," as the decimal
    // mark on the way out, both read from CLDR by `numberFormat: "intl"`.
    expect(e.evaluate("1,5 відсотка").formatted).toBe("1,5%");
    // Grouped output: U+00A0, written as an escape because a literal NBSP is
    // invisible in source and degrades to a plain space when someone retypes it.
    expect(e.evaluate("2000 відсотків").formatted).toBe("2\u00A0000%");
    // The loan-word family reads too, and answers in the same symbol.
    expect(e.evaluate("20 процентів").formatted).toBe("20%");
    // Both scripts read: a Ukrainian engine still takes the Latin aliases the
    // one alias map in `units.ts` declares.
    expect(e.evaluate("50 pct").formatted).toBe("50%");
    // The `of` operator through its Ukrainian keyword ("від").
    expect(e.evaluate("20% від 50").formatted).toBe("10");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather
  // than a unit-to-unit change — percent has exactly one unit, so the only
  // conversion it can be the target of comes from outside the kind. It needs
  // `number` registered, and "у відсотках" is the locative plural: that is the
  // case `в`/`у` governs, and reaching the conversion-target slot through the
  // word rather than through "%" is what proves the inflected aliases are
  // indexed and not merely listed.
  test("reads a conversion into percent, in either script", () => {
    const e = createEngine({
      locales: [composeLocale(ukrainian, [percentUk])],
      kinds: [percent, number],
    });
    expect(e.evaluate("5 / 50 у відсотках").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 в %").formatted).toBe("10%");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Nothing grouped: the thousands separator is a space, and no lexer reads
    // "2 000%" back as one quantity — a limitation of grouped output, not of
    // this vocabulary, which is why the 2000 case above is asserted as a string
    // instead of round-tripped.
    for (const input of ["2 відсотки", "5 відсотків", "1,5 відсотка", "20 процентів"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
