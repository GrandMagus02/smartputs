import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerNl from "./nl";

const locale = () => composeLocale(dutch, [powerNl]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `dutch.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    dutch.selectForm({ kind: "power", unit: "hp", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "power",
        unit: "hp",
        slot,
      }),
    ),
  ]),
);

describe("power nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Dutch
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute does not transfer either, because it rests on every German noun
  // carrying a capital and Dutch capitalises none. So the words are the check:
  // the kind is ratios (one of them the exact 550 ft·lbf/s horsepower), unit ids
  // and magnitude bands, and no Dutch word may appear anywhere in it.
  test("the kind itself carries no Dutch word", () => {
    expect(JSON.stringify(power)).not.toMatch(/paarde[n]?kracht|\bpk\b/i);
  });

  test("`dutch` asks for exactly two keys, and every unit fills exactly those", () => {
    // The contract the language author pinned: one axis, the CLDR plural
    // category, and nothing else. `slot` is read and discarded, because modern
    // Dutch lost its case marking on common nouns — "in kilowatt" governs the
    // same word a bare quantity does — so the dative axis `de.ts` carries is
    // absent and the table is English-shaped. The sweep includes a count-free
    // call (R5) and 1e6, so a CLDR `many` row would surface here.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(powerNl.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing, so the SI capital in
    // "kW" meets the derived "kw" and a symbol never has to be listed twice.
    // What this catches is the other thing — a printed word reachable only
    // through `dutch`'s suffix stripper, at its −2 penalty, so by accident
    // rather than by declaration. "paardenkrachten" could not be recovered even
    // that way: `dutch` refuses to strip `en` at all.
    for (const [unit, words] of Object.entries(powerNl.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
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
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Dutch folds it into `other`, the row 0 and 5 take — but
    // that is `selectForm`'s decision, not arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the watt is invariant and the paardenkracht is not", () => {
    // Dutch holds a unit of measure in the singular after a numeral, so both
    // rows of the SI four are one word.
    expect(word("w", 1)).toBe("watt");
    expect(word("w", 5)).toBe("watt");
    expect(word("kw", 1.5)).toBe("kilowatt");
    // And the counterweight, without which every row above would be a table that
    // stopped halfway rather than a fact about the noun. A paardenkracht is
    // counted, not measured, so the `-en` plural is real.
    expect(word("hp", 1)).toBe("paardenkracht");
    expect(word("hp", 150)).toBe("paardenkrachten");
    expect(word("hp", 1.5)).toBe("paardenkrachten");
    // A conversion target carries no count and every language must still answer
    // (R5). Dutch answers `other`, and the slot changes nothing at all.
    expect(word("hp", undefined, "conversion-target")).toBe("paardenkrachten");
    expect(word("w", 5, "conversion-target")).toBe(word("w", 5));
  });

  test("an engine built from it reads and writes Dutch power", () => {
    expect(engine.evaluate("2 watt").formatted).toBe("2 watt");
    expect(engine.evaluate("2 kilowatt").formatted).toBe("2 kilowatt");
    // The English plural still reads, and is answered with the Dutch invariant.
    expect(engine.evaluate("2 watts").formatted).toBe("2 watt");
    // The one word Ukrainian could not have: a closed compound, so it prints and
    // reads back at full weight.
    expect(engine.evaluate("1 paardenkracht").formatted).toBe("1 paardenkracht");
    expect(engine.evaluate("150 paardenkrachten").formatted).toBe("150 paardenkrachten");
    // The pre-1995 spelling, without the linking -n-. Read, never written.
    expect(engine.evaluate("150 paardekracht").formatted).toBe("150 paardenkrachten");
    // The Dutch abbreviation, and the English one beside it from `units.ts`.
    expect(engine.evaluate("150 pk").formatted).toBe("150 paardenkrachten");
    expect(engine.evaluate("150 hp").formatted).toBe("150 paardenkrachten");
    // A conversion, with both prepositions the language lists under `in`. The
    // group separator is a full stop — the inverse of English.
    expect(engine.evaluate("2 kw in watt").formatted).toBe("2.000 watt");
    expect(engine.evaluate("2 kw naar watt").formatted).toBe("2.000 watt");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Dutch.
    expect(engine.evaluate("1 kw + 500 w").formatted).toBe("1,5 kilowatt");
  });

  test("the compound splitter offers the base unit and the alias outranks it", () => {
    // `watt` is a head in `dutch`'s own list, so "kilowatt" splits and offers
    // `w` at −3 — the base unit, off by a thousand. The exact alias at 0 is what
    // keeps the answer right.
    expect(engine.evaluate("2 kilowatt").value.unit).toBe("kw");
    expect(engine.evaluate("2 gigawatt").value.unit).toBe("gw");
    // A compound no vocabulary would list, which is what the split is for: the
    // head decides, so an unknown Dutch modifier still lands on the watt.
    expect(engine.evaluate("2 piekwatt").value.unit).toBe("w");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "2 kilowatt",
      "1 kw + 500 w",
      "2 kw in watt",
      "150 pk",
      "150 paardekracht",
      "1 paardenkracht",
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
