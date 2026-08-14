import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleAr from "./ar";

const ar = () => composeLocale(arabic, [angleAr]);
const engine = createEngine({ locales: [ar()], kinds: [angle] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = arabic.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleAr.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      arabic.selectForm({ kind: "angle", unit: "deg", slot }),
      ...[0, 1, 2, 3, 5, 10, 11, 21, 99, 100, 103, 111, 1000, 0.5, 1.5].map((n) =>
        arabic.selectForm({ count: new Decimal(n), kind: "angle", unit: "deg", slot }),
      ),
    ]),
  ),
].sort();

describe("angle ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("every alias is unique within the kind, so no reading is ambiguous", () => {
    const seen = new Map<string, string>();
    for (const [unit, words] of Object.entries(angleAr.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by both ${seen.get(alias)} and ${unit}`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("the kind itself carries no Arabic word", () => {
    // The Arabic block, not a list of the four nouns: the kind is ratios, unit
    // ids and magnitude bands, so any character from a script no ratio could
    // contain is the failure. Written as escapes because the block opens with
    // format characters that would be invisible in source.
    expect(JSON.stringify(angle)).not.toMatch(/[\u0600-\u06FF]/u);
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
    for (const [unit, words] of Object.entries(angleAr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. Arabic makes that trap wider than
  // any other language here, because the stripper knows ات/ان/ين/ون/ًا and so
  // covers four rows of a sound-plural noun by guesswork while leaving the
  // ة-duals (درجتان, دورتان) unreachable — those replace a letter rather than
  // append one, and no strip undoes a replacement.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(angleAr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(ar(), [angle])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and in most languages that means the fractional row is never
    // sampled at all. Arabic is the case where it *happens* to be covered — 100
    // and 1000 already land on `other`, which is where every fraction goes — and
    // running it anyway is what pins that fact: the day `selectForm` grows a
    // fractional branch of its own, this call fails and the one above does not.
    expect(() =>
      assertLocaleContract(ar(), [angle], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the six rows are six different decisions", () => {
    // The dual, the row no other language in this repo has: a suffix on the
    // noun, not a second word, and reached only by a count of exactly 2.
    expect(word("rad", 2)).toBe("راديانان");
    expect(word("rad", 5)).toBe("راديانات");
    // The tamyīz: 11-99 takes the accusative *singular*, ending in the tanwīn
    // and its alif. Reading this row as "the big plural" prints "11 راديانات",
    // which is a real Arabic word in the wrong cell.
    expect(word("rad", 11)).toBe("راديانًا");
    expect(word("rad", 99)).toBe("راديانًا");
    // The category follows n mod 100, not the leading digit: 103 is `few` and
    // 111 is `many`, so a hundred does not reset the noun to the singular.
    expect(word("rad", 103)).toBe("راديانات");
    expect(word("rad", 111)).toBe("راديانًا");
    // zero, one and other are one string in unvocalised writing — they differ
    // only in a final short vowel nobody writes — and repeating it is correct.
    expect(word("rad", 0)).toBe("راديان");
    expect(word("rad", 1)).toBe("راديان");
    expect(word("rad", 100)).toBe("راديان");
    // Every fraction lands on `other`, the genitive singular. A plural here
    // prints "1.5 راديانات", which no round-trip in this file would catch.
    expect(word("rad", 1.5)).toBe("راديان");
  });

  test("the two tāʾ-marbūṭa nouns inflect on two rows, not four", () => {
    // درجة and دورة are feminine and end in ة, and that changes the shape of the
    // table rather than the stem inside it. The dual *replaces* the ة (درجتان,
    // دورتان), which no suffix strip undoes — and the accusative takes no alif,
    // because the tanwīn on a ة is a bare mark ordinary prose leaves off. So
    // `many` is spelled exactly like the singular and four of six rows coincide,
    // where راديان and غراد above have six distinct-looking rows in four spellings.
    for (const unit of ["deg", "turn"] as const) {
      expect(word(unit, 11), unit).toBe(word(unit, 1));
      expect(word(unit, 0), unit).toBe(word(unit, 1));
      expect(word(unit, 1.5), unit).toBe(word(unit, 1));
    }
    expect(word("deg", 2)).toBe("درجتان");
    expect(word("deg", 5)).toBe("درجات");
    expect(word("turn", 2)).toBe("دورتان");
    expect(word("turn", 5)).toBe("دورات");
    // The masculine comparison on the same counts: غراد writes the accusative
    // alif, so its `many` row is a visibly different string.
    expect(word("grad", 11)).toBe("غرادًا");
    expect(word("grad", 1)).toBe("غراد");
  });

  test("the slot is inert: Arabic's axis is the count alone", () => {
    // Ukrainian's conversion target is locative and Arabic's is not anything at
    // all — the case a preposition governs is a short vowel Arabic does not
    // write. Asserted so that a later reader who adds a slot axis has to delete
    // a test that says why there isn't one.
    for (const unit of ["rad", "deg", "grad", "turn"] as const) {
      for (const count of [1, 2, 5, 11, undefined]) {
        expect(word(unit, count, "conversion-target"), unit).toBe(
          word(unit, count, "bare"),
        );
      }
      // And the count-free target (ruling R5) lands on `other` — the genitive
      // SINGULAR. The opposite of French, where a bare target is plural.
      expect(arabic.selectForm({ kind: "angle", unit, slot: "conversion-target" })).toBe(
        "other",
      );
    }
  });

  test("an engine built from it reads and writes Arabic angles", () => {
    expect(engine.evaluate("2 راديان").formatted).toBe("2 راديانان");
    expect(engine.evaluate("5 درجة").formatted).toBe("5 درجات");
    expect(engine.evaluate("3 غراد").formatted).toBe("3 غرادات");
    // A conversion. 360 mod 100 is 60, so the result is the `many` row — which
    // on a ة noun is spelled like the singular, so "360 درجة" is right and
    // "360 درجات" would be the wrong cell holding a real word.
    expect(engine.evaluate("1 دورة إلى درجة").formatted).toBe("360 درجة");
    // A sum landing on a fraction: `other`, the genitive singular, and the
    // decimal point is "." because `arabic.numberFormat` pins the `latn`
    // numbering system rather than reading `Intl`'s default for the bare tag.
    expect(engine.evaluate("1 درجة + 0.5 درجة").formatted).toBe("1.5 درجة");
    expect(engine.evaluate("0.5 دورة").formatted).toBe("0.5 دورة");
    // Both scripts read: an Arabic engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Arabic.
    expect(engine.evaluate("2 deg").formatted).toBe("2 درجتان");
  });

  test("what it prints, it reads back", () => {
    // "1 درجة + 0.5 درجة" is deliberately absent: a degree is pi/180 radians, so
    // its canonical is non-terminating and re-parsing the 26 significant digits
    // the formatter prints cannot recover the guard digits. That is what
    // `DISPLAY_PRECISION`'s two spare digits are for and it is asserted as a
    // string above instead — the round trip here is over the values whose
    // canonical is exact.
    for (const input of [
      "5 درجة",
      "1 دورة إلى درجة",
      "0.5 دورة",
      "3 غراد",
      "11 راديان",
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
    const out = engine.evaluate("11 راديان").formatted;
    expect(out).toMatch(/^11 /);
    expect(out).not.toMatch(/[\u200E\u200F\u2066-\u2069]/u);
  });
});
