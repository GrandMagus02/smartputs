import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationNl from "@smartput/duration/locale/nl";
import { length } from "@smartput/length";
import { speed } from "../index";
import speedNl from "./nl";

const locale = () => composeLocale(dutch, [speedNl]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `dutch.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    dutch.selectForm({ kind: "speed", unit: "knot", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "speed",
        unit: "knot",
        slot,
      }),
    ),
  ]),
);

describe("speed nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Dutch
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute does not transfer either, because it rests on every German noun
  // carrying a capital and Dutch capitalises none. So the words are the check:
  // the kind is four ratios, unit ids, magnitude bands and one bridge signature
  // naming its operands by id string, and no Dutch word may appear in it.
  test("the kind itself carries no Dutch word", () => {
    expect(JSON.stringify(speed)).not.toMatch(/knoop|knopen|kilometer|\bmijl\b|\buur\b/i);
  });

  test("only `knot` declares written forms, and it declares exactly two", () => {
    // The decision `en.ts` records, restated for a language that closes most of
    // its compounds up and cannot close this one: "kilometer per uur" is three
    // words and "km/u" carries an operator, so neither lexes back as one unit
    // token and a forms table for them would be unreachable prose.
    expect(speedNl.units.mps?.forms).toBeUndefined();
    expect(speedNl.units.kph?.forms).toBeUndefined();
    expect(speedNl.units.mph?.forms).toBeUndefined();
    // The contract the language author pinned: one axis, the CLDR plural
    // category, and nothing else — `slot` is read and discarded, because modern
    // Dutch has no case marking left on common nouns. The sweep includes a
    // count-free call (R5) and 1e6. Rule 6 wants exactly this set, no more and
    // no fewer.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(speedNl.units.knot?.forms ?? {}).sort()).toEqual([...KEYS].sort());
  });

  test("the three compounds leave the Dutch head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "kilometer" for kph here would give "5 kilometer" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed —
    // and `dutch`'s compound splitter would then put every `-meter` compound in
    // the language into both kinds too. The bridge below is what Dutch gets
    // instead, and it is how the compound is actually written anyway.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedNl.units[unit]?.aliases ?? []) {
        expect(
          ["meter", "meters", "kilometer", "kilometers", "mijl", "mijlen", "uur", "uren"],
          `${unit} claims a head noun that belongs to another kind`,
        ).not.toContain(alias.toLowerCase());
      }
    }
    expect(speedNl.units.knot?.aliases).toContain("knoop");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. A symbol carrying an operator is outside what any alias index can
    // decide — it re-reads as arithmetic, which the bridge test below measures —
    // so it is exempted here by the same rule the contract itself applies.
    for (const [unit, words] of Object.entries(speedNl.units)) {
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
    // fraction takes. Dutch folds it into `other`, which is the claim worth
    // sampling rather than assuming: if `selectForm` ever grows a third CLDR
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`knoop` marks its plural where German's `Knoten` does not", () => {
    // The two languages visibly disagree here. German's `Knoten` is an `-en`
    // masculine whose plural equals its singular, so all four of its keys hold
    // one word; Dutch takes a plain `-en` plural with open-syllable shortening,
    // *knoop* → *knopen*, so the two rows here are two strings. That shortening
    // is also why the plural must be a declared alias: the stem a stripper would
    // leave, "knop", is a different Dutch word.
    expect(word("knot", 1)).toBe("knoop");
    expect(word("knot", 5)).toBe("knopen");
    expect(word("knot", 1.5)).toBe("knopen");
    // A conversion target carries no count and every language must still answer
    // (R5). Dutch answers `other`, and the slot changes nothing at all.
    expect(word("knot", undefined, "conversion-target")).toBe("knopen");
    expect(word("knot", 5, "conversion-target")).toBe(word("knot", 5));
  });

  test("an engine built from it reads and writes Dutch speed", () => {
    expect(engine.evaluate("1 knoop").formatted).toBe("1 knoop");
    expect(engine.evaluate("5 knopen").formatted).toBe("5 knopen");
    expect(engine.evaluate("5 kn").formatted).toBe("5 knopen");
    // The three compounds print on their symbol, spaced by
    // `dutch.renderQuantity` where English and Ukrainian both set a symbol tight
    // ("100kph", "100км/год") — SI wants the gap, and Dutch typography follows
    // it as strictly as German's does.
    expect(engine.evaluate("3 mps").formatted).toBe("3 m/s");
    expect(engine.evaluate("100 kmh").formatted).toBe("100 km/u");
    expect(engine.evaluate("60 mph").formatted).toBe("60 mph");
    // A conversion, with both prepositions the language lists under `in`.
    expect(engine.evaluate("10 knopen in kmh").formatted).toBe("18,52 km/u");
    expect(engine.evaluate("37,04 kph naar knopen").formatted).toBe("20 knopen");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is fifteen hundred in Dutch, so a
    // test spelled with a full stop would be exercising the group separator —
    // which the row below exercises deliberately instead.
    expect(engine.evaluate("1 knoop + 0,5 knoop").formatted).toBe("1,5 knopen");
    expect(engine.evaluate("2000 kph").formatted).toBe("2.000 km/u");
  });

  test("its own output reads back to the same value", () => {
    // `knot` and `mph` only. The other two print on a symbol carrying "/", which
    // the lexer will not take back inside a unit word — it takes it as division
    // instead, which is what the bridge test below is for.
    for (const input of [
      "5 knopen",
      "1 knoop + 0,5 knoop",
      "37,04 kph naar knopen",
      "1,5 knopen",
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

  test("the compound Dutch writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "km/u" needs no alias here because it is already a length over a
    // duration, and `speed.ops` names both operands by id string. This is the
    // reason leaving "kilometer" to `@smartput/length` costs Dutch nothing.
    //
    // No length vocabulary is composed in, deliberately: `buildRegistry` indexes
    // every unit id under the language-neutral `"*"` floor, so "km" resolves
    // without one and this test measures the bridge rather than another agent's
    // file. The Dutch duration vocabulary *is* composed in, because it is what
    // makes `u` an hour — the dependency the symbol takes on, and the whole
    // reason to state it out loud.
    const wired = createEngine({
      locales: [composeLocale(dutch, [durationNl, speedNl])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 km / u");
    expect(bridged.kind).toBe("speed");
    // "kph" since spec §D: a derived result keeps the units the person wrote,
    // and (km, /, h) is exactly what the registry's derived-unit table calls
    // `kph`. The bridge is unchanged — `speed.ops` still names both operands by
    // id string and still returns `mps` — what moved is that returning the
    // canonical now reads as "the plugin declined to choose".
    expect(bridged.value.unit).toBe("kph");
    // 100 km/u is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 km / u in kmh").formatted).toBe("100 km/u");
    // The Dutch hour spelled out, and the SI one beside it: printing `u` costs
    // nothing, because `h` still goes through the same division.
    expect(wired.evaluate("100 km / uur in kmh").formatted).toBe("100 km/u");
    expect(wired.evaluate("100 km / h in kmh").formatted).toBe("100 km/u");
    expect(wired.evaluate("1852 m / uur in knopen").formatted).toBe("1 knoop");
  });
});
