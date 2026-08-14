import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureAr from "./ar";
import temperatureEn from "./en";

const [readingAr, deltaAr] = temperatureAr;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(arabic, temperatureAr);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/** Arabic and Arabic Supplement, which is every letter this phase can write. */
const ARABIC = /[؀-ۿݐ-ݿ]/;

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (slot: "after-number" | "conversion-target", count?: number) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "temperature",
    unit: "c",
    slot,
  });

describe("temperature ar vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureAr.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureAr) expect(vocabulary.locale).toBe("ar");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingAr?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaAr?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureAr) {
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
  // same words on purpose — that is what lets "20 C + 5 F" read its right operand
  // as a difference — and it is also what makes every temperature alias ambiguous,
  // which `print/unit-word.ts`'s ambiguity fallback is written against. Two lists
  // that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, both scripts included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaAr?.units[unit]?.aliases).toEqual(
        readingAr?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so an Arabic engine still reads "212 F"; the Arabic half is
    // appended.
    expect(readingAr?.units.c?.aliases).toContain("c");
    expect(readingAr?.units.c?.aliases).toContain("celsius");
    expect(readingAr?.units.c?.aliases).toContain("مئوية");
    expect(deltaAr?.units.k?.aliases).toContain("كلفنات");
  });

  // The per-unit decision is `en`'s, and re-taken rather than copied: the Arabic
  // spelled form is two tokens in every register ("٢٠ درجة مئوية"), a word token
  // ends at a space, and the printer's spelled path only ever emits a word the
  // parser can read back. Asserting it against `en` rather than against `undefined`
  // is what makes the mirror the thing under test — if a later phase gives an
  // English temperature unit words, this fails until Arabic follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [ar, en] of [
      [readingAr, readingEn],
      [deltaAr, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(ar?.units[unit]?.forms, `${ar?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(ar?.units[unit]?.forms, `${ar?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no script but ASCII may reach it.
  // Arabic anywhere in either descriptor would mean a translation had leaked into
  // the half of the package that is supposed to be language-free.
  test("the kinds themselves carry no Arabic word", () => {
    expect(JSON.stringify(temperature)).not.toMatch(ARABIC);
    expect(JSON.stringify(tempdelta)).not.toMatch(ARABIC);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* — the row Arabic
    // spells as a genitive singular where French spells it plural. A fractional
    // count is added for the same reason every other `ar` vocabulary adds one,
    // except that here it can only confirm the absence of a `forms` table, since a
    // unit with none is skipped before any key is asked for. That is the honest
    // shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic temperature", () => {
    const e = engine();
    // The point of a symbol-only kind: the output does *not* move across any of
    // Arabic's five plural boundaries. 2 selects the dual and 11 the tamyīz — two
    // genuinely different Arabic words in a kind that has any — but no `forms`
    // table exists to index, so both render through `symbol` and the formatter
    // never asks the language for a key at all. A vocabulary that had invented six
    // Arabic keys here would print "٢ درجتان مئويتان", which no parser in this
    // engine can read back, because it is three tokens.
    expect(e.evaluate("2 كلفن").formatted).toBe("2 K");
    expect(e.evaluate("11 كلفن").formatted).toBe("11 K");
    // The fractional row, which in a sibling `ar` vocabulary is the genitive
    // singular — and here is again just the symbol, with the "." decimal
    // `arabic.numberFormat` transcribes.
    expect(e.evaluate("1.5 كلفن").formatted).toBe("1.5 K");
    // Arabic in, Latin symbol out, for the two scale names Arabic writes as
    // degrees: °C and °F are what Arabic print uses, Latin letters included.
    expect(e.evaluate("20 مئوية").formatted).toBe("20 °C");
    expect(e.evaluate("100 فهرنهايت").formatted).toBe("100 °F");
    // The transliterated name beside the adjective, and the masculine form of the
    // adjective beside the feminine: all three are one unit.
    expect(e.evaluate("20 سيلسيوس").formatted).toBe("20 °C");
    expect(e.evaluate("20 مئوي").formatted).toBe("20 °C");
    // The dual and the plural of the one countable noun of the three. Both are
    // recoverable by the language's suffix stripper at `weight: -2`; listing them
    // is what makes them full-weight readings.
    expect(e.evaluate("2 كلفنان").formatted).toBe("2 K");
    expect(e.evaluate("5 كلفنات").formatted).toBe("5 K");
    // A conversion, read with إلى ("to") and printed in the target scale. Both
    // operands' words come from this file; the offsets come from the kind.
    expect(e.evaluate("300 K إلى مئوية").formatted).toBe("26.85 °C");
    expect(e.evaluate("212 F إلى C").formatted).toBe("100 °C");
    // في is the other spelling of `in`, listed under the same keyword — a unit
    // reachable through only one of them would stop resolving the moment the user
    // picked the other preposition.
    expect(e.evaluate("212 F في مئوية").formatted).toBe("100 °C");
    // A conversion whose result groups: Arabic groups thousands with "," — the
    // transcribed `latn` separator — which unlike Russian's U+00A0 survives
    // `normalize()` and reads back.
    expect(e.evaluate("5000 C إلى F").formatted).toBe("9,032 °F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 مئوية ناقص 20 مئوية");
    expect(diff.formatted).toBe("10 °C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // Two words an Arabic speaker genuinely writes and this vocabulary deliberately
  // does not claim. Recorded as assertions rather than left in a comment,
  // following `@smartput/power`'s "к.с." precedent: an alias the lexer cannot
  // produce, or one that would steal a commoner reading, is dead weight that reads
  // as coverage.
  test("records the Arabic spellings this vocabulary declines", () => {
    const aliases = readingAr?.units.c?.aliases ?? [];
    // درجة is the counted noun of every Arabic temperature phrase — and it is also
    // Arabic for the *angular* degree, `@smartput/angle`'s own unit. Claiming it
    // would make "90 درجة" a temperature candidate in every composed engine, and
    // the phrase it belongs to is two tokens anyway, which no alias can carry.
    expect(aliases).not.toContain("درجة");
    expect(() => engine().evaluate("20 درجة مئوية")).toThrow();
    // "°م" is how an Arabic weather page sets Celsius, and `parse/lex.ts` skips
    // "°" as an unrecognized character — so that input reaches the resolver as a
    // bare م, which is already Arabic for the metre. The clipped symbol is left
    // unclaimed rather than traded for an ambiguity on the commonest unit in the
    // library.
    expect(aliases).not.toContain("°م");
    expect(aliases).not.toContain("م");
    expect(() => engine().evaluate("20 °م")).toThrow();
  });

  // `arabic.selectForm` still answers for these units — it is a function of the
  // count and the slot, and knows nothing about which units have tables — so the
  // reason the six-category grammar is unexercised here is the missing `forms`, not
  // a missing key. Pinning that keeps the previous test honest: it asserts output
  // does not move across the plural boundaries, and this says why.
  test("selectForm produces six keys this kind has no table to index", () => {
    expect(key("after-number", 0)).toBe("zero");
    expect(key("after-number", 1)).toBe("one");
    // The dual, which no other language in this repo has.
    expect(key("after-number", 2)).toBe("two");
    expect(key("after-number", 5)).toBe("few");
    // Not a plural: the accusative singular with tanwīn, the tamyīz.
    expect(key("after-number", 11)).toBe("many");
    // Decided by n mod 100, which is why 103 goes back to `few`.
    expect(key("after-number", 103)).toBe("few");
    expect(key("after-number", 111)).toBe("many");
    // The fractional row, where Arabic writes a genitive SINGULAR.
    expect(key("after-number", 1.5)).toBe("other");
    // Ruling R5, and Arabic's inert slot: the case a preposition governs is a
    // short vowel Arabic does not write, so `conversion-target` names the same key
    // `bare` does.
    expect(key("conversion-target")).toBe("other");
    expect(key("conversion-target", 2)).toBe("two");
    expect(readingAr?.units.c?.forms).toBeUndefined();
  });

  // Right-to-left, asserted so a later reader does not "fix" it. The rendered
  // string is in *logical* order — the number first, the symbol second — and the
  // Unicode Bidirectional Algorithm is what puts the number on the right at
  // display time. Reversing the parts would emit the symbol first in memory, which
  // `parse` reads as a unit followed by a number; bidi isolates (U+2066–2069) are
  // invisible characters `normalize()` does not strip, so they would travel into
  // the lexer.
  test("the rendered quantity is logically ordered and carries no bidi controls", () => {
    const formatted = engine().evaluate("20 مئوية").formatted;
    expect(formatted).toBe("20 °C");
    expect(formatted.indexOf("20")).toBeLessThan(formatted.indexOf("°C"));
    expect(formatted).not.toMatch(/[‎‏⁦-⁩]/);
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Including the grouped conversion, which Russian's row cannot round-trip: `ru`
    // groups with U+00A0 and `parse/normalize.ts` folds it to a plain space, so
    // "9 032°F" comes back as two numbers. Arabic groups with ",", which survives
    // both.
    for (const input of [
      "20 مئوية",
      "1.5 كلفن",
      "100 فهرنهايت",
      "300 K إلى مئوية",
      "5000 C إلى F",
      "30 مئوية ناقص 20 مئوية",
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
