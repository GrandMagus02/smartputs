import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationUk from "./uk";

const engine = createEngine({
  locales: [composeLocale(ukrainian, [durationUk])],
  kinds: [duration],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = ukrainian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationUk.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("duration uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Ukrainian word", () => {
    // The Cyrillic block, not a list of the six nouns: the point is that the
    // kind holds ratios and magnitude bands and no language at all, so any
    // Cyrillic letter reaching it is the failure.
    expect(JSON.stringify(duration)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Ukrainian spells with a genitive *singular*. 1.5 is
    // added so `nom-other` and `loc-other` are actually sampled rather than
    // merely written down.
    assertLocaleContract(composeLocale(ukrainian, [durationUk]), [duration], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("the four nominative rows are four different decisions", () => {
    // Feminine: the nominative plural and the genitive singular coincide, so
    // "2 години" and "1,5 години" are the same string by grammar.
    expect(word("h", 1)).toBe("година");
    expect(word("h", 2)).toBe("години");
    expect(word("h", 5)).toBe("годин");
    expect(word("h", 1.5)).toBe("години");
    // Masculine: they do not coincide, which is why the кілограм pattern cannot
    // be pasted over the feminine four or the reverse.
    expect(word("d", 1)).toBe("день");
    expect(word("d", 2)).toBe("дні");
    expect(word("d", 5)).toBe("днів");
    expect(word("d", 1.5)).toBe("дня");
  });

  test("a conversion target is locative, with or without a count", () => {
    // "в 1 годині", "в 2 годинах", "в 5 годинах" — and the row no
    // one-dimensional plural model could express: "в годинах", chosen with no
    // count in hand at all.
    expect(word("h", 1, "conversion-target")).toBe("годині");
    expect(word("h", 2, "conversion-target")).toBe("годинах");
    expect(word("h", 5, "conversion-target")).toBe("годинах");
    expect(word("h", undefined, "conversion-target")).toBe("годинах");
    expect(word("d", undefined, "conversion-target")).toBe("днях");
  });

  test("an engine built from it reads and writes Ukrainian duration", () => {
    // The plural boundary, in both directions across it.
    expect(engine.evaluate("2 години").formatted).toBe("2 години");
    expect(engine.evaluate("5 годин").formatted).toBe("5 годин");
    // Arithmetic landing on a fraction: the genitive singular, not the plural.
    // "1,5 годин" would be the wrong answer no other test in this repo sees.
    expect(engine.evaluate("1 год + 30 хв").formatted).toBe("1,5 години");
    // A conversion, written with "в" and read in Cyrillic.
    expect(engine.evaluate("2 год в хвилинах").formatted).toBe("120 хвилин");
    // Latin input still reads: a Ukrainian keyboard produces "год", a Ukrainian
    // developer types "h", and both are the same unit.
    expect(engine.evaluate("2 h").formatted).toBe("2 години");
    // Grouping comes from CLDR through `numberFormat: "intl"`. U+00A0 as an
    // escape, never a literal — a literal is invisible here and degrades to a
    // plain space the moment the line is retyped.
    expect(engine.evaluate("2000 с").formatted).toBe("2\u00A0000 секунд");
  });

  test("its own output reads back to the same value", () => {
    for (const input of ["1 год + 30 хв", "2 тижні в днях", "5 діб", "100 мс"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
