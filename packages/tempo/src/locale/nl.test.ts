import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoNl from "./nl";

const locale = () => composeLocale(dutch, [tempoNl]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `dutch.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    dutch.selectForm({ kind: "tempo", unit: "hz", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "tempo",
        unit: "hz",
        slot,
      }),
    ),
  ]),
);

describe("tempo nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Dutch
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute does not transfer either, because it rests on every German noun
  // carrying a capital and Dutch capitalises none. So the words are the check:
  // the kind is two ratios, unit ids, magnitude bands and two reciprocal bridge
  // signatures naming their operands by id string, and no Dutch word is in it.
  test("the kind itself carries no Dutch word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/\bslag\b|\bslagen\b|minuut|minuten/i);
  });

  test("`dutch` asks for exactly two keys, and only `hz` fills them", () => {
    // The contract the language author pinned: one axis, the CLDR plural
    // category, and nothing else. `slot` is read and discarded, because modern
    // Dutch lost its case marking on common nouns — "in hertz" governs the same
    // word a bare quantity does — so where `de.ts` writes four identical rows
    // this writes two. The sweep includes a count-free call (R5) and 1e6.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(tempoNl.units.hz?.forms ?? {}).sort()).toEqual([...KEYS].sort());
    // And `bpm` fills neither, for the reason the doc comment gives: "slagen per
    // minuut" is a prepositional phrase, not a compound, so there is nothing to
    // glue and nothing the lexer could read back. Rule 6 is satisfied by an
    // empty key set, not by two rows of unreachable Dutch.
    expect(tempoNl.units.bpm?.forms).toBeUndefined();
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing, so the SI capital in
    // "Hz" meets the derived "hz" and a symbol never has to be listed twice.
    // What this catches is the other thing — a printed word reachable only
    // through `dutch`'s suffix stripper, at its −2 penalty, so by accident
    // rather than by declaration.
    for (const [unit, words] of Object.entries(tempoNl.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Dutch folds it into `other`, the row 0 and 5 take — but
    // that is `selectForm`'s decision, not arithmetic, so it is sampled. A
    // fractional tempo is not hypothetical here: 0,5 Hz is 30 bpm.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`hertz` is invariant across both rows", () => {
    // An eponym used as a measure noun, and Dutch holds a measure noun in the
    // singular after a numeral — "vijftig hertz", exactly as "vijftig watt".
    // Two identical rows are the answer rather than an unfinished table;
    // `@smartput/duration`'s Dutch *dag*/*dagen*, in the kind this one bridges
    // to, is the control that keeps the claim from being vacuous.
    expect(word("hz", 1)).toBe("hertz");
    expect(word("hz", 50)).toBe("hertz");
    expect(word("hz", 1.5)).toBe("hertz");
    // A conversion target carries no count and every language must still answer
    // (R5). Dutch answers `other`, and the slot changes nothing at all.
    expect(word("hz", undefined, "conversion-target")).toBe("hertz");
    expect(word("hz", 50, "conversion-target")).toBe(word("hz", 50));
  });

  test("an engine built from it reads and writes Dutch tempo", () => {
    // No forms on `bpm`, so the symbol renders — spaced, which is `dutch`'s own
    // `renderQuantity` following SI where English sets a symbol tight.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    // The Dutch numerator, in both numbers, standing for the whole compound.
    expect(engine.evaluate("120 slagen").formatted).toBe("120 bpm");
    expect(engine.evaluate("1 slag").formatted).toBe("1 bpm");
    // The invariant measure noun.
    expect(engine.evaluate("50 hz").formatted).toBe("50 hertz");
    expect(engine.evaluate("1 hertz").formatted).toBe("1 hertz");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("1 hz in bpm").formatted).toBe("60 bpm");
    expect(engine.evaluate("1 hz naar bpm").formatted).toBe("60 bpm");
    expect(engine.evaluate("120 bpm in hertz").formatted).toBe("2 hertz");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Dutch, so a
    // test written with a full stop would be exercising the group separator —
    // which the row below exercises deliberately instead.
    expect(engine.evaluate("1 hz + 30 bpm").formatted).toBe("1,5 hertz");
    expect(engine.evaluate("2000 bpm").formatted).toBe("2.000 bpm");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "120 bpm",
      "120 slagen",
      "50 hz",
      "1 hz + 30 bpm",
      "1 hz in bpm",
      "2000 bpm",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
