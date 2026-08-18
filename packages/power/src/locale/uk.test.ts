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

  test("the four declined units have forms, and each has all eight keys", () => {
    // The four watt units carry a table; `hp` deliberately carries none and
    // renders through its symbol, the way `area`'s squared units and every
    // `temperature` unit do. The contract check below samples counts and slots
    // and reports what it happened to miss; this states the shape directly, so a
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
    for (const [unit, words] of Object.entries(powerUk.units)) {
      if (unit === "hp") {
        expect(
          words.forms,
          "hp must not carry forms it cannot read back",
        ).toBeUndefined();
        continue;
      }
      expect(words.forms, `${unit} has no forms`).toBeDefined();
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual([...eight].sort());
    }
  });

  test("every form this file can print is a form it can read", () => {
    // The invariant that caught the horsepower bug, and the reason it is stated
    // here rather than left to `assertLocaleContract`: the contract walks every
    // *alias* and checks it resolves back to its unit, which is a different set
    // from the strings the printer can *emit*. `hp` passed the contract with
    // eight `forms` rows none of which was an alias, so the engine could not
    // read its own output and nothing failed. Aliases fold case, so compare
    // folded.
    for (const [unit, words] of Object.entries(powerUk.units)) {
      const readable = new Set(words.aliases.map((a) => a.toLocaleLowerCase("uk")));
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          readable.has(form.toLocaleLowerCase("uk")),
          `${unit}.${key} = "${form}"`,
        ).toBe(true);
      }
      expect(
        readable.has((words.symbol ?? "").toLocaleLowerCase("uk")),
        `${unit}.symbol`,
      ).toBe(true);
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
    // `hp` renders through its symbol, tight against the number — the count
    // never reaches a `forms` table because there is none, so all four of these
    // are the same string with a different number in front.
    expect(e.evaluate("1 hp").formatted).toBe("1 кс");
    expect(e.evaluate("5 hp").formatted).toBe("5 кс");
    expect(e.evaluate("1,5 hp").formatted).toBe("1,5 кс");
    // And the Cyrillic spelling reads, which before this it could not: `aliases`
    // was the Latin pair alone, so a Ukrainian keyboard had no way to write this
    // unit at all.
    expect(e.evaluate("150 кс").formatted).toBe("150 кс");
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

  test("the two spellings that cannot be the symbol, and why", () => {
    // The measurements behind the `hp` entry, kept live so the reasoning cannot
    // rot into a comment that used to be true.
    //
    // The inflected phrase: `parse/lex.ts` builds a word token from a run of
    // letters plus trailing digits, so a space ends the token and "2 кінські
    // сили" arrives as "кінські" then "сили". Registering the adjective does not
    // help — the stranded noun fails the parse anyway, which is why none of the
    // phrase's words are aliases. Splitting it is P5's `compoundSplitter`.
    //
    // "к.с.": the abbreviation Ukrainian actually writes, and unusable as the
    // symbol because "." is not a letter — it is skipped as unrecognized, and
    // the input reaches the resolver as "к" then "с". "кс" is that spelling with
    // the dots removed, which is the one form of it the lexer can hand back.
    const e = engine();
    expect(() => e.evaluate("2 кінські сили")).toThrow();
    expect(() => e.evaluate("150 к.с.")).toThrow(/Unknown unit "к"/);
    expect(powerUk.units.hp?.aliases).toEqual(["hp", "horsepower", "кс"]);
    expect(powerUk.units.hp?.symbol).toBe("кс");
  });

  test("round-trips: reparsing the formatted text gives the same quantity", () => {
    // Every input here converts to something under a thousand, or stays there.
    // Ukrainian groups with U+00A0 and `parse/normalize.ts` folds every `\s` —
    // NBSP included — to a plain space before `lex()` sees it, so the
    // "1 000 ватів" the conversion above prints comes back as two numbers and
    // fails to parse. That is a core-level gap between the group separator and
    // the normalizer, not something a vocabulary can express its way out of, so
    // it is reported rather than pinned here.
    const e = engine();
    for (const input of ["1,5 кВт", "5 Вт", "21 Вт", "500 Вт в кіловатах", "3 ГВт"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value, input).toEqual(first.value);
    }
  });

  test("every unit prints something it can read, at every plural category", () => {
    // The sweep the round-trip test above does not do: all five units, all four
    // categories `ukrainian.selectForm` can return, print then re-read. This is
    // what the horsepower bug failed and what nothing in this file checked. The
    // counts stay under a thousand so no group separator appears — that gap is
    // core's, not this vocabulary's, and pinning it here would hide this.
    const e = engine();
    for (const unit of Object.keys(powerUk.units)) {
      for (const n of ["1", "2", "5", "1,5"]) {
        const printed = e.evaluate(`${n} ${unit}`).formatted;
        const again = e.evaluate(printed);
        expect(again.formatted, `${n} ${unit} -> ${printed}`).toBe(printed);
      }
    }
  });
});
