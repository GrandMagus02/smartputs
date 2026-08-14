import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureAr from "./ar";

const ar = () => composeLocale(arabic, [measureAr]);
const engine = createEngine({ locales: [ar()], kinds: [measure] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = arabic.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureAr.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      arabic.selectForm({ kind: "measure", unit: "px", slot }),
      ...[0, 1, 2, 3, 5, 10, 11, 21, 96, 99, 100, 103, 111, 1000, 0.5, 1.5].map((n) =>
        arabic.selectForm({ count: new Decimal(n), kind: "measure", unit: "px", slot }),
      ),
    ]),
  ),
].sort();

describe("measure ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Arabic word", () => {
    // The Arabic block, not a list of the six nouns: the kind is ratios, unit
    // ids, magnitude bands and the one dynamic `px` closure, so any character
    // from a script no ratio could contain is the failure. Written as escapes
    // because the block opens with format characters invisible in source.
    expect(JSON.stringify(measure)).not.toMatch(/[\u0600-\u06FF]/u);
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

  test("every unit carries exactly that key set", () => {
    for (const [unit, words] of Object.entries(measureAr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. Arabic makes that trap wider than
  // any other language here, because the stripper knows ات/ان/ين/ون/ًا and so
  // covers four rows of a sound-plural noun by guesswork while leaving the
  // broken plural نقاط and the ة-duals (بوصتان, نقطتان) unreachable.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(measureAr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(ar(), [measure])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and in most languages that means the fractional row is never
    // sampled at all. Arabic is the case where it *happens* to be covered — 100
    // and 1000 already land on `other`, which is where every fraction goes — and
    // running it anyway is what pins that fact: the day `selectForm` grows a
    // fractional branch of its own, this call fails and the one above does not.
    expect(() =>
      assertLocaleContract(ar(), [measure], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the six rows are six different decisions", () => {
    // The dual, the row no other language in this repo has: a suffix on the
    // noun, not a second word, and reached only by a count of exactly 2.
    expect(word("px", 2)).toBe("بكسلان");
    expect(word("px", 5)).toBe("بكسلات");
    // The tamyīz: 11-99 takes the accusative *singular*, ending in the tanwīn
    // and its alif — and 96, this kind's default dpi, sits squarely in that
    // band, so it is the row an inch-to-pixel conversion actually prints.
    expect(word("px", 11)).toBe("بكسلًا");
    expect(word("px", 96)).toBe("بكسلًا");
    // The category follows n mod 100, not the leading digit: 103 is `few` and
    // 111 is `many`, so a hundred does not reset the noun to the singular.
    expect(word("px", 103)).toBe("بكسلات");
    expect(word("px", 111)).toBe("بكسلًا");
    // zero, one and other are one string in unvocalised writing — they differ
    // only in a final short vowel nobody writes — and repeating it is correct.
    expect(word("px", 0)).toBe("بكسل");
    expect(word("px", 1)).toBe("بكسل");
    expect(word("px", 100)).toBe("بكسل");
    // Every fraction lands on `other`, the genitive singular. A plural here
    // prints "1.5 بكسلات", which no round-trip in this file would catch.
    expect(word("px", 1.5)).toBe("بكسل");
  });

  test("the three paradigms are three different decisions", () => {
    // Consonant-final loanword with a sound plural: six rows in four spellings.
    expect(word("mm", 2)).toBe("مليمتران");
    expect(word("mm", 5)).toBe("مليمترات");
    expect(word("mm", 11)).toBe("مليمترًا");
    // tāʾ marbūṭa, and a BROKEN plural on top of it: the dual replaces the ة
    // (نقطتان) and the 3-10 row re-arranges the stem (نقاط) instead of suffixing
    // it, while the accusative writes no alif — so `many` is spelled like the
    // singular and four of six rows coincide.
    expect(word("pt", 2)).toBe("نقطتان");
    expect(word("pt", 5)).toBe("نقاط");
    expect(word("pt", 11)).toBe("نقطة");
    expect(word("pt", 1)).toBe("نقطة");
    // The invariable one, and the only table here whose six rows are one string
    // for a reason other than "the difference is an unwritten vowel": بيكا ends
    // in a bare alif, and the derivable dual بيكاوان is a form no Arabic
    // designer writes. Repeating the singular is a decision; inventing بيكاوان
    // would be writing a word rather than translating one.
    for (const count of [0, 1, 2, 5, 11, 100, 1.5]) {
      expect(word("pc", count), `pc at ${count}`).toBe("بيكا");
    }
    // …and the plurals it declines to print are still read, which is the
    // ordinary asymmetry: recognition is many-to-one, only generation must pick.
    expect(measureAr.units.pc?.aliases).toContain("بيكات");
  });

  test("the slot is inert: Arabic's axis is the count alone", () => {
    // Ukrainian's conversion target is locative and Arabic's is not anything at
    // all — the case a preposition governs is a short vowel Arabic does not
    // write. Asserted so that a later reader who adds a slot axis has to delete
    // a test that says why there isn't one.
    for (const count of [1, 2, 5, 11, undefined]) {
      expect(word("pt", count, "conversion-target")).toBe(word("pt", count, "bare"));
    }
    // And the count-free target (ruling R5) lands on `other` — the genitive
    // SINGULAR, "إلى نقطة". The opposite of French, where a bare target is
    // plural.
    expect(word("pt", undefined)).toBe("نقطة");
  });

  test("an engine built from it reads and writes Arabic typography", () => {
    expect(engine.evaluate("2 بوصة").formatted).toBe("2 بوصتان");
    expect(engine.evaluate("5 نقطة").formatted).toBe("5 نقاط");
    // The conversion this kind exists for, and the row that makes Arabic's
    // sixth category worth having: 72 and 96 are both in the 11-99 band, so an
    // inch prints as a tamyīz in both target units — "72 نقطة" (ة noun, no
    // alif) and "96 بكسلًا" (consonant-final, alif written).
    expect(engine.evaluate("1 بوصة إلى نقطة").formatted).toBe("72 نقطة");
    expect(engine.evaluate("1 بوصة إلى بكسل").formatted).toBe("96 بكسلًا");
    // The Latin aliases still read: a designer types `pt` and `pc` whatever the
    // keyboard is, and the symbols stay Latin for the same reason.
    expect(engine.evaluate("6 pc إلى بوصة").formatted).toBe("1 بوصة");
    expect(engine.evaluate("2 بيكا").formatted).toBe("2 بيكا");
    // A subtraction landing on a fraction: `other`, the genitive singular, and
    // the decimal point is "." because `arabic.numberFormat` pins the `latn`
    // numbering system rather than reading `Intl`'s default for the bare tag.
    expect(engine.evaluate("1 بوصة - 12 نقطة").formatted).toBe(
      "0.83333333333333333333333333 بوصة",
    );
  });

  test("what it prints, it reads back", () => {
    // "1 بوصة - 12 نقطة" is deliberately absent: 5/6 of an inch is
    // non-terminating, so re-parsing the 26 significant digits the formatter
    // prints cannot recover `DISPLAY_PRECISION`'s two guard digits. It is
    // asserted as a string above instead; the round trip here is over the
    // values whose canonical is exact.
    for (const input of [
      "1 بوصة إلى نقطة",
      "1 بوصة إلى بكسل",
      "6 pc إلى بوصة",
      "2 بوصة",
      "5 نقطة",
      "2 بيكا",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
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
    // zero-width family.
    const out = engine.evaluate("1 بوصة إلى بكسل").formatted;
    expect(out).toMatch(/^96 /);
    expect(out).not.toMatch(/[\u200E\u200F\u2066-\u2069]/u);
  });
});
