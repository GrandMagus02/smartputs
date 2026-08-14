import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal, defineVocabulary } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationEs from "@smartput/duration/locale/es";
import { length } from "@smartput/length";
import { speed } from "../index";
import speedEs from "./es";

const locale = () => composeLocale(spanish, [speedEs]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `spanish.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    spanish.selectForm({ kind: "speed", unit: "knot", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      spanish.selectForm({
        count: new Decimal(count),
        kind: "speed",
        unit: "knot",
        slot,
      }),
    ),
  ]),
);

/**
 * A three-unit Spanish length fixture, built here rather than imported.
 *
 * `@smartput/length`'s own Spanish vocabulary is another translator's work and
 * may not exist yet, and this file must not wait on it to assert the one claim
 * its doc comment makes — that "km/h" needs no alias because it is already a
 * length over a duration. `@smartput/core/locale/es.test.ts` builds its engine
 * round trip from a local fixture for the same reason. Hand-written aliases are
 * fine *here* precisely because this is a fixture and not a shipped vocabulary:
 * a shipped one derives its Latin set from `units.ts`.
 */
const lengthFixture = defineVocabulary({
  locale: "es",
  kind: "length",
  units: {
    m: { aliases: ["m", "metro", "metros"], symbol: "m" },
    km: { aliases: ["km", "kilómetro", "kilómetros"], symbol: "km" },
    mi: { aliases: ["mi", "milla", "millas"], symbol: "mi" },
  },
});

describe("speed es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Spanish cannot
  // borrow it — the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids — so the words are the check: the kind is
  // ratios, unit ids, magnitude bands and one bridge signature naming its
  // operands by string, and no Spanish noun may appear in any of it.
  test("the kind itself carries no Spanish word", () => {
    expect(JSON.stringify(speed)).not.toMatch(/nudo|metro|kil[óo]metro|milla/i);
  });

  test("`spanish` asks for exactly two keys, and only `knot` fills them", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(speedEs.units.knot?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // The three compounds fill neither, for the reason `en.ts` records and
    // Spanish sharpens: "kilómetros por hora" is four words and its second is
    // already the `times` keyword, so a table here would be prose the lexer
    // reads as multiplication.
    for (const unit of ["mps", "kph", "mph"] as const) {
      expect(speedEs.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("the three compounds leave the Spanish head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "kilómetros" for kph here would give "5 kilómetros" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The bridge at the bottom of this file is the path Spanish gets instead.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedEs.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Spanish head noun`).not.toMatch(
          /metro|kil[óo]metro|milla|hora|segundo/i,
        );
      }
    }
    expect(speedEs.units.knot?.aliases).toContain("nudo");
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way. The three
    // slash-bearing symbols are checked from the other end instead — they are
    // read as arithmetic rather than by lookup, which is the bridge test below,
    // and `assertLocaleContract` skips any surface holding an operator
    // character for exactly that reason.
    for (const [unit, words] of Object.entries(speedEs.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      if (!/[/*+\-·×⋅]/.test(symbol)) {
        expect(
          folded,
          `${unit}'s symbol "${symbol}" is not among its own aliases`,
        ).toContain(symbol.toLowerCase());
      }
      for (const form of Object.values(words.forms ?? {})) {
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
    // The default counts are all integers and never reach the category a
    // fraction takes. Spanish folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`nudo`'s two rows are two decisions, and only 1 is singular", () => {
    expect(word("knot", 1)).toBe("nudo");
    expect(word("knot", 2)).toBe("nudos");
    expect(word("knot", 0)).toBe("nudos");
    // 21 stays plural in Spanish where Ukrainian makes it singular, and a
    // fraction is plural too.
    expect(word("knot", 21)).toBe("nudos");
    expect(word("knot", 1.5)).toBe("nudos");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("knot", undefined, "conversion-target")).toBe("nudos");
  });

  test("an engine built from it reads and writes Spanish speed", () => {
    // The plural boundary, both sides of it — `knot` is the one unit here whose
    // output moves across it at all.
    expect(engine.evaluate("1 nudo").formatted).toBe("1 nudo");
    expect(engine.evaluate("5 nudos").formatted).toBe("5 nudos");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma throughout: "1.5" is not a Spanish number, since the
    // full stop is this language's group separator.
    expect(engine.evaluate("1 nudo + 0,5 nudos").formatted).toBe("1,5 nudos");
    // Conversions, with both prepositions the language lists under `in`: knots
    // in, the Spanish compound out, joined to the number with no space because
    // `kph` has no forms.
    expect(engine.evaluate("10 nudos en kph").formatted).toBe("18,52km/h");
    expect(engine.evaluate("37,04 kph a nudos").formatted).toBe("20 nudos");
    // Latin abbreviations still read: a Spanish speaker types "mps" and "kmh".
    expect(engine.evaluate("3 mps").formatted).toBe("3m/s");
    expect(engine.evaluate("1 kmh").formatted).toBe("1km/h");
    expect(engine.evaluate("60 mph").formatted).toBe("60mi/h");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2000 kph").formatted).toBe("2.000km/h");
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which the
    // lexer will not take back inside a unit word — it is read as arithmetic
    // instead, which is the bridge the next test wires up.
    for (const input of [
      "1 nudo",
      "5 nudos",
      "1 nudo + 0,5 nudos",
      "37,04 kph a nudos",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });

  test("the compound Spanish writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "km/h" needs no alias here because it is already a length over a
    // duration, and `speed.ops` names both operands by id string. This is why
    // leaving "kilómetros" to `@smartput/length` costs Spanish nothing, and why
    // the Spanish solidus is affordable where `@smartput/datarate`'s "Mb/s" is
    // not — there, the division has no signature to compute.
    const wired = createEngine({
      locales: [composeLocale(spanish, [lengthFixture, durationEs, speedEs])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 km / h");
    expect(bridged.kind).toBe("speed");
    expect(bridged.value?.unit).toBe("mps");
    // 100 km/h is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 km / h en kph").formatted).toBe("100km/h");
    // The Spanish nouns reach the same place, which is the whole point of
    // leaving them to the length vocabulary.
    expect(wired.evaluate("100 kilómetros / hora en kph").formatted).toBe("100km/h");
    expect(wired.evaluate("1852 metros / hora en nudos").formatted).toBe("1 nudo");
    // And the imperial row, whose symbol is the one an English contraction
    // would have spelled undecomposably.
    expect(wired.evaluate("60 millas / hora en mph").formatted).toBe("60mi/h");
  });
});
