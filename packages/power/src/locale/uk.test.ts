import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerUk from "./uk";

const engine = () =>
  createEngine({
    locales: [composeLocale(ukrainian, [powerUk])],
    kinds: [power],
  });

/** The key `ukrainian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  ukrainian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "power",
    unit,
    slot,
  });

describe("power uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Ukrainian word either", () => {
    expect(JSON.stringify(power)).not.toMatch(/ват|кінськ/);
  });

  test("every unit has forms, and every one has all eight keys", () => {
    // All five units carry a table, matching the call `en.ts` makes for the same
    // five. The contract check below samples counts and slots and reports what it
    // happened to miss; this states the shape directly, so a table with seven
    // rows fails on the count rather than on a lucky sample.
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
    for (const [unit, words] of Object.entries(powerUk.units)) {
      expect(words.forms, `${unit} has no forms`).toBeDefined();
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual([...eight].sort());
    }
  });

  test("the composed locale satisfies the locale contract", () => {
    assertLocaleContract(composeLocale(ukrainian, [powerUk]), [power]);
  });

  test("an engine built from it reads and writes Ukrainian power", () => {
    const e = engine();
    // Cyrillic in, Cyrillic out, across the plural boundary Ukrainian has and
    // English does not: 2 takes the "few" form, 5 the "many" one.
    expect(e.evaluate("2 кВт").formatted).toBe("2 кіловати");
    expect(e.evaluate("5 кВт").formatted).toBe("5 кіловатів");
    // 21 is back on "one" — Ukrainian agreement follows the last digit, so this
    // is "21 ват" and not the "21 ватів" a naive n > 1 rule would print.
    expect(e.evaluate("21 Вт").formatted).toBe("21 ват");
    // The fractional row. `nom-other` is the genitive *singular*, so this reads
    // "1,5 кіловата" — printing "1,5 кіловатів" here is the exact mistake the
    // eight-key table exists to prevent.
    expect(e.evaluate("1,5 кВт").formatted).toBe("1,5 кіловата");
    // A conversion, with the Ukrainian preposition and the Ukrainian group
    // separator (U+00A0, written as an escape so it survives being retyped).
    expect(e.evaluate("1 кВт у ватах").formatted).toBe("1\u00A0000 ватів");
    // Both scripts read: a Cyrillic spelling and a Latin one add up.
    expect(e.evaluate("1 кВт + 500 Вт").formatted).toBe("1,5 кіловата");
    expect(e.evaluate("2 kw").formatted).toBe("2 кіловати");
    // "кінська сила" is two words, and both of them inflect: the adjective
    // agrees with the noun through the nominative singular, the nominative
    // plural, the genitive plural after 5, and the genitive singular in the
    // fractional row. English's "horsepower" is invariant, so this is the unit
    // that shows the two axes doing work a plural table could not.
    expect(e.evaluate("1 hp").formatted).toBe("1 кінська сила");
    expect(e.evaluate("2 hp").formatted).toBe("2 кінські сили");
    expect(e.evaluate("5 hp").formatted).toBe("5 кінських сил");
    expect(e.evaluate("1,5 hp").formatted).toBe("1,5 кінської сили");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — the row a one-dimensional plural table could not
    // hold, because there is nothing to count "ватах" by in "1 кВт у ватах".
    const kw = powerUk.units.kw?.forms;
    expect(kw?.[key("kw", "after-number", 5)]).toBe("кіловатів");
    expect(kw?.[key("kw", "conversion-target", 5)]).toBe("кіловатах");
    expect(key("kw", "conversion-target")).toBe("loc-other");
    expect(kw?.[key("kw", "conversion-target")]).toBe("кіловатах");
  });

  test("the horsepower phrase prints but does not read back yet", () => {
    // Recorded as an assertion rather than left in a comment. `parse/lex.ts`
    // builds a word token out of a run of letters plus trailing digits, so a
    // space ends the token: "2 кінські сили" arrives as "кінські" followed by
    // "сили", and no alias can claim a two-token unit. "к.с." — the abbreviation
    // Ukrainian actually writes — fares no better, because "." is skipped as an
    // unrecognized character and the run reaches the resolver as "к" then "с".
    // Neither spelling is registered as an alias: one the lexer cannot produce
    // would read as coverage while doing nothing. The Latin "hp" is what reads
    // today; splitting the phrase is P5's `compoundSplitter`, and when it lands
    // this is the test that should start failing.
    const e = engine();
    expect(() => e.evaluate("2 кінські сили")).toThrow();
    expect(() => e.evaluate("150 к.с.")).toThrow();
    expect(powerUk.units.hp?.aliases).toEqual(["hp", "horsepower"]);
  });

  test("round-trips: reparsing the formatted text gives the same quantity", () => {
    // Every input here converts to something under a thousand, or stays there.
    // Ukrainian groups with U+00A0 and `parse/normalize.ts` folds every `\s` —
    // NBSP included — to a plain space before `lex()` sees it, so the
    // "1 000 ватів" the conversion above prints comes back as two numbers and
    // fails to parse. That is a core-level gap between the group separator and
    // the normalizer, not something a vocabulary can express its way out of, so
    // it is reported rather than pinned here. `hp` is absent for the reason the
    // test above states: its printed form is two tokens.
    const e = engine();
    for (const input of ["1,5 кВт", "5 Вт", "21 Вт", "500 Вт в кіловатах", "3 ГВт"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value, input).toEqual(first.value);
    }
  });
});
