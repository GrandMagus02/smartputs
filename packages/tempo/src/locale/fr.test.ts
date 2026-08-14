import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationFr from "@smartput/duration/locale/fr";
import { tempo } from "../index";
import tempoFr from "./fr";

const locale = () => composeLocale(french, [tempoFr]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = french.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `french.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    french.selectForm({ kind: "tempo", unit: "hz", slot }),
    ...[0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      french.selectForm({ count: new Decimal(count), kind: "tempo", unit: "hz", slot }),
    ),
  ]),
);

describe("tempo fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which French
  // cannot borrow: the kind is Latin throughout and "hertz" is the same string
  // in both languages, so a script test would either pass vacuously or fail on
  // the unit ids. The equivalent claim is the one that can still be made — the
  // word this file *introduces* appears nowhere in the language-free half, which
  // is two ratios, two unit ids, magnitude bands and the reciprocal bridge to
  // `duration` naming its operands by string.
  test("the kind itself carries no French word", () => {
    const descriptor = JSON.stringify(tempo);
    for (const w of ["battement", "battements"]) {
      expect(descriptor, `the kind mentions "${w}"`).not.toMatch(
        new RegExp(`\\b${w}\\b`, "i"),
      );
    }
  });

  test("`french` asks for exactly two keys, and only `hz` fills them", () => {
    // The contract the language author pinned: "one" for 0, for 1 and for every
    // fraction below two, "other" from 2 up, for a conversion target with no
    // count (R5), and for CLDR's `many` at 1e6 — folded into `other` by
    // `selectForm`, because a French unit noun agrees with the number rather
    // than with a scale word. 1e6 is in the sweep so the fold is sampled rather
    // than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(tempoFr.units.hz?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // `bpm` fills neither, for the reason the vocabulary's doc comment gives:
    // "battements par minute" is three words and the middle one is this
    // language's `by` keyword, so a table here would be prose whose own second
    // token the fold reads as an operator.
    expect(tempoFr.units.bpm?.forms, "bpm declares a form").toBeUndefined();
  });

  test("`hertz` is invariable in French, and both rows say so", () => {
    // Two identical rows, and the reason is French rather than borrowed: a noun
    // ending in -s, -x or -z takes no plural -s ("un nez", "deux nez"), so "deux
    // hertz" is the plural. English arrives at the same two strings because
    // "hertz" is its own plural there; the agreement is a coincidence of two
    // different rules.
    expect(word("hz", 1)).toBe("hertz");
    expect(word("hz", 2)).toBe("hertz");
    // The French singular boundary is still visible in the *key*, which is what
    // a unit with two different strings would print differently.
    const key = (count: number) =>
      french.selectForm({
        count: new Decimal(count),
        kind: "tempo",
        unit: "hz",
        slot: "bare",
      });
    expect(key(0)).toBe("one");
    expect(key(1.5)).toBe("one");
    expect(key(2)).toBe("other");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("hz", undefined, "conversion-target")).toBe("hertz");
    // And `other` is present rather than dropped: an absent row falls back to
    // the symbol, so "1 hertz" and "2 Hz" would be one value formatted two ways
    // — the failure `@smartput/power/locale/en` records for "horsepower".
    expect(tempoFr.units.hz?.forms?.other).toBeDefined();
  });

  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(tempoFr.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases.map((a) => a.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(
          words.aliases.map((a) => a.toLowerCase()),
          `${unit}: "${form}" is printed but not readable`,
        ).toContain(form.toLowerCase());
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes — and in French that category is "one", not the "other" an
    // English reader would guess. `hz` holds one string in both rows, so nothing
    // can currently differ; the sweep is what notices the day a unit here needs
    // two different strings and is keyed off English's boundary.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French tempo", () => {
    // The symbol, spaced off the number by `french.renderQuantity` where English
    // prints "120bpm" tight.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    // The colloquial elision: a count of beats standing for the rate.
    expect(engine.evaluate("120 battements").formatted).toBe("120 bpm");
    expect(engine.evaluate("1 battement").formatted).toBe("1 bpm");
    // `hz` prints its word rather than its symbol, in both numbers, because it
    // has forms.
    expect(engine.evaluate("2 Hz").formatted).toBe("2 hertz");
    expect(engine.evaluate("1 hertz").formatted).toBe("1 hertz");
    // A conversion, written with "en" — and one that lands past the grouping
    // threshold, so the narrow no-break space shows.
    expect(engine.evaluate("60 Hz en bpm").formatted).toBe(`3${NNBSP}600 bpm`);
    // ...and with "vers", the directional preposition listed beside it.
    expect(engine.evaluate("120 bpm vers hz").formatted).toBe("2 hertz");
    // A sum landing on a fraction, which is where the decimal comma shows.
    expect(engine.evaluate("1 hz + 30 bpm").formatted).toBe("1,5 hertz");
    expect(engine.evaluate("120 bpm + 30 bpm").formatted).toBe("150 bpm");
  });

  test("its own output reads back to the same value", () => {
    // The round trip the narrow no-break space makes worth pinning: `normalize`
    // folds every `\s` run to one plain space before `lex` sees it, so
    // "3 600 bpm" arrives spelled with U+0020 and is held together by the
    // lexer's three-digit lookahead rather than by the character itself.
    for (const input of [
      "120 bpm",
      "120 battements",
      "2 Hz",
      "60 Hz en bpm",
      "1 hz + 30 bpm",
      "1,5 hz",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });

  test("the reciprocal bridge reads and writes French on both sides", () => {
    // `index.ts` answers "what is this tempo as a period" with `in | tempo |
    // duration` rather than with a `spb` unit, and the French half of that
    // answer is `@smartput/duration/locale/fr` — this repo's own vocabulary,
    // not a fixture. Asserted here because the bridge is the only path on which
    // two French vocabularies have to agree, and because "seconde" and "bpm"
    // being one expression is exactly the shape a translator can break without
    // either file's own tests noticing.
    const wired = createEngine({
      locales: [composeLocale(french, [tempoFr, durationFr])],
      kinds: [tempo, duration],
    });
    expect(wired.evaluate("120 bpm en secondes").formatted).toBe("0,5 seconde");
    expect(wired.evaluate("0,5 seconde en bpm").formatted).toBe("120 bpm");
    // And the fraction below two is singular on the duration side too, which is
    // the French rule this whole set of files turns on.
    expect(wired.evaluate("40 bpm en secondes").formatted).toBe("1,5 seconde");
  });
});
