import { describe, expect, test } from "bun:test";
import { aliasesFor, composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";
import datasizePl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [datasizePl])],
    kinds: [datasize],
  });

/** The key `polish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  polish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "datasize",
    unit,
    slot,
  });

/**
 * Exactly what `polish.selectForm` can produce: `` `${case}-${category}` `` over
 * {nom, loc} × CLDR's four Polish categories. No more and no fewer — a table
 * with a ninth key is indexing something the engine will never ask for, and one
 * with seven has a cell that renders `undefined` at a user.
 */
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

describe("datasize pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizePl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizePl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `ru.test.ts`'s "the kind itself carries no Russian word", and
  // it needs two halves rather than one because Polish is written in the Latin
  // alphabet. A Cyrillic-block regex is a complete proxy for Russian — any
  // Cyrillic letter in the descriptor is a leak — and Polish has no such block
  // to point at. So the diacritics do the first half, and the vocabulary's own
  // distinctively Polish stems do the second.
  test("the kind itself carries no Polish word", () => {
    const descriptor = JSON.stringify(datasize);
    expect(descriptor).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
    for (const stem of ["bajt", "kilobajt", "kibibajt"]) {
      expect(descriptor, `the kind names "${stem}"`).not.toContain(stem);
    }
  });

  test("every unit carries exactly the eight keys `selectForm` can produce", () => {
    // All nine units are nouns a Polish speaker writes out — none of them is a
    // symbol-only unit the way `speed`'s compounds are — so the assertion is
    // unconditional.
    for (const unit of Object.keys(datasizePl.units)) {
      expect(Object.keys(datasizePl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `polish`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 kB w kilobajtach" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step, and
  // in Polish it is the check that catches the locative singular: the stem-final
  // `t` softens to `ci`, so "bajcie" shares no suffix boundary with "bajt" and
  // no ending table could have produced it.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(datasizePl.units)) {
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
      assertLocaleContract(composeLocale(polish, [datasizePl]), [datasize]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong, since those two rows hold different
    // words and one word in both would still be eight keys.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [datasizePl]), [datasize], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine hard stem. Unlike Russian, `nom-few` is a real nominative plural
    // and therefore a different word from the fractional row — "2 bajty" against
    // "1,5 bajta" — so a table ported from `ru.ts` by swapping stems collapses
    // two cells that Polish keeps apart.
    const b = datasizePl.units.b?.forms;
    expect(b?.[key("b", "after-number", 1)]).toBe("bajt");
    expect(b?.[key("b", "after-number", 2)]).toBe("bajty");
    expect(b?.[key("b", "after-number", 5)]).toBe("bajtów");
    expect(b?.[key("b", "after-number", 1.5)]).toBe("bajta");
    // The fractional row is the only one no integer can reach, which is why the
    // contract check above has to be run twice to see it at all.
    expect(key("b", "after-number", 1.5)).toBe("nom-other");
  });

  test("21 is `many`, which is where Polish leaves Ukrainian", () => {
    // Ukrainian agrees 21 with the singular ("21 байт") and Polish does not:
    // "dwadzieścia jeden bajtów" is a genitive plural, and every -1 above twenty
    // goes the same way. A table copied from `uk.ts` prints the nominative
    // singular in all of those cells, which reads as a typo rather than a bug.
    expect(key("b", "after-number", 21)).toBe("nom-many");
    expect(key("b", "after-number", 101)).toBe("nom-many");
    expect(key("b", "after-number", 1001)).toBe("nom-many");
    // The teens are `many` for the ordinary Slavic reason, and 22 goes back to
    // `few` — the boundary follows the final digit except across 12–14.
    expect(key("b", "after-number", 11)).toBe("nom-many");
    expect(key("b", "after-number", 14)).toBe("nom-many");
    expect(key("b", "after-number", 22)).toBe("nom-few");
    // Zero is `many` too, which is the row that would print "0 bajt" if the
    // table were keyed off the singular.
    expect(key("b", "after-number", 0)).toBe("nom-many");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "w bajtach", the row a one-dimensional plural table
    // had no cell for.
    const b = datasizePl.units.b?.forms;
    expect(b?.[key("b", "after-number", 5)]).toBe("bajtów");
    expect(b?.[key("b", "conversion-target", 5)]).toBe("bajtach");
    expect(key("b", "conversion-target")).toBe("loc-other");
    expect(b?.[key("b", "conversion-target")]).toBe("bajtach");
    // The locative singular is its own softened stem, so the case axis is not
    // one suffix applied to every count: "w 1 bajcie", not "w 1 bajtach".
    expect(b?.[key("b", "conversion-target", 1)]).toBe("bajcie");
    // And the two `-other` rows hold different words, which is the trap
    // `polish.selectForm` documents: a genitive singular for the fraction, a
    // locative plural for the countless target.
    expect(b?.["nom-other"]).not.toBe(b?.["loc-other"]);
  });

  test("an engine built from it reads and writes Polish datasize", () => {
    const e = engine();
    // The numeral boundary, all four categories of it.
    expect(e.evaluate("1 bajt").formatted).toBe("1 bajt");
    expect(e.evaluate("2 bajty").formatted).toBe("2 bajty");
    expect(e.evaluate("5 bajtów").formatted).toBe("5 bajtów");
    // 21 is `many` in Polish where it is `one` in Ukrainian, and 22 is `few`
    // again. These two lines are the ones a vocabulary ported from `uk.ts`
    // fails.
    expect(e.evaluate("21 bajtów").formatted).toBe("21 bajtów");
    expect(e.evaluate("22 bajty").formatted).toBe("22 bajty");
    // A sum that lands on a fraction — the input that would read
    // "1,5 kilobajtów" if `nom-other` held a plural instead of the genitive
    // singular it is.
    expect(e.evaluate("1 kb + 500 b").formatted).toBe("1,5 kilobajta");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line. Note that
    // `Intl.NumberFormat("pl")` would not group a four-digit number at all
    // (Polish sets minimumGroupingDigits to 2); core reads only the *symbols*
    // from CLDR and groups every three digits itself, which is what makes this
    // "1\u00A0000" rather than "1000".
    expect(e.evaluate("1 kb w bajtach").formatted).toBe("1\u00A0000 bajtów");
    // The binary family is a different unit, never a second name for the decimal
    // one, and 1024 is `few` in CLDR's Polish rules because the category follows
    // the last digit.
    expect(e.evaluate("1 kib w bajtach").formatted).toBe("1\u00A0024 bajty");
    // Both spellings read: a Polish engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Polish.
    expect(e.evaluate("5 kb").formatted).toBe("5 kilobajtów");
    expect(e.evaluate("5 kilobajtów").formatted).toBe("5 kilobajtów");
    // The genitive-singular doublet: a reader who writes "bajtu" is understood,
    // and generation still picks the "bajta" this table prints.
    expect(e.evaluate("1,5 bajtu").formatted).toBe("1,5 bajta");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversions are in this list on purpose. Polish groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "1\u00A0000 bajtów" would come back
    // as two numbers if `lex` did not accept that folded separator for a
    // language whose own separator is a non-breaking space. This is the one
    // input a Polish engine is guaranteed to be handed: its own output.
    for (const input of [
      "1 bajt",
      "2 bajty",
      "5 bajtów",
      "21 bajtów",
      "1 kb + 500 b",
      "1 kb w bajtach",
      "1 kib w bajtach",
      "5 kb",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the Latin aliases are derived, never retyped", () => {
    // What keeps the micro path (`parseDatasize`) and the engine path in step:
    // every alias `units.ts` declares for a unit is still an alias of that unit
    // here, and the Polish spellings are an addition rather than a replacement.
    for (const unit of Object.keys(datasizePl.units) as DatasizeUnit[]) {
      for (const derived of aliasesFor(DATASIZE_UNITS, unit)) {
        expect(datasizePl.units[unit]?.aliases, `${unit} dropped "${derived}"`).toContain(
          derived,
        );
      }
    }
  });
});
