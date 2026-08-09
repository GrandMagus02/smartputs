import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthUk from "./uk";

const engine = createEngine({
  locales: [composeLocale(ukrainian, [lengthUk])],
  kinds: [length],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = ukrainian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "length",
    unit,
    slot,
  });
  return (lengthUk.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Ukrainian word", () => {
    // The Cyrillic block, not a list of the eight nouns: the point is that the
    // kind holds ratios and magnitude bands and no language at all, so any
    // Cyrillic letter reaching it is the failure.
    expect(JSON.stringify(length)).not.toMatch(/[Ѐ-ӿ]/);
  });

  // `in` is not a Ukrainian keyword — `ukrainian.keywords.in` is в/у/до — so
  // nothing in this language's own lexer would shadow the alias. It is left out
  // because `registry.aliasIndex` is one flat map that `isUnitAlias` reads
  // without a locale, so a Ukrainian entry for `in` would put it back in front
  // of `@smartput/datetime`'s accept-gate for any engine speaking both
  // languages. See the vocabulary's own comment.
  test("`in` is left to the conversion keyword here too", () => {
    for (const words of Object.values(lengthUk.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthUk.units.in?.aliases).toContain("дюйм");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Ukrainian spells with a genitive *singular*. 1.5 is
    // added so `nom-other` and `loc-other` are actually sampled rather than
    // merely written down.
    assertLocaleContract(composeLocale(ukrainian, [lengthUk]), [length], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine (seven of the eight units): the nominative plural and the
    // genitive singular are different strings, so a fractional length is
    // "1,5 метра" and never "1,5 метри" or "1,5 метрів".
    expect(word("m", 1)).toBe("метр");
    expect(word("m", 2)).toBe("метри");
    expect(word("m", 5)).toBe("метрів");
    expect(word("m", 1.5)).toBe("метра");
    // The two counts that catch a hand-written plural rule: 21 is singular in
    // Ukrainian and 11 is not.
    expect(word("m", 21)).toBe("метр");
    expect(word("m", 11)).toBe("метрів");
    // Feminine: `милі` fills both the nominative plural and the genitive
    // singular, so those two rows coincide — and the genitive plural is the
    // bare stem, not an `-ів` ending. Pasting the masculine paradigm here would
    // produce "1,5 милі" correctly by accident and "5 милів" wrongly.
    expect(word("mi", 1)).toBe("миля");
    expect(word("mi", 2)).toBe("милі");
    expect(word("mi", 5)).toBe("миль");
    expect(word("mi", 1.5)).toBe("милі");
  });

  test("a conversion target is locative, with or without a count", () => {
    // "в 1 метрі", "в 2 метрах", "в 5 метрах" — and the row no one-dimensional
    // plural model could express: "в метрах", chosen with no count in hand.
    expect(word("m", 1, "conversion-target")).toBe("метрі");
    expect(word("m", 2, "conversion-target")).toBe("метрах");
    expect(word("m", 5, "conversion-target")).toBe("метрах");
    expect(word("m", undefined, "conversion-target")).toBe("метрах");
    expect(word("mi", 1, "conversion-target")).toBe("милі");
    expect(word("mi", undefined, "conversion-target")).toBe("милях");
  });

  test("an engine built from it reads and writes Ukrainian length", () => {
    // The plural boundary, in both directions across it, masculine and feminine.
    expect(engine.evaluate("2 метри").formatted).toBe("2 метри");
    expect(engine.evaluate("5 метрів").formatted).toBe("5 метрів");
    expect(engine.evaluate("2 милі").formatted).toBe("2 милі");
    expect(engine.evaluate("5 миль").formatted).toBe("5 миль");
    // Arithmetic landing on a fraction: the genitive singular, not the plural.
    // "1,5 кілометрів" would be the wrong answer no other test here sees.
    expect(engine.evaluate("1 км + 500 м").formatted).toBe("1,5 кілометра");
    // A conversion, written with "в" and read in Cyrillic.
    expect(engine.evaluate("3 фути в дюймах").formatted).toBe("36 дюймів");
    // Latin input still reads: a Ukrainian keyboard produces "км", a Ukrainian
    // developer types "km", and both are the same unit.
    expect(engine.evaluate("2 km").formatted).toBe("2 кілометри");
    // Grouping comes from CLDR through `numberFormat: "intl"`. U+00A0 as an
    // escape, never a literal — a literal is invisible here and degrades to a
    // plain space the moment the line is retyped.
    expect(engine.evaluate("2000 м").formatted).toBe("2\u00A0000 метрів");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: `numberFormat: "intl"` groups with U+00A0 and
    // the lexer does not accept that separator on the way back in, so a grouped
    // output is asserted above as text and kept out of the round-trip.
    for (const input of ["1 км + 500 м", "3 фути в дюймах", "5 миль", "10 см", "1,5 м"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
