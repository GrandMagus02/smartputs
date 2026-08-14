import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentPl from "./pl";

const locale = composeLocale(polish, [percentPl]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/**
 * Anything only Polish would write. Polish shares the Latin alphabet, so — unlike
 * Ukrainian's Cyrillic range — this cannot on its own prove that no Polish word
 * leaked into the language-free half, and the test that uses it greps for the
 * word itself as well.
 */
const POLISH = /[ąćęłńóśźż]/i;

describe("percent pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentPl.units).sort()).toEqual(units.sort());
    expect(percentPl.locale).toBe("pl");
    expect(percentPl.kind).toBe("percent");
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is one ratio and one unit id, so nothing but ASCII machinery may reach it. A
  // Polish diacritic or the word this file is built around anywhere in the
  // descriptor would mean a translation had leaked into the half of the package
  // that is supposed to be language-free.
  test("the kind itself carries no Polish word", () => {
    expect(JSON.stringify(percent)).not.toMatch(POLISH);
    expect(JSON.stringify(percent)).not.toMatch(/procent/i);
  });

  // No `forms`, and for `en`'s reason rather than `area`'s: Polish really does
  // decline "procent", but the written form of this unit is the symbol. Where the
  // `en` unit decided against word forms, this file does not invent them —
  // otherwise every percentage in a Polish engine's output would read as a word,
  // and the printer's spelled path would be offering completion text no one wants
  // to type.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentPl.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  // `selectForm` answers all the same — it is a function of the count and the slot
  // and knows nothing about which units carry tables — so what makes the two-axis
  // grammar unreachable here is the missing `forms`, not a missing key. The rows
  // named are the four Polish words this unit would have owed, and the third of
  // them is the bare-stem genitive plural that separates Polish from both its
  // Slavic neighbours: "5 procent", where Russian writes "5 процентов".
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      polish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one"); // "1 procent"
    expect(key(2, "after-number")).toBe("nom-few"); // "2 procenty"
    expect(key(5, "after-number")).toBe("nom-many"); // "5 procent"
    // 21 goes with 5 and not with 1, which is where Polish leaves Ukrainian —
    // and this particular noun hides it, because its genitive plural is the bare
    // stem and therefore spelled exactly like its nominative singular. "21
    // procent" and "1 procent" look identical on the page and are two different
    // grammatical rows, which is why the split is pinned here at the key rather
    // than in the printed output below, where it would be invisible.
    expect(key(21, "after-number")).toBe("nom-many");
    expect(key(1.5, "after-number")).toBe("nom-other"); // "1,5 procenta"
    expect(key(5, "conversion-target")).toBe("loc-many"); // "w procentach"
    expect(key(undefined, "conversion-target")).toBe("loc-other");
    expect(percentPl.units["%"]?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach — the default counts are all integers and
    // never touch CLDR's `other` category at all. The sweep is skipped here, but
    // the alias half of the contract is what carries this kind, and running the
    // same call shape as every other `pl` vocabulary keeps the row comparable.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Polish percentages", () => {
    const e = engine();
    // Every expected string below is spaced — "2 %", not "2%" — and that is
    // `polish.renderQuantity` rather than this vocabulary: the language sets a
    // symbol off from its number by a space, which is PN-EN ISO 80000, the same
    // standard that gives "5 kg" its space. Ordinary Polish copy writes "20%"
    // tight, so this is the standard's spelling rather than the commonest one; it
    // is pinned here because a vocabulary has no say in the separator and the
    // only way to "fix" it from this file would be to lie about the symbol.
    //
    // The plural boundary. 2 takes the nominative plural and 5 the genitive
    // plural — which in this noun is the *bare stem*, identical to the nominative
    // singular — and both answer with the symbol. That identical output is the
    // point of a symbol-only unit, and it is only reachable because the aliases
    // spell out the whole paradigm the CLDR categories select between.
    expect(e.evaluate("2 procenty").formatted).toBe("2 %");
    expect(e.evaluate("5 procent").formatted).toBe("5 %");
    // 21, the row Polish counts by its final 1 the way it counts 5: "21 procent",
    // where a table ported from Ukrainian would have expected a singular.
    expect(e.evaluate("21 procent").formatted).toBe("21 %");
    // The fractional row, which in Polish is the genitive singular — a different
    // word from both rows above, where Russian's fractional row and its 2/3/4 row
    // are one and the same.
    expect(e.evaluate("1,5 procenta").formatted).toBe("1,5 %");
    // Grouped output: U+00A0, written as an escape because a literal NBSP is
    // invisible in source and degrades to a plain space when someone retypes it.
    expect(e.evaluate("2000 procent").formatted).toBe("2\u00A0000 %");
    // The press abbreviation, without its full stop: `lex` ends a word token at
    // the period, so "proc." reaches the resolver as "proc".
    expect(e.evaluate("20 proc").formatted).toBe("20 %");
    // The locative singular with its t→c alternation, which no suffix rule could
    // have recovered — stripping "ie" from "procencie" leaves "procenc", a string
    // in no index.
    expect(e.evaluate("1 procencie").formatted).toBe("1 %");
    // Both spellings read: a Polish engine still takes the Latin aliases the one
    // alias map in `units.ts` declares.
    expect(e.evaluate("50 pct").formatted).toBe("50 %");
    // The `of` operator through its Polish keyword. "z" is the partitive, and
    // `off` is left unclaimed entirely — "20% zniżki na 50" is a noun phrase whose
    // preposition is already spoken for as `in`.
    expect(e.evaluate("20% z 200").formatted).toBe("40");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion
  // it can be the target of comes from outside the kind. It needs `number`
  // registered, and it is where the three prepositions Polish spells `in` with pay
  // off: they govern three different cases, and a target reachable through only
  // one of them stops resolving when the user picks another word.
  test("reads a conversion into percent, through every preposition", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    // "w" governs the locative — the case `polish.selectForm` maps
    // `conversion-target` onto, because "w" is the word generation emits.
    expect(e.evaluate("5 / 50 w procentach").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 w %").formatted).toBe("10 %");
    // "na" governs the accusative and "do" the genitive, and both are read-only
    // spellings of the same keyword.
    expect(e.evaluate("5 / 50 na procenty").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 do procent").formatted).toBe("10 %");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Nothing grouped: the thousands separator is U+00A0, `normalize()` folds it
    // to a plain space, and no lexer reads "2 000%" back as one quantity — a
    // limitation of grouped output, not of this vocabulary, which is why the 2000
    // case above is asserted as a string instead of round-tripped.
    for (const input of [
      "2 procenty",
      "5 procent",
      "21 procent",
      "1,5 procenta",
      "20 proc",
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
