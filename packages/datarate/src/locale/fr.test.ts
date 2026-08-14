import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateFr from "./fr";

const locale = () => composeLocale(french, [datarateFr]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

/** Every key `french.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 0.5, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({ kind: "datarate", unit: "mbps", slot }),
      ),
    ),
);

describe("datarate fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which is exactly the check French cannot borrow: the kind is already full of
  // Latin letters ("bps", "mbps"), so a script test would either pass vacuously
  // or fail on the unit ids themselves. The equivalent claim is the one that can
  // still be made — the *words* this file introduces appear nowhere in the
  // language-free half, which is ratios, unit ids, magnitude bands and four
  // bridge signatures naming their operands by string.
  test("the kind itself carries no French word", () => {
    const descriptor = JSON.stringify(datarate);
    for (const word of ["mégabit", "gigabit", "térabit", "méga", "giga"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`french` asks for exactly two keys, and no unit declares any", () => {
    // The contract the language author pinned: "one" for 0, for 1 and for every
    // fraction below two — French is singular below two — and "other" for
    // everything from 2 up, for CLDR's `many` (which `selectForm` folds away
    // because a French unit noun does not agree with a scale word), and for a
    // conversion target with no count at all.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(
      french.selectForm({
        count: new Decimal("1.5"),
        kind: "datarate",
        unit: "mbps",
        slot: "bare",
      }),
    ).toBe("one");
    // And this kind fills neither, for the reason the vocabulary's doc comment
    // gives: "mégabits par seconde" is three words and the middle one is this
    // language's `by` keyword, so a `forms` table here would be prose whose own
    // second token the fold reads as an operator. Rule 6 is satisfied by an
    // empty key set, not by two rows of unreachable French.
    for (const [unit, words] of Object.entries(datarateFr.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The property `assertLocaleContract` checks for aliases and this file checks
  // for the other half of the printer's output. With no `forms` anywhere, the
  // symbol is the only string this vocabulary can emit, so it is the only one
  // that has to read back — and it does so by being an alias of its own unit
  // (case-folded, which is what lets "Mbps" and the derived "mbps" be one key).
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datarateFr.units)) {
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
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes — and in French that category is not the one an English
    // reader would guess: 1,5 selects "one", not "other". This kind declares no
    // forms at all, so nothing can currently fail here; the line is what
    // notices on the day one is added and keyed off English's boundary.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French datarate", () => {
    // French noun in, French symbol out, with the space `french.renderQuantity`
    // sets before every label — where English and Spanish set a symbol tight.
    expect(engine.evaluate("100 mégabits").formatted).toBe("100 Mbps");
    // The bare spelling reaches the same unit: NFKC leaves é alone, so the two
    // are different strings and both are declared.
    expect(engine.evaluate("100 megabits").formatted).toBe("100 Mbps");
    // The colloquial clipping, elided per-second and all.
    expect(engine.evaluate("500 méga").formatted).toBe("500 Mbps");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the French spellings are appended to it.
    expect(engine.evaluate("100 mbps").formatted).toBe("100 Mbps");
    // A conversion, written with "en" — the ordinary French conversion
    // preposition, listed first under `in`. The group separator is U+202F, not a
    // plain space and not U+00A0: a reader that had hardcoded Ukrainian's
    // non-breaking space would print the wrong codepoint here and nothing on
    // screen would show it.
    expect(engine.evaluate("2 gbps en mbps").formatted).toBe(`2${NNBSP}000 Mbps`);
    // ...and with "vers", the directional preposition listed beside it.
    expect(engine.evaluate("2 gbps vers mbps").formatted).toBe(`2${NNBSP}000 Mbps`);
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is not a French number, so a test
    // spelled with a point would be exercising nothing.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5 Mbps");
    expect(engine.evaluate("1,5 gbps en mbps").formatted).toBe(`1${NNBSP}500 Mbps`);
  });

  test("its own output reads back to the same value", () => {
    // The round trip that the narrow no-break space makes worth pinning:
    // `normalize()` folds every `\s` run to one plain space before `lex` sees
    // it, so "2 000 Mbps" arrives here spelled with U+0020 and is held together
    // by the lexer's three-digit lookahead rather than by the character.
    for (const input of [
      "100 mégabits",
      "1 mbps + 500 kbps",
      "2 gbps en mbps",
      "1,5 gigabits",
      "2000 mbps",
      "500 méga",
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
