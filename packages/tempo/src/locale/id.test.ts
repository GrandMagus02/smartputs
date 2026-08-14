import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoId from "./id";

const locale = () => composeLocale(indonesian, [tempoId]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `indonesian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    indonesian.selectForm({ kind: "tempo", unit: "hz", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      indonesian.selectForm({
        count: new Decimal(count),
        kind: "tempo",
        unit: "hz",
        slot,
      }),
    ),
  ]),
);

describe("tempo id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Indonesian
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute (every noun carries a capital) does not transfer either, since
  // Indonesian capitalises no common noun. So the words are the check: the kind
  // is two ratios, two unit ids, magnitude bands and the reciprocal bridge to
  // `duration` naming its operands by id string, and no Indonesian word may
  // appear in it. *Hertz* is bound in `units.ts` as an alias, which is the other
  // half of the same separation and the reason it is not in this list.
  test("the kind itself carries no Indonesian word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/ketukan|\bketuk\b|\bmenit\b|\bper\b/i);
  });

  test("`indonesian` asks for exactly one key; `hz` fills it and `bpm` has none", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it: `selectForm` is the constant `() => "other"` because Indonesian
    // has no grammatical plural, no gender and no case. The sweep includes a
    // count-free call (R5) and 1e6, so a CLDR `many` row would surface here
    // rather than at a user.
    expect([...KEYS]).toEqual(["other"]);
    // Rule 6 wants exactly this set from a unit that has words, and an *empty*
    // set from one whose Indonesian name is three words — "ketukan per menit" —
    // rather than one row of prose no input could reach.
    expect(Object.keys(tempoId.units.hz?.forms ?? {})).toEqual([...KEYS]);
    expect(tempoId.units.bpm?.forms, "bpm declares a form").toBeUndefined();
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it, so the SI capital
    // in "Hz" meets the derived lowercase "hz" and a symbol never has to be
    // listed twice. What this catches is the other thing — a printed word
    // reachable only through an analyzer, by accident rather than by
    // declaration. Indonesian cannot afford that gap at all: `indonesian.analyze`
    // is `[identity()]` and there is no stripper behind it to rescue anything.
    for (const [unit, words] of Object.entries(tempoId.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
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
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Indonesian folds every count into `other`, which is the
    // claim worth sampling rather than assuming: the day `selectForm` grows a
    // second row, this is the line that notices before a user does. A tempo in
    // hertz is fractional far more often than it is whole, so this is not a
    // hypothetical count for this kind.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`hertz` is one word for every count, and for no count at all", () => {
    // Where German writes four identical rows and Dutch two, Indonesian writes
    // one — and it is a different claim from theirs. Theirs is a fact about the
    // noun sitting on the invariant side of a live number axis; this is a fact
    // about the language having no axis. `@smartput/duration`'s Indonesian file
    // is where that is measured, on the six time words Dutch has to sort into
    // marked and invariant.
    expect(word("hz", 1)).toBe("hertz");
    expect(word("hz", 2)).toBe("hertz");
    expect(word("hz", 1.5)).toBe("hertz");
    expect(word("hz", 1_000_000)).toBe("hertz");
    // A conversion target carries no count and every language must still answer
    // (R5); the slot changes nothing, because there is no case for a preposition
    // to govern — "dalam hertz" holds the word "dua hertz" holds.
    expect(word("hz", undefined, "conversion-target")).toBe("hertz");
    expect(word("hz", 2, "conversion-target")).toBe(word("hz", 2));
  });

  test("an engine built from it reads and writes Indonesian tempo", () => {
    // `bpm` prints on its symbol and tight, because it has no word to print and
    // `defaultRenderQuantity` sets a symbol against the number; `hz` has a word
    // and is spaced. The split is the cost `@smartput/core/locale/id` takes when
    // it declines a `renderQuantity`, and it is asserted rather than described.
    expect(engine.evaluate("120 bpm").formatted).toBe("120bpm");
    expect(engine.evaluate("2 hz").formatted).toBe("2 hertz");
    // The Indonesian noun for the beat is a way in and never a way out.
    expect(engine.evaluate("120 ketukan").value.unit).toBe("bpm");
    expect(engine.evaluate("120 ketukan").formatted).toBe("120bpm");
    // The bare verb root is deliberately unclaimed, so it fails loudly rather
    // than quietly meaning something.
    expect(() => engine.evaluate("120 ketuk")).toThrow();
    // Conversions, with both particles the language lists under `in`.
    expect(engine.evaluate("2 hz dalam bpm").formatted).toBe("120bpm");
    expect(engine.evaluate("60 bpm ke hz").formatted).toBe("1 hertz");
    // A sum landing on a fraction, in both spellings of addition. Written with a
    // comma on purpose: "1.5" is fifteen hundred here, so a test spelled with a
    // full stop would be exercising the group separator — which the row below
    // exercises deliberately instead.
    expect(engine.evaluate("1 hz + 30 bpm").formatted).toBe("1,5 hertz");
    expect(engine.evaluate("1 hz tambah 30 bpm").formatted).toBe("1,5 hertz");
    // The remaining word operators the language claims.
    expect(engine.evaluate("2 hz kurang 30 bpm").formatted).toBe("1,5 hertz");
    expect(engine.evaluate("60 bpm kali 2").formatted).toBe("120bpm");
    expect(engine.evaluate("3 hz bagi 2").formatted).toBe("1,5 hertz");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2000 bpm").formatted).toBe("2.000bpm");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "120 bpm",
      "2 hz",
      "120 ketukan",
      "2 hz dalam bpm",
      "60 bpm ke hz",
      "1 hz tambah 30 bpm",
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
