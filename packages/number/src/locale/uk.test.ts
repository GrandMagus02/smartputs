import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberUk from "./uk";

const locale = composeLocale(ukrainian, [numberUk]);
const engine = createEngine({ locales: [locale], kinds: [number] });

describe("number uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
  });

  // The contract check above is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself. Ukrainian's `selectForm` would
  // demand all eight of its `${case}-${category}` keys the moment one appeared,
  // and inventing them for a unit nobody spells is the failure this file argues
  // against in prose. Assert it in code too, so a later edit has to face it.
  test("declares no forms, in either script", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberUk.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
    }
    expect(JSON.stringify(numberUk)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("an engine built from it reads and writes Ukrainian numbers", () => {
    // Ukrainian marks the decimal with "," — so the English "1.5" is not a
    // number in this locale at all, and "1,5" is.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    expect(() => engine.evaluate("1.5")).toThrow();
    // Thousands group with U+00A0, read out of CLDR by `numberFormat: "intl"`.
    // Written as an escape on purpose: a literal non-breaking space is
    // invisible in source and degrades to a plain one when someone retypes it.
    //
    // Output only. This exact string does NOT read back today, and the cause is
    // upstream of this file: `normalize()` runs NFKC, which folds U+00A0 to a
    // plain U+0020, and then `lex` looks for `numberSymbols(uk).group` \u2014 still
    // U+00A0 \u2014 inside the digit run and never finds it, so "2 000" lexes as two
    // adjacent numbers. English is immune because its group separator is ","
    // and NFKC leaves that alone. Nothing a vocabulary can reach fixes it, so
    // the round-trip below stays below the grouping boundary and this comment
    // is the record. Do not "fix" it by weakening the assertion.
    expect(engine.evaluate("2000").formatted).toBe("2\u00A0000");
    // Ukrainian cardinals in, Ukrainian digits out.
    expect(engine.evaluate("двадцять два плюс один").formatted).toBe("23");
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for both, which is the whole of what it contributes to
  // the Ukrainian phase: nothing is appended after the numeral, so 2 (nom-few)
  // and 5 (nom-many) are byte-identical to their own digits.
  test("the 2/5 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("2").formatted).toBe("2");
    expect(engine.evaluate("5").formatted).toBe("5");
    // A conversion, where `ukrainian.selectForm` asks for a locative — "в 5
    // кілограмах" is the shape this slot has next door. Here the target word
    // vanishes and the numeral is all that prints.
    expect(engine.evaluate("2 one в one").formatted).toBe("2");
    expect(engine.evaluate("5 one в one").formatted).toBe("5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal
  // parser claims "one" before the alias index sees it. Nothing in Ukrainian
  // claims the Latin word, so here the self-alias is live — which is the alias
  // earning its keep, since `formatNumber` emits exactly this string.
  test("the Latin self-alias is live under uk, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  // Three inputs: a fractional (the "," decimal), a spelled cardinal, and the
  // facade's own `${raw}one` string. All three stay under 1000 on purpose —
  // see the grouping note above for the reason a four-digit result cannot.
  test("round-trips its own output", () => {
    for (const input of ["1,5", "двадцять два плюс один", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
