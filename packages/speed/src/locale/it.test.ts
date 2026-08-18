import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal, defineVocabulary } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationIt from "@smartput/duration/locale/it";
import { length } from "@smartput/length";
import { speed } from "../index";
import speedIt from "./it";

const locale = () => composeLocale(italian, [speedIt]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = italian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `italian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    italian.selectForm({ kind: "speed", unit: "knot", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      italian.selectForm({
        count: new Decimal(count),
        kind: "speed",
        unit: "knot",
        slot,
      }),
    ),
  ]),
);

/**
 * A three-unit Italian length fixture, built here rather than imported.
 *
 * `@smartput/length`'s own Italian vocabulary is another translator's work and
 * may not exist yet, and this file must not wait on it to assert the claim its
 * doc comment makes — that "km/h" needs no alias because it is already a length
 * over a duration. `@smartput/speed/locale/es.test.ts` builds a Spanish fixture
 * for the same reason. Hand-written aliases are fine *here* precisely because
 * this is a fixture and not a shipped vocabulary: a shipped one derives its Latin
 * set from `units.ts`.
 *
 * "miglio" → "miglia" is the small irregular class `it.ts`'s `pluralFold` gives a
 * row of its own (`a → o`): a masculine noun whose plural ends in -a and is
 * grammatically feminine. It is spelled out here rather than left to that row,
 * for the same reason a shipped vocabulary would spell it out — the fold is what
 * a table falls back from, not a substitute for one.
 */
const lengthFixture = defineVocabulary({
  locale: "it",
  kind: "length",
  units: {
    m: { aliases: ["m", "metro", "metri"], symbol: "m" },
    km: { aliases: ["km", "chilometro", "chilometri"], symbol: "km" },
    mi: { aliases: ["mi", "miglio", "miglia"], symbol: "mi" },
  },
});

describe("speed it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Italian cannot
  // borrow it — the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids — so the words are the check: the kind is
  // ratios, unit ids, magnitude bands and one bridge signature naming its
  // operands by string, and no Italian noun may appear in any of it.
  test("the kind itself carries no Italian word", () => {
    expect(JSON.stringify(speed)).not.toMatch(
      /nod[oi]|metr[oi]|chilometr[oi]|migli[oa]/i,
    );
  });

  test("`italian` asks for exactly two keys, and only `knot` fills them", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment. The slot is ignored
    // throughout, Italian nouns having no case.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(speedIt.units.knot?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // The three compounds fill neither, for the reason `en.ts` records: "m/s"
    // and "chilometri all'ora" are a slash and an apostrophe respectively, and
    // the lexer ends a unit word at both.
    for (const unit of ["mps", "kph", "mph"] as const) {
      expect(speedIt.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("the three compounds leave the Italian head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "chilometri" for kph here would give "5 chilometri" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The bridge at the bottom of this file is the path Italian gets instead.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedIt.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims an Italian head noun`).not.toMatch(
          /metr[oi]|chilometr[oi]|migli[oa]|ora|second[oi]/i,
        );
      }
    }
    expect(speedIt.units.knot?.aliases).toContain("nodo");
  });

  // The asymmetry the vocabulary's doc comment argues for, pinned where it can
  // fail: the two metric rows print a solidus that only the bridge can read, and
  // the imperial row prints the contraction Italian actually borrows, which is a
  // single token and reads back on its own.
  test("only the metric two hand their symbol to the bridge", () => {
    expect(speedIt.units.mps?.symbol).toBe("m/s");
    expect(speedIt.units.kph?.symbol).toBe("km/h");
    const mph = speedIt.units.mph as { symbol: string; aliases: readonly string[] };
    expect(mph.symbol).toBe("mph");
    expect(mph.symbol).not.toMatch(/[/*+\-·×⋅]/);
    expect(mph.aliases.map((a) => a.toLowerCase())).toContain("mph");
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way. The two
    // slash-bearing symbols are checked from the other end instead — they are
    // read as arithmetic rather than by lookup, which is the bridge test below,
    // and `assertLocaleContract` skips any surface holding an operator character
    // for exactly that reason.
    for (const [unit, words] of Object.entries(speedIt.units)) {
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
    // fraction takes. Italian folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`nodo`'s two rows are two decisions, and only 1 is singular", () => {
    expect(word("knot", 1)).toBe("nodo");
    expect(word("knot", 2)).toBe("nodi");
    expect(word("knot", 0)).toBe("nodi");
    // 21 stays plural in Italian where Ukrainian makes it singular, and a
    // fraction is plural too.
    expect(word("knot", 21)).toBe("nodi");
    expect(word("knot", 1.5)).toBe("nodi");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("knot", undefined, "conversion-target")).toBe("nodi");
  });

  test("an engine built from it reads and writes Italian speed", () => {
    // The plural boundary, both sides of it — `knot` is the one unit here whose
    // output moves across it at all.
    expect(engine.evaluate("1 nodo").formatted).toBe("1 nodo");
    expect(engine.evaluate("5 nodi").formatted).toBe("5 nodi");
    // The Italian numeral fold reaches the same value through a welded word.
    expect(engine.evaluate("cinque nodi").formatted).toBe("5 nodi");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma throughout: "1.5" is not an Italian number, since the
    // full stop is this language's group separator.
    expect(engine.evaluate("1 nodo + 0,5 nodi").formatted).toBe("1,5 nodi");
    // ...and the same sum spelled with Italian's own word for the operator.
    expect(engine.evaluate("1 nodo più 0,5 nodi").formatted).toBe("1,5 nodi");
    // Conversions, with both prepositions the language lists under `in`: knots
    // in, the Italian compound out, joined to the number with no space because
    // `kph` has no forms.
    expect(engine.evaluate("10 nodi in kph").formatted).toBe("18,52 km/h");
    expect(engine.evaluate("37,04 kph a nodi").formatted).toBe("20 nodi");
    // Latin abbreviations still read: an Italian speaker types "mps" and "kmh".
    expect(engine.evaluate("3 mps").formatted).toBe("3 m/s");
    expect(engine.evaluate("1 kmh").formatted).toBe("1 km/h");
    // The imperial row, printed as the contraction Italian borrows whole.
    expect(engine.evaluate("60 mph").formatted).toBe("60 mph");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2000 kph").formatted).toBe("2.000 km/h");
  });

  test("its own output reads back to the same value", () => {
    // `knot` and `mph`. The metric two print on a symbol carrying "/", which the
    // lexer will not take back inside a unit word — it is read as arithmetic
    // instead, which is the bridge the next test wires up.
    for (const input of [
      "1 nodo",
      "5 nodi",
      "1 nodo + 0,5 nodi",
      "37,04 kph a nodi",
      "60 mph",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });

  test("the compound Italian writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "km/h" needs no alias here because it is already a length over a
    // duration, and `speed.ops` names both operands by id string. This is why
    // leaving "chilometri" to `@smartput/length` costs Italian nothing, and why
    // the Italian solidus is affordable where `@smartput/datarate`'s "Mb/s" is
    // not — there, the division has no signature to compute.
    const wired = createEngine({
      locales: [composeLocale(italian, [lengthFixture, durationIt, speedIt])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 km / h");
    expect(bridged.kind).toBe("speed");
    expect(bridged.value?.unit).toBe("mps");
    // 100 km/h is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 km / h in kph").formatted).toBe("100 km/h");
    // The Italian nouns reach the same place, which is the whole point of
    // leaving them to the length vocabulary.
    expect(wired.evaluate("100 chilometri / ora in kph").formatted).toBe("100 km/h");
    expect(wired.evaluate("1852 metri / ora in nodi").formatted).toBe("1 nodo");
    // And the imperial row, whose contraction Italian keeps — reachable both as
    // its own token and through the same bridge.
    expect(wired.evaluate("60 miglia / ora in mph").formatted).toBe("60 mph");
  });
});
