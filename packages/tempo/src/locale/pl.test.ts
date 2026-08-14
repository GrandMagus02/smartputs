import { describe, expect, test } from "bun:test";
import { aliasesFor, composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import { TEMPO_UNITS, type TempoUnit } from "../units";
import tempoPl from "./pl";

const engine = createEngine({
  locales: [composeLocale(polish, [tempoPl])],
  kinds: [tempo],
});

/** The key `polish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: string, count?: number) =>
  polish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "tempo",
    unit,
    slot,
  });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") =>
  (tempoPl.units as Record<string, { forms?: Record<string, string> }>)[unit]?.forms?.[
    key(unit, slot, count)
  ];

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

describe("tempo pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoPl.units)) {
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
    const descriptor = JSON.stringify(tempo);
    expect(descriptor).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
    for (const stem of ["herc", "uderz"]) {
      expect(descriptor, `the kind names "${stem}"`).not.toContain(stem);
    }
  });

  test("only `hz` declares written forms", () => {
    // The decision `en.ts` records, restated because Polish would need eight
    // keys rather than two: "uderzeń na minutę" is three words and the middle
    // one is this language's `in` keyword, so no forms table for `bpm` could
    // ever be reached by an input. The renderer stays on the symbol because of
    // it.
    expect(tempoPl.units.bpm?.forms).toBeUndefined();
    expect(Object.keys(tempoPl.units.hz?.forms ?? {}).sort()).toEqual(EIGHT_KEYS);
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `polish`'s suffix
  // stripper recovers it — at `weight: -2`. So "120 bpm w hercu" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(tempoPl.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  // `bpm` re-reads its symbol *because the symbol is one of its own aliases* —
  // the only route open to it. "ud./min" is the abbreviation a Polish metronome
  // prints and it carries a dot and a slash: the dot ends a word token and the
  // slash lexes as division, so "120 ud./min" would reach the engine as tempo ÷
  // duration, a signature `index.ts` deliberately does not declare. If a later
  // edit restores it, this fails first and names the cause.
  test("every symbol is an alias of the unit that prints it", () => {
    for (const [unit, words] of Object.entries(tempoPl.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds a character that ends a word token`,
      ).not.toMatch(/[/*+\-·×⋅.]/);
      expect(
        words.aliases.map((w) => w.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(polish, [tempoPl]), [tempo]),
    ).not.toThrow();
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Polish spells with a genitive *singular*. 1.5 is added
    // so `nom-other` and `loc-other` are sampled rather than merely written
    // down, and those two rows hold different words here.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [tempoPl]), [tempo], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("`herc`'s four nominative rows are four different decisions", () => {
    // The row that separates Polish from both Slavic neighbours: the genitive
    // plural keeps its -ów. Russian and Ukrainian give a unit named after a
    // person a zero-ending counting form ("5 герц"); Polish has no such rule, so
    // `nom-one` and `nom-many` are different words here where they are identical
    // there.
    expect(word("hz", 1)).toBe("herc");
    expect(word("hz", 2)).toBe("herce");
    expect(word("hz", 5)).toBe("herców");
    expect(word("hz", 1.5)).toBe("herca");
    expect(word("hz", 1)).not.toBe(word("hz", 5));
    // `nom-few` is a real nominative plural, so unlike Russian it does not
    // coincide with the fractional row either.
    expect(word("hz", 2)).not.toBe(word("hz", 1.5));
  });

  test("21 is `many`, which is where Polish leaves Ukrainian and Russian", () => {
    // Both neighbours agree 21 with the singular; Polish says "dwadzieścia jeden
    // herców", a genitive plural, and every -1 above twenty goes the same way.
    expect(key("hz", "after-number", 21)).toBe("nom-many");
    expect(key("hz", "after-number", 101)).toBe("nom-many");
    expect(key("hz", "after-number", 11)).toBe("nom-many");
    expect(key("hz", "after-number", 22)).toBe("nom-few");
    expect(key("hz", "after-number", 0)).toBe("nom-many");
    expect(word("hz", 21)).toBe("herców");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "w hercach", the row a one-dimensional plural table
    // had no cell for.
    expect(word("hz", 5, "after-number")).toBe("herców");
    expect(word("hz", 5, "conversion-target")).toBe("hercach");
    expect(key("hz", "conversion-target")).toBe("loc-other");
    expect(word("hz", undefined, "conversion-target")).toBe("hercach");
    // A soft stem takes -u in the locative singular, so the case axis is not one
    // suffix applied to every count: "w 1 hercu", not "w 1 hercach".
    expect(word("hz", 1, "conversion-target")).toBe("hercu");
    // The two `-other` rows hold different words, which is the trap
    // `polish.selectForm` documents: a genitive singular for the fraction, a
    // locative plural for the countless target.
    expect(tempoPl.units.hz?.forms?.["nom-other"]).not.toBe(
      tempoPl.units.hz?.forms?.["loc-other"],
    );
  });

  test("an engine built from it reads and writes Polish tempo", () => {
    // `bpm` prints its symbol, set off from the number by a space because
    // `polish.renderQuantity` follows PN-EN ISO 80000 rather than the default's
    // tight symbol branch — so this is "120 bpm" where English prints "120bpm".
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    // The numeral boundary, all four categories of it.
    expect(engine.evaluate("1 herc").formatted).toBe("1 herc");
    expect(engine.evaluate("2 herce").formatted).toBe("2 herce");
    expect(engine.evaluate("5 herców").formatted).toBe("5 herców");
    // 21 is `many` in Polish, so this reads "21 herców" where a table ported
    // from Ukrainian or Russian would print the nominative singular.
    expect(engine.evaluate("21 herców").formatted).toBe("21 herców");
    // The fraction, which is where both the genitive singular and CLDR's Polish
    // decimal comma show up.
    expect(engine.evaluate("1,5 herca").formatted).toBe("1,5 herca");
    // A conversion each way across the kind's reciprocal bridge, written with
    // "w".
    expect(engine.evaluate("120 bpm w hercach").formatted).toBe("2 herce");
    expect(engine.evaluate("2 hz w bpm").formatted).toBe("120 bpm");
    // A sum that lands on a fraction — the assertion that would read
    // "1,5 herców" if `nom-other` held a plural instead of the genitive singular
    // it is.
    expect(engine.evaluate("1 herc + 30 bpm").formatted).toBe("1,5 herca");
    // The read-only colloquial spellings: the numerator of the abbreviation
    // standing for the whole of it, which only `bpm` comes back out as.
    expect(engine.evaluate("120 ud").formatted).toBe("120 bpm");
    expect(engine.evaluate("120 uderzeń").formatted).toBe("120 bpm");
  });

  test("round-trips its own output", () => {
    for (const input of [
      "120 bpm",
      "1 herc",
      "5 herców",
      "21 herców",
      "1,5 herca",
      "120 bpm w hercach",
      "2 hz w bpm",
      "1 herc + 30 bpm",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the Latin aliases are derived, never retyped", () => {
    // What keeps the micro path (`parseTempo`) and the engine path in step:
    // every alias `units.ts` declares for a unit is still an alias of that unit
    // here, and the Polish words are an addition rather than a replacement.
    for (const unit of Object.keys(tempoPl.units) as TempoUnit[]) {
      for (const derived of aliasesFor(TEMPO_UNITS, unit)) {
        expect(tempoPl.units[unit]?.aliases, `${unit} dropped "${derived}"`).toContain(
          derived,
        );
      }
    }
  });
});
