import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal, defineVocabulary } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationPt from "@smartput/duration/locale/pt";
import { length } from "@smartput/length";
import { speed } from "../index";
import speedPt from "./pt";

const locale = () => composeLocale(portuguese, [speedPt]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `portuguese.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    portuguese.selectForm({ kind: "speed", unit: "knot", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      portuguese.selectForm({
        count: new Decimal(count),
        kind: "speed",
        unit: "knot",
        slot,
      }),
    ),
  ]),
);

/**
 * A three-unit Portuguese length fixture, built here rather than imported.
 *
 * `@smartput/length`'s own Portuguese vocabulary is another translator's work
 * and may not exist yet, and this file must not wait on it to assert the one
 * claim its doc comment makes — that "km/h" needs no alias because it is already
 * a length over a duration. `@smartput/core/locale/pt.test.ts` builds its engine
 * round trip from a local fixture for the same reason. Hand-written aliases are
 * fine *here* precisely because this is a fixture and not a shipped vocabulary:
 * a shipped one derives its Latin set from `units.ts`. Both spellings of the
 * kilometre are listed because that word is the one place Brazilian and European
 * Portuguese disagree — "quilômetro" with a circumflex, "quilómetro" with an
 * acute — and NFKC folds neither into the other.
 */
const lengthFixture = defineVocabulary({
  locale: "pt",
  kind: "length",
  units: {
    m: { aliases: ["m", "metro", "metros"], symbol: "m" },
    km: {
      aliases: ["km", "quilômetro", "quilômetros", "quilómetro", "quilómetros"],
      symbol: "km",
    },
    mi: { aliases: ["mi", "milha", "milhas"], symbol: "mi" },
  },
});

describe("speed pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Portuguese
  // cannot borrow it — the kind is already full of Latin letters, so a script
  // test would fail on its own unit ids — so the words are the check: the kind
  // is ratios, unit ids, magnitude bands and one bridge signature naming its
  // operands by string, and no Portuguese noun may appear in any of it.
  test("the kind itself carries no Portuguese word", () => {
    expect(JSON.stringify(speed)).not.toMatch(/\bn[óo]s?\b|metro|quil[óô]metro|milha/i);
  });

  test("`portuguese` asks for exactly two keys, and only `knot` fills them", () => {
    // The contract the language author pinned: one axis, two rows, no slot
    // dimension. `one` covers 1 and — CLDR's Portuguese rule being `i = 0..1` —
    // also 0 and 1,5; `other` covers everything else including CLDR's third
    // Portuguese category `many`, which `Intl` really returns at 1e6 and which
    // `selectForm` folds away because it is a fact about the numeral rather than
    // about the noun. 1e6 is in the sweep so the fold is sampled rather than
    // read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(speedPt.units.knot?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // The three compounds fill neither, for the reason `en.ts` records and
    // Portuguese sharpens: "quilômetros por hora" is four words and its second
    // is already the `times` keyword, so a table here would be prose the lexer
    // reads as multiplication.
    for (const unit of ["mps", "kph", "mph"] as const) {
      expect(speedPt.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("the three compounds leave the Portuguese head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "quilômetros" for kph here would give "5 quilômetros" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The bridge at the bottom of this file is the path Portuguese gets instead.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedPt.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Portuguese head noun`).not.toMatch(
          /metro|quil[óô]metro|milha|hora|segundo/i,
        );
      }
    }
    expect(speedPt.units.knot?.aliases).toContain("nó");
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way. The three
    // slash-bearing symbols are checked from the other end instead — they are
    // read as arithmetic rather than by lookup, which is the bridge test below,
    // and `assertLocaleContract` skips any surface holding an operator character
    // for exactly that reason.
    for (const [unit, words] of Object.entries(speedPt.units)) {
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
    // fraction takes. Portuguese sends it to `one` rather than `other` — the
    // opposite of English and Spanish — so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`nó`'s two rows are two decisions, and the singular reaches past 1", () => {
    expect(word("knot", 1)).toBe("nó");
    expect(word("knot", 2)).toBe("nós");
    // The integer part decides, so 0 and 1,5 are singular — the two rows a
    // translator borrowing an English or Spanish intuition writes as plurals.
    expect(word("knot", 0)).toBe("nó");
    expect(word("knot", 1.5)).toBe("nó");
    // 21 stays plural in Portuguese where Ukrainian makes it singular.
    expect(word("knot", 21)).toBe("nós");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("knot", undefined, "conversion-target")).toBe("nós");
  });

  test("an engine built from it reads and writes Portuguese speed", () => {
    // The plural boundary, both sides of it — `knot` is the one unit here whose
    // output moves across it at all.
    expect(engine.evaluate("1 nó").formatted).toBe("1 nó");
    expect(engine.evaluate("5 nós").formatted).toBe("5 nós");
    // A sum landing on a fraction, which is where the decimal comma shows and
    // where Portuguese keeps the singular. Written with a comma throughout:
    // "1.5" is not a Portuguese number, since the full stop is the group
    // separator.
    expect(engine.evaluate("1 nó + 0,5 nós").formatted).toBe("1,5 nó");
    // Conversions, with both prepositions the language lists under `in`: knots
    // in, the Portuguese compound out, joined to the number with no space
    // because `kph` has no forms.
    expect(engine.evaluate("10 nós em kph").formatted).toBe("18,52 km/h");
    expect(engine.evaluate("37,04 kph para nós").formatted).toBe("20 nós");
    // Latin abbreviations still read: a Portuguese speaker types "mps" and
    // "kmh" as readily as anything this file adds.
    expect(engine.evaluate("3 mps").formatted).toBe("3 m/s");
    expect(engine.evaluate("1 kmh").formatted).toBe("1 km/h");
    expect(engine.evaluate("60 mph").formatted).toBe("60 mi/h");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2000 kph").formatted).toBe("2.000 km/h");
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which the
    // lexer will not take back inside a unit word — it is read as arithmetic
    // instead, which is the bridge the next test wires up.
    for (const input of ["1 nó", "5 nós", "1 nó + 0,5 nós", "37,04 kph para nós"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });

  test("the compound Portuguese writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "km/h" needs no alias here because it is already a length over a
    // duration, and `speed.ops` names both operands by id string. This is why
    // leaving "quilômetros" to `@smartput/length` costs Portuguese nothing, and
    // why the solidus is affordable here where `@smartput/datarate`'s "Mb/s" is
    // not — there, the division has no signature to compute.
    const wired = createEngine({
      locales: [composeLocale(portuguese, [lengthFixture, durationPt, speedPt])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 km / h");
    expect(bridged.kind).toBe("speed");
    expect(bridged.value?.unit).toBe("mps");
    // 100 km/h is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 km / h em kph").formatted).toBe("100 km/h");
    // The Portuguese nouns reach the same place, which is the whole point of
    // leaving them to the length vocabulary.
    expect(wired.evaluate("100 quilômetros / hora em kph").formatted).toBe("100 km/h");
    expect(wired.evaluate("1852 metros / hora em nós").formatted).toBe("1 nó");
    // And the imperial row, whose symbol is the one an English contraction
    // would have spelled undecomposably.
    expect(wired.evaluate("60 milhas / hora em mph").formatted).toBe("60 mi/h");
  });
});
