import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentRu from "./ru";

const locale = composeLocale(russian, [percentRu]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

describe("percent ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentRu.units).sort()).toEqual(units.sort());
    expect(percentRu.locale).toBe("ru");
    expect(percentRu.kind).toBe("percent");
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so no script but ASCII may reach it.
  // Cyrillic anywhere in the descriptor would mean a translation had leaked into
  // the half of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(percent)).not.toMatch(/[Ѐ-ӿ]/);
  });

  // No `forms`, and for `en`'s reason rather than `area`'s: Russian really does
  // decline "процент", but the written form of this unit is the symbol. Where
  // the `en` unit decided against word forms, this file does not invent them —
  // otherwise every percentage in a Russian engine's output would read as a
  // word, and the printer's spelled path would be offering completion text no
  // one wants to type.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentRu.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  // `selectForm` answers all the same — it is a function of the count and the
  // slot and knows nothing about which units carry tables — so what makes the
  // two-axis grammar unreachable here is the missing `forms`, not a missing key.
  // The four rows named are the four Russian words this unit would have owed:
  // "1 процент", "2 процента", "5 процентов", "1,5 процента".
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number, slot: "after-number" | "conversion-target") =>
      russian.selectForm({ count: new Decimal(count), kind: "percent", unit: "%", slot });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(2, "after-number")).toBe("nom-few");
    expect(key(5, "after-number")).toBe("nom-many");
    expect(key(1.5, "after-number")).toBe("nom-other");
    expect(key(5, "conversion-target")).toBe("loc-many");
    expect(percentRu.units["%"]?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach — the default counts are all integers
    // and never touch CLDR's `other` category at all. The sweep is skipped here,
    // but the alias half of the contract is what carries this kind, and running
    // the same call shape as every other `ru` vocabulary keeps the row
    // comparable.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Russian percentages", () => {
    const e = engine();
    // The plural boundary. 2 takes the genitive singular and 5 the genitive
    // plural, and *both* answer with the symbol — that identical output is the
    // point of a symbol-only unit, and it is only reachable because the aliases
    // spell out the whole paradigm the CLDR categories select between.
    expect(e.evaluate("2 процента").formatted).toBe("2%");
    expect(e.evaluate("5 процентов").formatted).toBe("5%");
    // The fractional row, which in Russian is spelled exactly like the 2/3/4 row
    // above — both are the genitive singular, and they are the same word for two
    // different grammatical reasons. Ukrainian's are two different words, which
    // is the porting trap `ru.ts` records.
    expect(e.evaluate("1,5 процента").formatted).toBe("1,5%");
    // Grouped output: U+00A0, written as an escape because a literal NBSP is
    // invisible in source and degrades to a plain space when someone retypes it.
    expect(e.evaluate("2000 процентов").formatted).toBe("2\u00A0000%");
    // The technical abbreviation, without its full stop: `lex` ends a word token
    // at the period, so "проц." reaches the resolver as "проц".
    expect(e.evaluate("20 проц").formatted).toBe("20%");
    // Both scripts read: a Russian engine still takes the Latin aliases the one
    // alias map in `units.ts` declares.
    expect(e.evaluate("50 pct").formatted).toBe("50%");
    // The `of` operator through its Russian keyword. Russian has exactly one
    // word for the partitive, "от", where `off` is left unclaimed entirely —
    // "скидка 20% на 50" is a noun phrase, not an operator.
    expect(e.evaluate("20% от 50").formatted).toBe("10");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather
  // than a unit-to-unit change — percent has exactly one unit, so the only
  // conversion it can be the target of comes from outside the kind. It needs
  // `number` registered, and "в процентах" is the prepositional plural: that is
  // the case `в` governs, and reaching the conversion-target slot through the
  // word rather than through "%" is what proves the inflected aliases are
  // indexed and not merely listed.
  test("reads a conversion into percent, in either script", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 / 50 в процентах").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 в %").formatted).toBe("10%");
    // "до" is Russian's second spelling of `in`, and it governs the genitive
    // rather than the prepositional — which is why both cases are listed as
    // aliases and neither is recovered from the other.
    expect(e.evaluate("5 / 50 до процентов").formatted).toBe("10%");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Nothing grouped: the thousands separator is U+00A0, `normalize()` folds it
    // to a plain space, and no lexer reads "2 000%" back as one quantity — a
    // limitation of grouped output, not of this vocabulary, which is why the
    // 2000 case above is asserted as a string instead of round-tripped.
    for (const input of ["2 процента", "5 процентов", "1,5 процента", "20 проц"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
