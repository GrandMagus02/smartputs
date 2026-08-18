import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeAr from "./ar";

const ar = () => composeLocale(arabic, [volumeAr]);
const engine = () => createEngine({ locales: [ar()], kinds: [volume] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = arabic.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeAr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `arabic.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts that
 * the tables agree with the list. Sweeping the counts that move a plural rule in
 * any language in this repo (zero, one, the Arabic dual, the 3-10 band, the
 * teens, a 21 that is `many` in Arabic and `one` in Ukrainian, a hundred, a
 * thousand and two fractions) against all three slots is what shows the answer
 * is six keys on one axis.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      arabic.selectForm({ kind: "volume", unit: "l", slot }),
      ...[0, 1, 2, 3, 5, 10, 11, 21, 99, 100, 103, 111, 1000, 0.5, 1.5].map((n) =>
        arabic.selectForm({ count: new Decimal(n), kind: "volume", unit: "l", slot }),
      ),
    ]),
  ),
].sort();

describe("volume ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Arabic word", () => {
    // The Arabic block, not a list of the four nouns: the kind is ratios, unit
    // ids, magnitude bands and the `area * length` signature, so any character
    // from a script no ratio could contain is the failure. Written as escapes
    // because the block opens with format characters invisible in source.
    expect(JSON.stringify(volume)).not.toMatch(/[\u0600-\u06FF]/u);
  });

  test("selectForm produces exactly the six CLDR categories, on one axis", () => {
    // The contract this whole file keys off, asserted before anything indexes a
    // table with it. Six, where English has two — and *one axis*, unlike
    // Ukrainian's `${case}-${category}`: the case an Arabic preposition governs
    // is a short vowel Arabic does not write, so a slot axis would name the same
    // string in every row. `zero` and `two` are categories no other language
    // shipped here has at all.
    expect(KEYS).toEqual(["few", "many", "one", "other", "two", "zero"]);
  });

  test("the four declined units carry that key set, and m3 carries none", () => {
    for (const unit of ["l", "ml", "gal", "pint"]) {
      expect(Object.keys(volumeAr.units[unit]?.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
    // `m3` is the row every language here agrees has no word to print: "متر
    // مكعب" is two words, `lex` ends a word token at the space, and the printer
    // only ever emits something the parser can read back. It renders through
    // `م³` instead.
    expect(volumeAr.units.m3?.forms).toBeUndefined();
    expect(volumeAr.units.m3?.symbol).toBe("م³");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. Arabic makes that trap wider than
  // any other language here, because the stripper knows ات/ان/ين/ون/ًا and so
  // covers four rows of a sound-plural noun by guesswork.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(volumeAr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(ar(), [volume])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and in most languages that means the fractional row is never
    // sampled at all. Arabic is the case where it *happens* to be covered — 100
    // and 1000 already land on `other`, which is where every fraction goes — and
    // running it anyway is what pins that fact: the day `selectForm` grows a
    // fractional branch of its own, this call fails and the one above does not.
    expect(() =>
      assertLocaleContract(ar(), [volume], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the six rows are six different decisions", () => {
    // The dual, the row no other language in this repo has: a suffix on the
    // noun, not a second word, and reached only by a count of exactly 2.
    expect(word("l", 2)).toBe("لتران");
    expect(word("l", 5)).toBe("لترات");
    // The tamyīz: 11-99 takes the accusative *singular*, ending in the tanwīn
    // and its alif. Reading this row as "the big plural" prints "11 لترات",
    // which is a real Arabic word in the wrong cell.
    expect(word("l", 11)).toBe("لترًا");
    expect(word("l", 99)).toBe("لترًا");
    // The category follows n mod 100, not the leading digit: 103 is `few` and
    // 111 is `many`, so a hundred does not reset the noun to the singular.
    expect(word("l", 103)).toBe("لترات");
    expect(word("l", 111)).toBe("لترًا");
    // zero, one and other are one string in unvocalised writing — they differ
    // only in a final short vowel nobody writes — and repeating it is correct.
    expect(word("l", 0)).toBe("لتر");
    expect(word("l", 1)).toBe("لتر");
    expect(word("l", 100)).toBe("لتر");
    // Every fraction lands on `other`, the genitive singular. A plural here
    // prints "1.5 لترات", which no round-trip in this file would catch.
    expect(word("l", 1.5)).toBe("لتر");
    // The other three declined units take the same endings on their own stems:
    // all four are consonant-final loanwords with sound plurals, so unlike
    // `length` next door there is no broken plural anywhere in this kind.
    expect(word("ml", 2)).toBe("مليلتران");
    expect(word("gal", 5)).toBe("غالونات");
    expect(word("pint", 11)).toBe("باينتًا");
  });

  test("the slot is inert: Arabic's axis is the count alone", () => {
    // Ukrainian's conversion target is locative and Arabic's is not anything at
    // all — the case a preposition governs is a short vowel Arabic does not
    // write. Asserted so that a later reader who adds a slot axis has to delete
    // a test that says why there isn't one.
    for (const count of [1, 2, 5, 11, undefined]) {
      expect(word("l", count, "conversion-target")).toBe(word("l", count, "bare"));
    }
    // And the count-free target (ruling R5) lands on `other` — the genitive
    // SINGULAR, "إلى لتر". The opposite of French, where a bare target is plural.
    expect(word("l", undefined)).toBe("لتر");
  });

  test("an engine built from it reads and writes Arabic volume", () => {
    const e = engine();
    expect(e.evaluate("2 لتر").formatted).toBe("2 لتران");
    expect(e.evaluate("5 لتر").formatted).toBe("5 لترات");
    expect(e.evaluate("11 لتر").formatted).toBe("11 لترًا");
    expect(e.evaluate("2 باينت").formatted).toBe("2 باينتان");
    // A sum landing on a fraction: `other`, the genitive singular, and the
    // decimal point is "." because `arabic.numberFormat` pins the `latn`
    // numbering system rather than reading `Intl`'s default for the bare tag.
    expect(e.evaluate("1 لتر + 500 مل").formatted).toBe("1.5 لتر");
    // A conversion, written with إلى, whose result is a long non-terminating
    // decimal — and still `other`, because every fraction is.
    expect(e.evaluate("1 غالون إلى لتر").formatted).toBe("3.7854 لتر");
    // `m3` has no words to print, so it renders through its symbol — and
    // `arabic.renderQuantity` sets a symbol off from the number with a SPACE
    // where `defaultRenderQuantity` sets it tight, because an Arabic symbol is
    // letters and a digit run glued to letters is a boundary the bidi algorithm
    // has to guess. `en` prints "3m³" for the same value.
    expect(e.evaluate("3 م³").formatted).toBe("3 م³");
    // Both scripts read: an Arabic engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Arabic.
    expect(e.evaluate("2 l").formatted).toBe("2 لتران");
    expect(e.evaluate("500 مل").formatted).toBe("500 مليلتر");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 لتر + 500 مل",
      "1 غالون إلى لتر",
      "11 لتر",
      "3 م³",
      "2 باينت",
      "500 مل",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
    }
  });

  test("the output is logically ordered and carries no bidi controls", () => {
    // Point (c) of the Arabic brief, asserted rather than left to prose. A
    // string is a sequence in logical order, so the number comes first in memory
    // and the bidi algorithm is what puts it on the right at display time.
    // Nothing reverses anything, and nothing wraps the number in isolates
    // (U+2066-2069) or marks (U+200E/200F) — those are invisible characters the
    // lexer would have to read back, and `normalize()` strips only the
    // zero-width family.
    for (const input of ["11 لتر", "3 م³"]) {
      const out = engine().evaluate(input).formatted;
      expect(out).toMatch(/^\d/);
      expect(out).not.toMatch(/[\u200E\u200F\u2066-\u2069]/u);
    }
  });
});
