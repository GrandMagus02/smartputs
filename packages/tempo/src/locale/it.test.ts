import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoIt from "./it";

const locale = () => composeLocale(italian, [tempoIt]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = italian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoIt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `italian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    italian.selectForm({ kind: "tempo", unit: "hz", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      italian.selectForm({ count: new Decimal(count), kind: "tempo", unit: "hz", slot }),
    ),
  ]),
);

describe("tempo it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Italian cannot
  // borrow it — the kind is two ratios and two Latin unit ids, so a script test
  // would fail on its own ids — so the words are the check. "battiti" and
  // "pulsazioni" are the Italian nouns this file deliberately does not register,
  // and the kind must not carry them either.
  test("the kind itself carries no Italian word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/battit[oi]|pulsazion[ei]|minuto/i);
  });

  test("`italian` asks for exactly two keys, and only `hz` fills them", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment. The slot is ignored
    // throughout, Italian nouns having no case.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(tempoIt.units.hz?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // And `bpm` fills neither: "battiti per minuto" is three words and its
    // middle one is already the `times` keyword, so a table here would be prose
    // the lexer reads as multiplication.
    expect(tempoIt.units.bpm?.forms, "bpm declares a form").toBeUndefined();
  });

  test("`hertz` is invariant, and both rows say so", () => {
    // Where Spanish coined *hercio* and got two different strings, Italian
    // borrowed the word whole and gets one. Both rows are declared anyway — an
    // absent `other` would fall back to the symbol and print "2Hz" beside
    // "1 hertz", the same value formatted two ways.
    expect(word("hz", 1)).toBe("hertz");
    expect(word("hz", 2)).toBe("hertz");
    expect(word("hz", 0)).toBe("hertz");
    expect(word("hz", 21)).toBe("hertz");
    expect(word("hz", 1.5)).toBe("hertz");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("hz", undefined, "conversion-target")).toBe("hertz");
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "Hz" be the symbol while "hz" is the alias. What this catches is
    // a printed word reachable only through `italian`'s `pluralFold`, at its -2
    // penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(tempoIt.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
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
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Italian folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Italian tempo", () => {
    // `bpm` has no forms, so it stays on the symbol and is set tight; `hz` has
    // them, so its word is spaced.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("1 hz").formatted).toBe("1 hertz");
    expect(engine.evaluate("2 hz").formatted).toBe("2 hertz");
    // The Italian numeral fold, which welds a whole sub-million cardinal into
    // one word: "centoventi" is cento + venti and nothing else in this repo's
    // languages would have written it that way.
    expect(engine.evaluate("centoventi bpm").formatted).toBe("120 bpm");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 hz in bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("120 bpm a hz").formatted).toBe("2 hertz");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is not an Italian number, since the
    // full stop is this language's group separator.
    expect(engine.evaluate("1 hz + 30 bpm").formatted).toBe("1,5 hertz");
    // ...and the same sum spelled with Italian's own word for the operator.
    expect(engine.evaluate("1 hz più 30 bpm").formatted).toBe("1,5 hertz");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2000 bpm").formatted).toBe("2.000 bpm");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "120 bpm",
      "1 hz",
      "2 hz",
      "1 hz + 30 bpm",
      "2 hz in bpm",
      "1,5 hertz",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
