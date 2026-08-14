import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureHi from "./hi";

const [readingHi, deltaHi] = temperatureHi;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(hindi, temperatureHi);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/** Devanagari, which is every letter this vocabulary writes. */
const DEVANAGARI = /\p{Script=Devanagari}/u;

/** The key `hindi` will index a unit's `forms` with, for this count and slot. */
const key = (slot: "bare" | "after-number" | "conversion-target", count?: number) =>
  hindi.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "temperature",
    unit: "c",
    slot,
  });

describe("temperature hi vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureHi.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureHi) expect(vocabulary.locale).toBe("hi");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingHi?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaHi?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureHi) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.length,
          `${vocabulary.kind}:${unit} has no aliases`,
        ).toBeGreaterThan(0);
        expect(words.symbol, `${vocabulary.kind}:${unit} has no symbol`).toBeDefined();
      }
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets "20 C जोड़ 5 F" read its right
  // operand as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written against.
  // Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, both scripts included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaHi?.units[unit]?.aliases).toEqual(
        readingHi?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a Hindi engine still reads "212 F"; the Devanagari half is
    // appended.
    expect(readingHi?.units.c?.aliases).toContain("c");
    expect(readingHi?.units.c?.aliases).toContain("celsius");
    expect(readingHi?.units.c?.aliases).toContain("सेल्सियस");
    expect(deltaHi?.units.k?.aliases).toContain("केल्विनों");
  });

  // The trap that would make a table test green and be unreachable through the
  // engine: फ़ (U+095E) is a Unicode composition *exclusion*, so NFKC — which
  // `normalize()` applies before a word reaches the resolver — decomposes it into
  // फ + U+093C. An alias written with the precomposed character would never match
  // anything a user typed, and every shape test in this file would still pass.
  test("every alias survives NFKC unchanged", () => {
    for (const vocabulary of temperatureHi) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.filter((a) => a.normalize("NFKC") !== a),
          `${vocabulary.kind}:${unit}`,
        ).toEqual([]);
      }
    }
    // And the nukta-less twin beside it, which no normalization will ever produce
    // from the nukta-bearing one: फ and फ़ are different letters.
    expect(readingHi?.units.f?.aliases).toContain("फ़ारेनहाइट");
    expect(readingHi?.units.f?.aliases).toContain("फारेनहाइट");
  });

  // The per-unit decision is `en`'s, and re-taken rather than copied. Two things
  // about Hindi could have overturned it and neither does: the spelled form is two
  // tokens in every register ("२० डिग्री सेल्सियस") and a word token ends at a
  // space, so a printed word form would be a string the parser cannot read back;
  // and the two categories would hold one string twice, because सेल्सियस,
  // फ़ारेनहाइट and केल्विन are consonant-final masculine loanwords whose direct
  // plural is their singular. Asserting it against `en` rather than against
  // `undefined` is what makes the mirror the thing under test — if a later phase
  // gives an English temperature unit words, this fails until Hindi follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [hi, en] of [
      [readingHi, readingEn],
      [deltaHi, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(hi?.units[unit]?.forms, `${hi?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(hi?.units[unit]?.forms, `${hi?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no script but ASCII may reach it.
  // Devanagari anywhere in either descriptor would mean a translation had leaked
  // into the half of the package that is supposed to be language-free.
  test("the kinds themselves carry no Hindi word", () => {
    expect(JSON.stringify(temperature)).not.toMatch(DEVANAGARI);
    expect(JSON.stringify(tempdelta)).not.toMatch(DEVANAGARI);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* at all — and in
    // Hindi a fraction below 1 lands on the *singular*, which is the boundary
    // English does not have. A fractional count is added for the same reason every
    // other `hi` vocabulary adds one, except that here it can only confirm the
    // absence of a `forms` table, since a unit with none is skipped before any key
    // is asked for. That is the honest shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  // `hindi.selectForm` still answers for these units — it is a function of the
  // count and the slot, and knows nothing about which units have tables — so the
  // reason the two categories go unexercised here is the missing `forms`, not a
  // missing key. Pinning that keeps the output test below honest: it asserts the
  // string does not move across the plural boundary, and this says why.
  test("selectForm produces two keys this kind has no table to index", () => {
    // The row a table ported from `en` gets wrong: Hindi's `one` is CLDR's `i = 0
    // or n = 1`, so 0 and every fraction below 1 are singular where English puts
    // 0 in `other`.
    expect(key("after-number", 0)).toBe("one");
    expect(key("after-number", 0.5)).toBe("one");
    expect(key("after-number", 1)).toBe("one");
    expect(key("after-number", 1.5)).toBe("other");
    expect(key("after-number", 2)).toBe("other");
    expect(key("after-number", 300)).toBe("other");
    // No case axis: the oblique that a postposition governs lives in `hindi`'s
    // analyzer chain, not in a second `forms` dimension, so the slot names the
    // same key in every direction.
    expect(key("bare", 5)).toBe(key("after-number", 5));
    expect(key("conversion-target", 5)).toBe(key("after-number", 5));
    // Ruling R5: a conversion target has no count, and CLDR's generic category
    // answers for it.
    expect(key("conversion-target")).toBe("other");
    expect(new Set([0, 0.5, 1, 1.5, 2, 5, 100].map((n) => key("bare", n)))).toEqual(
      new Set(["one", "other"]),
    );
    expect(readingHi?.units.c?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Hindi temperature", () => {
    const e = engine();
    // The point of a symbol-only kind: the output does *not* move across Hindi's
    // plural boundary. 0.5 selects `one` and 1.5 selects `other` — a genuine
    // difference in a kind that has words — but no `forms` table exists to index,
    // so both render through `symbol` and the formatter never asks the language
    // for a key at all. A vocabulary that had invented two Hindi rows here would
    // print "२ डिग्री सेल्सियस", which no parser in this engine can read back,
    // because it is three tokens.
    expect(e.evaluate("0.5 केल्विन").formatted).toBe("0.5K");
    expect(e.evaluate("1.5 केल्विन").formatted).toBe("1.5K");
    expect(e.evaluate("2 केल्विन").formatted).toBe("2K");
    // Note the *absence* of a space, and that it is the language's decision rather
    // than this file's: `hindi.renderQuantity` branches on the script of the
    // symbol, spacing a Devanagari abbreviation off from the number ("5 किग्रा")
    // and closing up a Latin one. All three symbols here are Latin, so Hindi
    // prints "20°C" tight exactly as English does — and unlike Arabic, which
    // spaces every symbol.
    expect(e.evaluate("20 सेल्सियस").formatted).toBe("20°C");
    expect(e.evaluate("100 फ़ारेनहाइट").formatted).toBe("100°F");
    // The nukta-less spelling and the two Devanagari synonyms: सेंटीग्रेड is
    // "centigrade", which Hindi school physics still uses, and सेल्सीयस writes the
    // same syllable with a long ी.
    expect(e.evaluate("100 फारेनहाइट").formatted).toBe("100°F");
    expect(e.evaluate("20 सेंटीग्रेड").formatted).toBe("20°C");
    expect(e.evaluate("20 सेल्सीयस").formatted).toBe("20°C");
    // The oblique plural, which is what a postposition demands of a plural noun —
    // "३०० केल्विनों में सेल्सियस". `hindi`'s suffix stripper would recover it at
    // `weight: -2`; listing it makes it a full-weight reading.
    expect(e.evaluate("300 केल्विनों").formatted).toBe("300K");
    // A conversion through each of Hindi's three `in` postpositions, all listed
    // under one keyword in `@smartput/core/locale/hi`: में ("in"), को (the
    // accusative marker a full sentence uses) and से ("from"), which is the word
    // over every conversion table printed in Hindi.
    expect(e.evaluate("300 K में सेल्सियस").formatted).toBe("26.85°C");
    expect(e.evaluate("212 F को C").formatted).toBe("100°C");
    expect(e.evaluate("212 F से सेल्सियस").formatted).toBe("100°C");
    // A conversion whose result groups, which is where Hindi's grouping gap shows
    // in this kind: `Intl.NumberFormat("hi")` writes 9,032 the same way here, but
    // the ladder diverges above a lakh — see `hi.test.ts` in `@smartput/number`
    // for the pin.
    expect(e.evaluate("5000 C में F").formatted).toBe("9,032°F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 सेल्सियस घटा 20 सेल्सियस");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // Two spellings a Hindi speaker genuinely writes and this vocabulary
  // deliberately does not claim. Recorded as assertions rather than left in a
  // comment, following `@smartput/power`'s "к.с." precedent: an alias the lexer
  // cannot produce, or one that would steal a commoner reading, is dead weight
  // that reads as coverage.
  test("records the Hindi spellings this vocabulary declines", () => {
    const aliases = readingHi?.units.c?.aliases ?? [];
    // डिग्री is the counted noun of every Hindi temperature phrase — and it is
    // also Hindi for the *angular* degree, `@smartput/angle`'s own unit. Claiming
    // it would make "90 डिग्री" a temperature candidate in every composed engine,
    // and the phrase it belongs to is two tokens anyway, which no alias can carry.
    expect(aliases).not.toContain("डिग्री");
    expect(() => engine().evaluate("20 डिग्री सेल्सियस")).toThrow();
    // "°से" is the Devanagari clipping older print sets for Celsius, and
    // `parse/lex.ts` skips "°" as an unrecognized character — so the input reaches
    // the resolver as a bare से, which is already one of Hindi's three `in`
    // keywords. Claiming it would trade a spelling the lexer has already thrown
    // the "°" away from for an ambiguity on a connective.
    expect(aliases).not.toContain("°से");
    expect(aliases).not.toContain("से");
    expect(() => engine().evaluate("20 °से")).toThrow();
  });

  // Devanagari digits, inherited and pinned here because the failure is silent:
  // `lex` decides digit-ness with an ASCII range test and २ is `\p{Nd}`, so it is
  // skipped as an unrecognized character and "२० सेल्सियस" loses its number
  // entirely, leaving a bare unit that reads as one degree. Closing it needs a
  // digit-folding pass in `normalize()`, which is core's; do not "fix" it by
  // putting digits in `aliases`.
  test("Devanagari digits are dropped by the lexer, not read", () => {
    const e = engine();
    expect(e.evaluate("२० सेल्सियस").formatted).toBe("1°C");
    expect(() => e.evaluate("२०")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20 सेल्सियस",
      "0.5 केल्विन",
      "1.5 केल्विन",
      "100 फ़ारेनहाइट",
      "300 केल्विनों",
      "300 K में सेल्सियस",
      "5000 C में F",
      "30 सेल्सियस घटा 20 सेल्सियस",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
