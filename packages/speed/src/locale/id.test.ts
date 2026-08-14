import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationId from "@smartput/duration/locale/id";
import { length } from "@smartput/length";
import { speed } from "../index";
import speedId from "./id";

const locale = () => composeLocale(indonesian, [speedId]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `indonesian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    indonesian.selectForm({ kind: "speed", unit: "knot", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      indonesian.selectForm({
        count: new Decimal(count),
        kind: "speed",
        unit: "knot",
        slot,
      }),
    ),
  ]),
);

describe("speed id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Indonesian
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute (every noun carries a capital) does not transfer either, since
  // Indonesian capitalises no common noun. So the words are the check: the kind
  // is four ratios, unit ids, magnitude bands and one bridge signature naming
  // its operands by id string, and no Indonesian word may appear in it.
  test("the kind itself carries no Indonesian word", () => {
    expect(JSON.stringify(speed)).not.toMatch(/\bjam\b|\bmil\b|kilometer|\bper\b/i);
  });

  test("only `knot` declares a form, and it declares exactly one", () => {
    // The decision `en.ts` records, restated for a language that cannot close a
    // compound at all: "kilometer per jam" is three words and "km/jam" carries
    // an operator, so neither lexes back as one unit token and a forms table for
    // those three would be unreachable prose.
    expect(speedId.units.mps?.forms).toBeUndefined();
    expect(speedId.units.kph?.forms).toBeUndefined();
    expect(speedId.units.mph?.forms).toBeUndefined();
    // The contract the language author pinned: `selectForm` is the constant
    // `() => "other"`, because Indonesian has no grammatical plural, no gender
    // and no case. The sweep includes a count-free call (R5) and 1e6, so a CLDR
    // `many` row would surface here rather than at a user. Rule 6 wants exactly
    // this set — one row, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(Object.keys(speedId.units.knot?.forms ?? {})).toEqual([...KEYS]);
  });

  test("the three compounds leave the Indonesian head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "kilometer" for kph here would give "5 kilometer" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The bridge below is what Indonesian gets instead, and it is how the
    // compound is actually written anyway.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedId.units[unit]?.aliases ?? []) {
        expect(
          ["meter", "kilometer", "mil", "jam"],
          `${unit} claims a head noun that belongs to another kind`,
        ).not.toContain(alias.toLowerCase());
      }
    }
    expect(speedId.units.knot?.aliases).toContain("kn");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. A symbol carrying an operator is outside what any alias index can
    // decide — it re-reads as arithmetic, which the bridge test below measures —
    // so it is exempted here by the same rule the contract itself applies.
    for (const [unit, words] of Object.entries(speedId.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      if (!/[/*+\-·×⋅]/.test(symbol)) {
        expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
          symbol.toLowerCase(),
        );
      }
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [speed])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Indonesian folds every count into `other`, which is the
    // claim worth sampling rather than assuming: the day `selectForm` grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`knot` is one word for every count, where Dutch needs two", () => {
    // The substance of a one-key table, and the place the two languages visibly
    // disagree: Dutch's *knoop* takes a plain `-en` plural with open-syllable
    // shortening, so `nl.ts` writes two different strings; Indonesian borrowed
    // the noun unmodified and has nothing for it to agree with, so one string
    // answers every reader.
    expect(word("knot", 1)).toBe("knot");
    expect(word("knot", 5)).toBe("knot");
    expect(word("knot", 1.5)).toBe("knot");
    expect(word("knot", 0)).toBe("knot");
    // A conversion target carries no count and every language must still answer
    // (R5); the slot changes nothing, because there is no case for a preposition
    // to govern.
    expect(word("knot", undefined, "conversion-target")).toBe("knot");
    expect(word("knot", 5, "conversion-target")).toBe(word("knot", 5));
  });

  test("an engine built from it reads and writes Indonesian speed", () => {
    expect(engine.evaluate("1 knot").formatted).toBe("1 knot");
    expect(engine.evaluate("5 knot").formatted).toBe("5 knot");
    // The English plural still reads, from `units.ts`, and is answered with the
    // one invariant noun: recognition is many-to-one (I6) while generation
    // stays one.
    expect(engine.evaluate("5 knots").formatted).toBe("5 knot");
    expect(engine.evaluate("5 kn").formatted).toBe("5 knot");
    // The three compounds print on their symbol, and tight — `defaultRender
    // Quantity` sets a symbol against the number, and `indonesian` declines a
    // `renderQuantity` of its own. This is the package where that costs the most
    // visibly: Indonesian writes "100 km/jam" with the space.
    expect(engine.evaluate("3 mps").formatted).toBe("3m/s");
    expect(engine.evaluate("100 kmh").formatted).toBe("100km/jam");
    expect(engine.evaluate("60 mph").formatted).toBe("60mph");
    // Conversions, with both particles the language lists under `in`.
    expect(engine.evaluate("10 knot dalam kmh").formatted).toBe("18,52km/jam");
    expect(engine.evaluate("37,04 kph ke knot").formatted).toBe("20 knot");
    // A sum landing on a fraction, in both spellings of addition. Written with a
    // comma on purpose: "1.5" is fifteen hundred here, so a test spelled with a
    // full stop would be exercising the group separator — which the row below
    // exercises deliberately instead.
    expect(engine.evaluate("1 knot + 0,5 knot").formatted).toBe("1,5 knot");
    expect(engine.evaluate("1 knot tambah 0,5 knot").formatted).toBe("1,5 knot");
    expect(engine.evaluate("2000 kph").formatted).toBe("2.000km/jam");
  });

  test("its own output reads back to the same value", () => {
    // `knot` and `mph` only. The other two print on a symbol carrying "/", which
    // the lexer will not take back inside a unit word — it takes it as division
    // instead, which is what the bridge test below is for.
    for (const input of [
      "5 knot",
      "1 knot tambah 0,5 knot",
      "37,04 kph ke knot",
      "1,5 knot",
      "60 mph",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });

  test("the compound Indonesian writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "km/jam" needs no alias here because it is already a length over
    // a duration, and `speed.ops` names both operands by id string. This is the
    // reason leaving "kilometer" to `@smartput/length` costs Indonesian nothing.
    //
    // No length vocabulary is composed in, deliberately: `buildRegistry` indexes
    // every unit id under the language-neutral `"*"` floor, so "km" resolves
    // without one and this test measures the bridge rather than another agent's
    // file. The Indonesian duration vocabulary *is* composed in, because it is
    // what makes *jam* an hour — the dependency the symbol takes on, and the
    // whole reason to state it out loud.
    const wired = createEngine({
      locales: [composeLocale(indonesian, [durationId, speedId])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 km / jam");
    expect(bridged.kind).toBe("speed");
    expect(bridged.value.unit).toBe("mps");
    // 100 km/jam is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 km / jam dalam kmh").formatted).toBe("100km/jam");
    // The Indonesian hour and the SI one, side by side: printing *jam* costs
    // nothing, because "h" still goes through the same division.
    expect(wired.evaluate("100 km / h dalam kmh").formatted).toBe("100km/jam");
    expect(wired.evaluate("1852 m / jam ke knot").formatted).toBe("1 knot");
    // And the printed symbol reads back as arithmetic in the engine that has the
    // hour — which is the whole of what "round-trips" means for a slash-bearing
    // symbol.
    const printed = wired.evaluate("100 kmh").formatted;
    expect(printed).toBe("100km/jam");
    expect(wired.evaluate(printed).value.canonical.toString()).toBe(
      wired.evaluate("100 kmh").value.canonical.toString(),
    );
  });
});
