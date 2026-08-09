import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleUk from "./uk";

const uk = composeLocale(ukrainian, [angleUk]);
const engine = createEngine({ locales: [uk], kinds: [angle] });

/** The eight keys `ukrainian.selectForm` can return — case × plural category. */
const KEYS = [
  "nom-one",
  "nom-few",
  "nom-many",
  "nom-other",
  "loc-one",
  "loc-few",
  "loc-many",
  "loc-other",
];

describe("angle uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("every unit carries all eight forms Ukrainian asks for", () => {
    // The reason Ukrainian is a phase of its own: English needs two keys here
    // and Ukrainian needs eight, and nothing above `forms` changed shape to
    // let it. A missing key does not throw at runtime — it renders the unit's
    // Latin alias at a reader — so it is asserted here rather than discovered.
    for (const [unit, words] of Object.entries(angleUk.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual([...KEYS].sort());
    }
  });

  test("every alias is unique within the kind, so no reading is ambiguous", () => {
    const seen = new Map<string, string>();
    for (const [unit, words] of Object.entries(angleUk.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by both ${seen.get(alias)} and ${unit}`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(angle)).not.toMatch(/радіан|градус|град|оберт/);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(uk, [angle])).not.toThrow();
  });

  test("an engine built from it reads and writes Ukrainian", () => {
    // 2 vs 5 is the plural boundary English does not have: `nom-few` is the
    // nominative plural and `nom-many` the genitive plural, and a language with
    // one plural category cannot tell them apart.
    expect(engine.evaluate("2 рад").formatted).toBe("2 радіани");
    expect(engine.evaluate("5 рад").formatted).toBe("5 радіанів");
    // A conversion, and with it Ukrainian's group separator: U+00A0, read out of
    // CLDR by `numberFormat: "intl"` rather than transcribed by hand. Written as
    // an escape because a literal no-break space is invisible in source and
    // degrades to a plain one the moment somebody retypes the line.
    expect(engine.evaluate("10 обертів в градусах").formatted).toBe(
      "3\u00A0600 градусів",
    );
    // The fractional row, and the one a plausible-looking wrong answer hides in:
    // a fraction in Ukrainian governs the genitive *singular*, so "1,5 града"
    // and never "1,5 градів".
    expect(engine.evaluate("1,5 града").formatted).toBe("1,5 града");
    // Latin still reads: a Ukrainian keyboard types "2 deg" as readily as
    // "2 градуси", and the vocabulary keeps `units.ts`'s aliases for it.
    expect(engine.evaluate("2 deg").formatted).toBe("2 градуси");
  });

  test("a count-free conversion target is locative", () => {
    // "в градусах", not "в градусів" and not "в градуси" — the row the old
    // one-dimensional `display` table could not express at all, because it is
    // chosen with no count in hand (ruling R5) and still has to inflect for the
    // case `в` governs.
    for (const [unit, expected] of [
      ["rad", "радіанах"],
      ["deg", "градусах"],
      ["grad", "градах"],
      ["turn", "обертах"],
    ] as const) {
      const key = ukrainian.selectForm({
        kind: "angle",
        unit,
        slot: "conversion-target",
      });
      expect(key).toBe("loc-other");
      expect(angleUk.units[unit]?.forms?.[key]).toBe(expected);
    }
  });

  test("round-trips: what it prints, it reads back", () => {
    // Deliberately ungrouped. A grouped Ukrainian output does *not* reparse
    // today — `evaluate("3 600 градусів")` throws `UnitParseError`, where
    // English's `"3,600 degrees"` reads back fine — because the lexer knows the
    // "," group separator and not the no-break space. That is a gap in core's
    // number lexing, not in this vocabulary, so it is named here rather than
    // papered over with a round-trip that quietly avoids the shape.
    for (const input of ["5 обертів", "1 оберт в градусах", "1,5 града"]) {
      const once = engine.evaluate(input);
      const twice = engine.evaluate(once.formatted);
      expect(twice.value.canonical.toString()).toBe(once.value.canonical.toString());
      expect(twice.value.unit).toBe(once.value.unit);
    }
  });
});
