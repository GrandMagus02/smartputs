import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaAr from "./ar";

const ar = () => composeLocale(arabic, [areaAr]);
const engine = () => createEngine({ locales: [ar()], kinds: [area] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = arabic.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaAr.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      arabic.selectForm({ kind: "area", unit: "hectare", slot }),
      ...[0, 1, 2, 3, 5, 10, 11, 21, 99, 100, 103, 111, 1000, 0.5, 1.5].map((n) =>
        arabic.selectForm({
          count: new Decimal(n),
          kind: "area",
          unit: "hectare",
          slot,
        }),
      ),
    ]),
  ),
].sort();

describe("area ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Arabic word", () => {
    // The Arabic block, not a list of the two nouns: the kind is ratios, unit
    // ids, magnitude bands and the `length * length` signature, so any character
    // from a script no ratio could contain is the failure. Written as escapes
    // because the block opens with format characters invisible in source.
    expect(JSON.stringify(area)).not.toMatch(/[\u0600-\u06FF]/u);
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

  test("only the units Arabic writes out carry forms", () => {
    // The same per-unit decision `en` and `uk` make: "متر مربع" is two words,
    // `lex` ends a word token at the space, and the printer only ever emits
    // something the parser can read back — so a forms table for the squared
    // units would offer completion text that fails to evaluate. They render
    // through their symbol instead.
    expect(areaAr.units.m2?.forms).toBeUndefined();
    expect(areaAr.units.cm2?.forms).toBeUndefined();
    expect(areaAr.units.km2?.forms).toBeUndefined();
    for (const unit of ["hectare", "acre"] as const) {
      expect(Object.keys(areaAr.units[unit]?.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. Arabic makes that trap wider than
  // any other language here, because the stripper knows ات/ان/ين/ون/ًا and so
  // covers four rows of a sound-plural noun by guesswork, while the hamza
  // spellings of أكر are reachable in one direction only.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(areaAr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(ar(), [area])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and in most languages that means the fractional row is never
    // sampled at all. Arabic is the case where it *happens* to be covered — 100
    // and 1000 already land on `other`, which is where every fraction goes — and
    // running it anyway is what pins that fact: the day `selectForm` grows a
    // fractional branch of its own, this call fails and the one above does not.
    expect(() =>
      assertLocaleContract(ar(), [area], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the six rows are six different decisions", () => {
    // The dual, the row no other language in this repo has: a suffix on the
    // noun, not a second word, and reached only by a count of exactly 2.
    expect(word("hectare", 2)).toBe("هكتاران");
    expect(word("hectare", 5)).toBe("هكتارات");
    // The tamyīz: 11-99 takes the accusative *singular*, ending in the tanwīn
    // and its alif. Reading this row as "the big plural" prints "11 هكتارات",
    // which is a real Arabic word in the wrong cell.
    expect(word("hectare", 11)).toBe("هكتارًا");
    expect(word("hectare", 99)).toBe("هكتارًا");
    // The category follows n mod 100, not the leading digit: 103 is `few` and
    // 111 is `many`, so a hundred does not reset the noun to the singular.
    expect(word("hectare", 103)).toBe("هكتارات");
    expect(word("hectare", 111)).toBe("هكتارًا");
    // zero, one and other are one string in unvocalised writing — they differ
    // only in a final short vowel nobody writes — and repeating it is correct.
    expect(word("hectare", 0)).toBe("هكتار");
    expect(word("hectare", 1)).toBe("هكتار");
    expect(word("hectare", 100)).toBe("هكتار");
    // Every fraction lands on `other`, the genitive singular. A plural here
    // prints "1.5 هكتارات", which no round-trip in this file would catch.
    expect(word("hectare", 1.5)).toBe("هكتار");
    // أكر declines the same way, which is the point of listing it separately:
    // the acre's Arabic name is a transliteration with a hamza, and the
    // orthographic fold only removes hamzas, so both spellings are aliases.
    expect(word("acre", 2)).toBe("أكران");
    expect(areaAr.units.acre?.aliases).toContain("اكر");
  });

  test("the slot is inert: Arabic's axis is the count alone", () => {
    // Ukrainian's conversion target is locative and Arabic's is not anything at
    // all — the case a preposition governs is a short vowel Arabic does not
    // write. Asserted so that a later reader who adds a slot axis has to delete
    // a test that says why there isn't one.
    for (const count of [1, 2, 5, 11, undefined]) {
      expect(word("hectare", count, "conversion-target")).toBe(
        word("hectare", count, "bare"),
      );
    }
    // And the count-free target (ruling R5) lands on `other` — the genitive
    // SINGULAR, "إلى هكتار". The opposite of French, where a bare target is
    // plural.
    expect(word("hectare", undefined)).toBe("هكتار");
  });

  test("an engine built from it reads and writes Arabic area", () => {
    const e = engine();
    expect(e.evaluate("2 هكتار").formatted).toBe("2 هكتاران");
    expect(e.evaluate("5 هكتار").formatted).toBe("5 هكتارات");
    expect(e.evaluate("11 هكتار").formatted).toBe("11 هكتارًا");
    expect(e.evaluate("2 أكر").formatted).toBe("2 أكران");
    // A sum landing on a fraction: `other`, the genitive singular, and the
    // decimal point is "." because `arabic.numberFormat` pins the `latn`
    // numbering system rather than reading `Intl`'s default for the bare tag.
    expect(e.evaluate("1 هكتار + 0.5 هكتار").formatted).toBe("1.5 هكتار");
    // A conversion onto a unit with no forms: it renders through the symbol,
    // and `arabic.renderQuantity` sets a symbol off from the number with a
    // SPACE where `defaultRenderQuantity` would set it tight — Arabic symbols
    // are letters, and a digit run glued to letters is a boundary the bidi
    // algorithm has to guess. The result also groups, with the "," that `lex`
    // can read back.
    expect(e.evaluate("1 هكتار إلى م2").formatted).toBe("10,000 م²");
    // The superscript is folded by NFKC before `lex` sees it, so `م²` and `م2`
    // are the same input; both are listed and this is the path that proves it.
    expect(e.evaluate("3 م²").formatted).toBe("3 م²");
    // Both scripts read: an Arabic engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Arabic.
    expect(e.evaluate("2 ha").formatted).toBe("2 هكتاران");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 هكتار إلى م2",
      "11 هكتار",
      "1 هكتار + 0.5 هكتار",
      "2 أكر",
      "3 م²",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the output is logically ordered and carries no bidi controls", () => {
    // Point (c) of the Arabic brief, asserted rather than left to prose. A
    // string is a sequence in logical order, so the number comes first in memory
    // and the bidi algorithm is what puts it on the right at display time.
    // Nothing reverses anything, and nothing wraps the number in isolates
    // (U+2066-2069) or marks (U+200E/200F) — those are invisible characters the
    // lexer would have to read back, and `normalize()` strips only the
    // zero-width family. The symbol path is checked too, because `م²` is the
    // string most likely to tempt someone into "fixing" an order that is right.
    for (const input of ["11 هكتار", "3 م²"]) {
      const out = engine().evaluate(input).formatted;
      expect(out).toMatch(/^\d/);
      expect(out).not.toMatch(/[\u200E\u200F\u2066-\u2069]/u);
    }
  });
});
