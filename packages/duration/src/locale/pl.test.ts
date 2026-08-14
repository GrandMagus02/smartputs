import { describe, expect, test } from "bun:test";
import { aliasesFor, composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import { DURATION_UNITS, type DurationUnit } from "../units";
import durationPl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [durationPl])],
    kinds: [duration],
  });

/** The key `polish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  polish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "duration",
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

describe("duration pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationPl.units)) {
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
    const descriptor = JSON.stringify(duration);
    expect(descriptor).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
    for (const stem of ["godzin", "sekund", "minut", "dzie", "tydz", "tygod"]) {
      expect(descriptor, `the kind names "${stem}"`).not.toContain(stem);
    }
  });

  test("every unit carries exactly the eight keys `selectForm` can produce", () => {
    // All six units are nouns a Polish speaker writes out — none of them is a
    // symbol-only compound the way `speed`'s "km/h" is — so the assertion is
    // unconditional.
    for (const unit of Object.keys(durationPl.units)) {
      expect(Object.keys(durationPl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `polish`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 h w godzinie" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. In Polish this is the check with the most to
  // catch: the locative singular softens the stem ("minucie", "sekundzie"), the
  // feminine genitive plural is a bare stem with nothing to strip ("godzin"),
  // and `tydzień` changes stem outright ("tygodni"). None of those three is
  // reachable from the nominative singular by any ending table.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(durationPl.units)) {
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
      assertLocaleContract(composeLocale(polish, [durationPl]), [duration]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong, since those two rows hold different
    // words and one word in both would still be eight keys.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [durationPl]), [duration], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four decisions, and gender decides which coincide", () => {
    // The feminine paradigm spells its nominative plural and its genitive
    // singular alike, so `nom-few` and `nom-other` coincide for `godzina` — a
    // fact about the first declension, not about the categories.
    const h = durationPl.units.h?.forms;
    expect(h?.[key("h", "after-number", 1)]).toBe("godzina");
    expect(h?.[key("h", "after-number", 2)]).toBe("godziny");
    expect(h?.[key("h", "after-number", 5)]).toBe("godzin");
    expect(h?.[key("h", "after-number", 1.5)]).toBe("godziny");
    // The masculines are where the two cells come apart, and they come apart
    // differently from each other. `dzień` has one spelling "dni" for both its
    // nominative and its genitive plural, so `nom-few` and `nom-many` coincide
    // while `nom-other` stands alone.
    const d = durationPl.units.d?.forms;
    expect(d?.[key("d", "after-number", 1)]).toBe("dzień");
    expect(d?.[key("d", "after-number", 2)]).toBe("dni");
    expect(d?.[key("d", "after-number", 5)]).toBe("dni");
    expect(d?.[key("d", "after-number", 1.5)]).toBe("dnia");
    // `tydzień` keeps all four apart, and changes stem outright to do it.
    const wk = durationPl.units.wk?.forms;
    expect(wk?.[key("wk", "after-number", 1)]).toBe("tydzień");
    expect(wk?.[key("wk", "after-number", 2)]).toBe("tygodnie");
    expect(wk?.[key("wk", "after-number", 5)]).toBe("tygodni");
    expect(wk?.[key("wk", "after-number", 1.5)]).toBe("tygodnia");
    // The feminine genitive plural is a bare stem — no ending at all where a
    // masculine takes -ów — so there is nothing for a stripper to remove and it
    // has to be listed.
    expect(durationPl.units.min?.forms?.[key("min", "after-number", 5)]).toBe("minut");
    expect(durationPl.units.ms?.forms?.[key("ms", "after-number", 5)]).toBe("milisekund");
  });

  test("21 is `many`, which is where Polish leaves Ukrainian and Russian", () => {
    // Both neighbours agree 21 with the singular ("21 година", "21 час"); Polish
    // says "dwadzieścia jeden godzin", a genitive plural, and every -1 above
    // twenty goes the same way.
    expect(key("h", "after-number", 21)).toBe("nom-many");
    expect(key("h", "after-number", 101)).toBe("nom-many");
    // The teens are `many` for the ordinary Slavic reason, and 22 goes back to
    // `few` — the boundary follows the final digit except across 12–14.
    expect(key("h", "after-number", 11)).toBe("nom-many");
    expect(key("h", "after-number", 22)).toBe("nom-few");
    expect(key("h", "after-number", 0)).toBe("nom-many");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "w godzinach", the row a one-dimensional plural
    // table had no cell for.
    const h = durationPl.units.h?.forms;
    expect(h?.[key("h", "after-number", 5)]).toBe("godzin");
    expect(h?.[key("h", "conversion-target", 5)]).toBe("godzinach");
    expect(key("h", "conversion-target")).toBe("loc-other");
    expect(h?.[key("h", "conversion-target")]).toBe("godzinach");
    // The locative singular is its own ending, and for three of the four
    // feminines it softens the stem too: "w 1 minucie", "w 1 sekundzie".
    expect(h?.[key("h", "conversion-target", 1)]).toBe("godzinie");
    expect(durationPl.units.min?.forms?.[key("min", "conversion-target", 1)]).toBe(
      "minucie",
    );
    expect(durationPl.units.s?.forms?.[key("s", "conversion-target", 1)]).toBe(
      "sekundzie",
    );
    // The two `-other` rows hold different words wherever the noun distinguishes
    // them, which is the trap `polish.selectForm` documents: a genitive singular
    // for the fraction, a locative plural for the countless target.
    expect(durationPl.units.d?.forms?.["nom-other"]).not.toBe(
      durationPl.units.d?.forms?.["loc-other"],
    );
  });

  test("an engine built from it reads and writes Polish duration", () => {
    const e = engine();
    // The numeral boundary, all the way across it.
    expect(e.evaluate("1 godzina").formatted).toBe("1 godzina");
    expect(e.evaluate("2 godziny").formatted).toBe("2 godziny");
    expect(e.evaluate("5 godzin").formatted).toBe("5 godzin");
    // 21 is `many` in Polish, so this reads "21 godzin" where a table ported
    // from Ukrainian or Russian would print the nominative singular.
    expect(e.evaluate("21 godzin").formatted).toBe("21 godzin");
    // A sum that lands on a fraction — the assertion that would read
    // "1,5 godzin" if `nom-other` held a plural instead of the genitive
    // singular it is.
    expect(e.evaluate("1 h + 30 min").formatted).toBe("1,5 godziny");
    // The same fraction reached by a conversion rather than a sum.
    expect(e.evaluate("90 min w godzinach").formatted).toBe("1,5 godziny");
    // Two conversions across the units whose stems change: "dni" is one spelling
    // for two plural cells, and a week in days shows the `tygodni-` stem going
    // in and "dni" coming out.
    expect(e.evaluate("2 dni w godzinach").formatted).toBe("48 godzin");
    expect(e.evaluate("1 tydzień w dniach").formatted).toBe("7 dni");
    expect(e.evaluate("5 tygodni").formatted).toBe("5 tygodni");
    // The feminine bare-stem genitive plural, and the grouping that comes with a
    // conversion into a small unit. Polish groups thousands with U+00A0, written
    // as an escape because a literal NBSP is invisible in source.
    expect(e.evaluate("500 ms").formatted).toBe("500 milisekund");
    expect(e.evaluate("1 h w sekundach").formatted).toBe("3\u00A0600 sekund");
    // Both spellings read: a Polish developer types "2 h" without thinking about
    // it, and gets Polish back.
    expect(e.evaluate("2 h").formatted).toBe("2 godziny");
    // The dotless contractions, which are the symbols this vocabulary prints
    // because "godz." and "tyg." carry a dot the lexer would end the token on.
    expect(e.evaluate("3 godz").formatted).toBe("3 godziny");
    expect(e.evaluate("3 tyg").formatted).toBe("3 tygodnie");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose. Polish groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "3\u00A0600 sekund" would come back
    // as two numbers if `lex` did not accept that folded separator for a
    // language whose own separator is a non-breaking space. This is the one
    // input a Polish engine is guaranteed to be handed: its own output.
    for (const input of [
      "1 godzina",
      "5 godzin",
      "21 godzin",
      "1 h + 30 min",
      "2 dni w godzinach",
      "1 tydzień w dniach",
      "500 ms",
      "1 h w sekundach",
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
    // What keeps the micro path (`parseDuration`) and the engine path in step:
    // every alias `units.ts` declares for a unit is still an alias of that unit
    // here, and the Polish spellings are an addition rather than a replacement.
    for (const unit of Object.keys(durationPl.units) as DurationUnit[]) {
      for (const derived of aliasesFor(DURATION_UNITS, unit)) {
        expect(durationPl.units[unit]?.aliases, `${unit} dropped "${derived}"`).toContain(
          derived,
        );
      }
    }
  });
});
