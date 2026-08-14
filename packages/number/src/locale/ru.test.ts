import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberRu from "./ru";

const locale = composeLocale(russian, [numberRu]);
const engine = createEngine({ locales: [locale], kinds: [number] });

describe("number ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberRu.units).sort()).toEqual(units.sort());
    expect(numberRu.locale).toBe("ru");
    expect(numberRu.kind).toBe("number");
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is a ratio and a unit id, so no script but ASCII may reach it. Cyrillic
  // in the descriptor would mean a translation had leaked into the half of the
  // package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(number)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `russian.selectForm`'s `other`
    // category — the *fractional* row, "1,5 килограмма" next door — is never
    // reached through a fraction at all. A fractional count is added for the same
    // reason every other `ru` vocabulary adds one, except that here it can only
    // confirm the absence of a `forms` table: a unit with none is skipped before
    // any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // The contract check above is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself. Russian's `selectForm` would
  // demand all eight of its `${case}-${category}` keys the moment one appeared,
  // and inventing them for a unit nobody spells is the failure the file next door
  // argues against in prose. Assert it in code too, so a later edit has to face
  // it.
  test("declares no forms, in either script", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberRu.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
    }
    expect(JSON.stringify(numberRu)).not.toMatch(/[Ѐ-ӿ]/);
  });

  // `selectForm` still answers for this unit — it is a function of the count and
  // the slot and knows nothing about which units have tables — so the reason the
  // two-axis grammar is unexercised here is the missing `forms`, not a missing
  // key. Pinning it keeps the "no word moves" tests below honest: they assert
  // output does not change across the plural boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number, slot: "after-number" | "conversion-target") =>
      russian.selectForm({
        count: new Decimal(count),
        kind: "number",
        unit: "one",
        slot,
      });
    expect(key(2, "after-number")).toBe("nom-few");
    expect(key(5, "after-number")).toBe("nom-many");
    expect(key(1.5, "after-number")).toBe("nom-other");
    expect(key(5, "conversion-target")).toBe("loc-many");
    expect(numberRu.units.one?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Russian numbers", () => {
    // Russian marks the decimal with "," — so the English "1.5" is not a number
    // in this locale at all, and "1,5" is.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    expect(() => engine.evaluate("1.5")).toThrow();
    // Thousands group with U+00A0, read out of CLDR by `numberFormat: "intl"`.
    // Written as an escape on purpose: a literal non-breaking space is invisible
    // in source and degrades to a plain one when someone retypes it.
    //
    // Output only. This exact string does NOT read back, and the cause is
    // upstream of this file: `normalize()` folds U+00A0 to a plain space, and
    // `lex` then looks for `numberSymbols(ru).group` — still U+00A0 — inside the
    // digit run and never finds it, so "2 000" lexes as two adjacent numbers.
    // Nothing a vocabulary can reach fixes it, so the round-trip below stays
    // under the grouping boundary. Do not "fix" it by weakening the assertion.
    expect(engine.evaluate("2000").formatted).toBe("2\u00A0000");
    // Russian cardinals in, Russian digits out. `russianSpeller` and
    // `russian.numerals` read the one set of tables in `ru-cardinals.ts`, which
    // is what keeps "двадцать два" the same 22 in both directions.
    expect(engine.evaluate("двадцать два плюс один").formatted).toBe("23");
    // The hundreds are fused words in Russian and the scale words agree with
    // their multiplier — "двести пятьдесят", "две тысячи" — which is exactly why
    // `ru.ts` hand-writes its speller instead of taking the shared one.
    expect(engine.evaluate("двести пятьдесят минус сто пять").formatted).toBe("145");
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for both, which is the whole of what it contributes to
  // the Russian phase: nothing is appended after the numeral, so 2 (nom-few) and
  // 5 (nom-many) are byte-identical to their own digits.
  test("the 2/5 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("2").formatted).toBe("2");
    expect(engine.evaluate("5").formatted).toBe("5");
    // A conversion, where `russian.selectForm` asks for a prepositional — "в 5
    // килограммах" is the shape this slot has next door. Here the target word
    // vanishes and the numeral is all that prints.
    expect(engine.evaluate("2 one в one").formatted).toBe("2");
    expect(engine.evaluate("5 one в one").formatted).toBe("5");
    // And the fractional row, which in every inflecting sibling is a genitive
    // singular and here is again just the digits.
    expect(engine.evaluate("1,5 one в one").formatted).toBe("1,5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Russian claims the
  // Latin word — `CARDINALS` is Cyrillic throughout — so here the self-alias is
  // live, which is the alias earning its keep, since `formatNumber` emits
  // exactly this string.
  test("the Latin self-alias is live under ru, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  // Three inputs: a fractional (the "," decimal), a spelled cardinal, and the
  // facade's own `${raw}one` string. All three stay under 1000 on purpose — see
  // the grouping note above for the reason a four-digit result cannot.
  test("round-trips its own output", () => {
    for (const input of ["1,5", "двадцать два плюс один", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
