import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal, defineVocabulary } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationFr from "@smartput/duration/locale/fr";
import { length } from "@smartput/length";
import { speed } from "../index";
import speedFr from "./fr";

const locale = () => composeLocale(french, [speedFr]);
const engine = createEngine({ locales: [locale()], kinds: [speed] });

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = french.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `french.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    french.selectForm({ kind: "speed", unit: "knot", slot }),
    ...[0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      french.selectForm({
        count: new Decimal(count),
        kind: "speed",
        unit: "knot",
        slot,
      }),
    ),
  ]),
);

/**
 * A three-unit French length fixture, built here rather than imported.
 *
 * `@smartput/length`'s own French vocabulary is another translator's work and
 * may not exist yet, and this file must not wait on it to assert the one claim
 * its doc comment makes — that "km/h" needs no alias because it is already a
 * length over a duration. Hand-written aliases are fine *here* precisely because
 * this is a fixture and not a shipped vocabulary: a shipped one derives its
 * Latin set from `units.ts`.
 *
 * The mile is spelled "mile" rather than the French "mille", and that is the
 * hazard the speed vocabulary's own doc comment names: `frenchNumerals` claims
 * "mille" as the cardinal 1000, so a fixture using it would be testing the
 * numeral fold rather than the bridge.
 */
const lengthFixture = defineVocabulary({
  locale: "fr",
  kind: "length",
  units: {
    m: { aliases: ["m", "mètre", "mètres", "metre", "metres"], symbol: "m" },
    km: {
      aliases: ["km", "kilomètre", "kilomètres", "kilometre", "kilometres"],
      symbol: "km",
    },
    mi: { aliases: ["mi", "mile", "miles"], symbol: "mi" },
  },
});

describe("speed fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. French cannot
  // borrow it — the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids — so the words are the check: the kind is
  // ratios, unit ids, magnitude bands and one bridge signature naming its
  // operands by string, and no French noun may appear in any of it.
  test("the kind itself carries no French word", () => {
    expect(JSON.stringify(speed)).not.toMatch(/n(œ|oe)ud|m[èe]tre|kilom[èe]tre/i);
  });

  test("`french` asks for exactly two keys, and only `knot` fills them", () => {
    // The contract the language author pinned: "one" for 0, for 1 and for every
    // fraction below two, "other" from 2 up, for a conversion target with no
    // count (R5), and for CLDR's `many` at 1e6, which `selectForm` folds away
    // because a French unit noun agrees with the number rather than with a scale
    // word. 1e6 is in the sweep so the fold is sampled rather than read from a
    // doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(speedFr.units.knot?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // The three compounds fill neither, for the reason `en.ts` records and
    // French sharpens: "kilomètres par heure" is four words and its second is
    // already this language's `by` keyword, so a table here would be prose whose
    // own middle token the fold reads as an operator.
    for (const unit of ["mps", "kph", "mph"] as const) {
      expect(speedFr.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("the three compounds leave the French head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming "kilomètres" for kph here would give "5 kilomètres" a second
    // reading in the `@smartput/kinds` barrel, where both kinds are installed.
    // The bridge at the bottom of this file is the path French gets instead.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedFr.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a French head noun`).not.toMatch(
          /m[èe]tre|kilom[èe]tre|mille|heure|seconde/i,
        );
      }
    }
    expect(speedFr.units.knot?.aliases).toContain("nœud");
  });

  test("the ligature survives NFKC, which is why both spellings are declared", () => {
    // U+0153 LATIN SMALL LIGATURE OE has no compatibility decomposition, so
    // `normalize()` leaves "nœud" as typed and "noeud" is a different string. A
    // vocabulary that listed only the ligature would be unreachable from a
    // keyboard layout without it.
    expect("nœud".normalize("NFKC")).toBe("nœud");
    expect("nœud").not.toBe("noeud");
    expect(speedFr.units.knot?.aliases).toContain("noeud");
    expect(speedFr.units.knot?.aliases).toContain("noeuds");
    // And the lexer needs nothing from the language to take it: U+0153 is
    // `\p{L}`, so "nœuds" is one word token.
    expect(engine.evaluate("5 nœuds").value?.unit).toBe("knot");
    expect(engine.evaluate("5 noeuds").value?.unit).toBe("knot");
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way. The three
    // slash-bearing symbols are checked from the other end instead — they are
    // read as arithmetic rather than by lookup, which is the bridge test below,
    // and `assertLocaleContract` skips any surface holding an operator character
    // for exactly that reason.
    for (const [unit, words] of Object.entries(speedFr.units)) {
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
    // fraction takes — and in French that category is "one", not the "other" an
    // English reader would guess, so `knot`'s singular row is what a 1,5 count
    // indexes. Sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [speed], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`nœud`'s two rows split at two, not at one", () => {
    expect(word("knot", 1)).toBe("nœud");
    expect(word("knot", 2)).toBe("nœuds");
    // The three rows an English table gets wrong: French is singular below two,
    // zero included.
    expect(word("knot", 0)).toBe("nœud");
    expect(word("knot", 1.5)).toBe("nœud");
    expect(word("knot", 1.9)).toBe("nœud");
    // 21 is plural in French, where Ukrainian makes it singular.
    expect(word("knot", 21)).toBe("nœuds");
    // A conversion target carries no count and must still be answered (R5);
    // French names the target in the plural.
    expect(word("knot", undefined, "conversion-target")).toBe("nœuds");
  });

  test("an engine built from it reads and writes French speed", () => {
    // The plural boundary, both sides of it — `knot` is the one unit here whose
    // output moves across it at all.
    expect(engine.evaluate("1 nœud").formatted).toBe("1 nœud");
    expect(engine.evaluate("5 nœuds").formatted).toBe("5 nœuds");
    // A sum landing on a fraction: the decimal comma, and the singular French
    // keeps at 1,5 where English would print "1.5 knots".
    expect(engine.evaluate("1 nœud + 0,5 nœuds").formatted).toBe("1,5 nœud");
    // Conversions, with both prepositions the language lists under `in`. The
    // compound symbol is spaced off the number, because `french.renderQuantity`
    // spaces every label — where Spanish and English set a symbol tight.
    expect(engine.evaluate("10 nœuds en kph").formatted).toBe("18,52 km/h");
    expect(engine.evaluate("37,04 kph vers nœuds").formatted).toBe("20 nœuds");
    // Latin abbreviations still read: a French speaker types "mps" and "kmh".
    expect(engine.evaluate("3 mps").formatted).toBe("3 m/s");
    expect(engine.evaluate("1 kmh").formatted).toBe("1 km/h");
    expect(engine.evaluate("60 mph").formatted).toBe("60 mi/h");
    // Grouping is U+202F, from CLDR through `numberFormat: "intl"` — a narrow
    // no-break space, not the U+00A0 Ukrainian uses and not a plain space.
    expect(engine.evaluate("2000 kph").formatted).toBe(`2${NNBSP}000 km/h`);
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which the
    // lexer will not take back inside a unit word — it is read as arithmetic
    // instead, which is the bridge the next test wires up.
    for (const input of [
      "1 nœud",
      "5 nœuds",
      "1 nœud + 0,5 nœuds",
      "37,04 kph vers nœuds",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });

  test("the compound French writes is read through the kind's bridge", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted: "km/h" needs no alias here because it is already a length over a
    // duration, and `speed.ops` names both operands by id string. This is why
    // leaving "kilomètres" to `@smartput/length` costs French nothing, and why
    // the French solidus is affordable where `@smartput/datarate`'s "Mbit/s" is
    // not — there, the division has no signature to compute.
    const wired = createEngine({
      locales: [composeLocale(french, [lengthFixture, durationFr, speedFr])],
      kinds: [length, duration, speed],
    });
    const bridged = wired.evaluate("100 km / h");
    expect(bridged.kind).toBe("speed");
    expect(bridged.value?.unit).toBe("mps");
    // 100 km/h is 100000/3600 m/s. Asserted through a conversion so the
    // repeating decimal stays out of the expectation.
    expect(wired.evaluate("100 km / h en kph").formatted).toBe("100 km/h");
    // The French nouns reach the same place, which is the whole point of leaving
    // them to the length vocabulary — and the duration half of the compound is
    // this repo's own French duration vocabulary, not a fixture.
    expect(wired.evaluate("100 kilomètres / heure en kph").formatted).toBe("100 km/h");
    expect(wired.evaluate("1852 mètres / heure en nœuds").formatted).toBe("1 nœud");
    // And the imperial row, whose symbol is the one an English contraction would
    // have spelled undecomposably.
    expect(wired.evaluate("60 miles / heure en mph").formatted).toBe("60 mi/h");
  });
});
