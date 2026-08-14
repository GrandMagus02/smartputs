import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthAr from "./ar";

const ar = () => composeLocale(arabic, [lengthAr]);
const engine = createEngine({ locales: [ar()], kinds: [length] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = arabic.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "length",
    unit,
    slot,
  });
  return (lengthAr.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      arabic.selectForm({ kind: "length", unit: "m", slot }),
      ...[0, 1, 2, 3, 5, 10, 11, 21, 99, 100, 103, 111, 1000, 0.5, 1.5].map((n) =>
        arabic.selectForm({ count: new Decimal(n), kind: "length", unit: "m", slot }),
      ),
    ]),
  ),
].sort();

describe("length ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Arabic word", () => {
    // The Arabic block, not a list of the eight nouns: the kind is ratios, unit
    // ids and magnitude bands, so any character from a script no ratio could
    // contain is the failure. Written as escapes because the block opens with
    // format characters that would be invisible in source.
    expect(JSON.stringify(length)).not.toMatch(/[\u0600-\u06FF]/u);
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
    // Unconditional, unlike `area` next door: no length unit is symbol-only, so
    // all eight tables are full ones.
    for (const [unit, words] of Object.entries(lengthAr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // `in` is not an Arabic keyword — `arabic.keywords.in` is إلى/الى/في — so
  // nothing in this language's own lexer would shadow the alias. It is left out
  // because `registry.aliasIndex` is one flat map that `isUnitAlias` reads
  // without a locale, so an Arabic entry for `in` would put it back in front of
  // `@smartput/datetime`'s accept-gate for any engine speaking both languages.
  // See the vocabulary's own comment.
  test("`in` is left to the conversion keyword here too", () => {
    for (const words of Object.values(lengthAr.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthAr.units.in?.aliases).toContain("بوصة");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. Arabic makes that trap wider than
  // any other language here, because the stripper knows ات/ان/ين/ون/ًا and so
  // covers four rows of a sound-plural noun by guesswork while leaving the
  // broken plurals (أمتار, أقدام, أميال) and the ة-dual (بوصتان) unreachable.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(lengthAr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(ar(), [length])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and in most languages that means the fractional row is never
    // sampled at all. Arabic is the case where it *happens* to be covered — 100
    // and 1000 already land on `other`, which is where every fraction goes — and
    // running it anyway is what pins that fact: the day `selectForm` grows a
    // fractional branch of its own, this call fails and the one above does not.
    expect(() =>
      assertLocaleContract(ar(), [length], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the six rows are six different decisions", () => {
    // The dual, the row no other language in this repo has: a suffix on the
    // noun, not a second word, and reached only by a count of exactly 2.
    expect(word("m", 2)).toBe("متران");
    // The 3-10 plural — and on متر it is BROKEN, أمتار, the stem re-arranged
    // rather than suffixed. No ending rule produces it, which is why it has to
    // be a listed alias as well.
    expect(word("m", 5)).toBe("أمتار");
    expect(word("ft", 5)).toBe("أقدام");
    expect(word("mi", 5)).toBe("أميال");
    // …while the long metric compounds keep the sound plural, so the five metric
    // units here are not one table with the stem swapped.
    expect(word("km", 5)).toBe("كيلومترات");
    // The tamyīz: 11-99 takes the accusative *singular*, ending in the tanwīn
    // and its alif. Reading this row as "the big plural" prints "11 أمتار",
    // which is a real Arabic word in the wrong cell.
    expect(word("m", 11)).toBe("مترًا");
    expect(word("m", 99)).toBe("مترًا");
    // The category follows n mod 100, not the leading digit: 103 is `few` and
    // 111 is `many`, so a hundred does not reset the noun to the singular.
    expect(word("m", 103)).toBe("أمتار");
    expect(word("m", 111)).toBe("مترًا");
    // zero, one and other are one string in unvocalised writing — they differ
    // only in a final short vowel nobody writes — and repeating it is correct.
    expect(word("m", 0)).toBe("متر");
    expect(word("m", 1)).toBe("متر");
    expect(word("m", 100)).toBe("متر");
    // Every fraction lands on `other`, the genitive singular. A plural here
    // prints "1.5 أمتار", which no round-trip in this file would catch.
    expect(word("m", 1.5)).toBe("متر");
  });

  test("a tāʾ-marbūṭa noun inflects on two rows, not four", () => {
    // بوصة is feminine and ends in ة, and that changes the shape of the table
    // rather than the stem inside it. The dual *replaces* the ة (بوصتان), which
    // no suffix strip undoes — and the accusative takes no alif, because the
    // tanwīn on a ة is a bare mark ordinary prose leaves off. So `many` is
    // spelled exactly like the singular and four of six rows coincide.
    expect(word("in", 2)).toBe("بوصتان");
    expect(word("in", 5)).toBe("بوصات");
    expect(word("in", 11)).toBe("بوصة");
    expect(word("in", 1)).toBe("بوصة");
    // قدم is *also* grammatically feminine, and none of that shows: it does not
    // end in ة, so it suffixes its dual and writes its accusative alif exactly
    // as a masculine noun does. Gender is not what decides this table's shape —
    // the final letter is.
    expect(word("ft", 2)).toBe("قدمان");
    expect(word("ft", 11)).toBe("قدمًا");
  });

  test("the slot is inert: Arabic's axis is the count alone", () => {
    // Ukrainian's conversion target is locative and Arabic's is not anything at
    // all — the case a preposition governs is a short vowel Arabic does not
    // write. Asserted so that a later reader who adds a slot axis has to delete
    // a test that says why there isn't one.
    for (const count of [1, 2, 5, 11, undefined]) {
      expect(word("m", count, "conversion-target")).toBe(word("m", count, "bare"));
    }
    // And the count-free target (ruling R5) lands on `other` — the genitive
    // SINGULAR, "إلى متر". The opposite of French, where a bare target is plural.
    expect(word("m", undefined)).toBe("متر");
  });

  test("an engine built from it reads and writes Arabic length", () => {
    // The dual and the broken plural through the formatter, not just the table.
    expect(engine.evaluate("2 م").formatted).toBe("2 متران");
    expect(engine.evaluate("5 م").formatted).toBe("5 أمتار");
    expect(engine.evaluate("11 م").formatted).toBe("11 مترًا");
    // A sum landing on a fraction: `other`, the genitive singular, and the
    // decimal point is "." because `arabic.numberFormat` pins the `latn`
    // numbering system rather than reading `Intl`'s default for the bare tag.
    expect(engine.evaluate("1 كم + 500 م").formatted).toBe("1.5 كيلومتر");
    // A conversion, written with إلى and read through a broken plural. 36 is in
    // the 11-99 band, and بوصة is the ة noun whose tamyīz looks like its
    // singular — so this line is one row of two different tables at once.
    expect(engine.evaluate("3 أقدام إلى بوصة").formatted).toBe("36 بوصة");
    // A conversion whose result groups: "," is the group separator, and `lex`
    // reads it back — which is why this one is round-tripped below where
    // Ukrainian's U+00A0-grouped output cannot be.
    expect(engine.evaluate("1 ميل إلى قدم").formatted).toBe("5,280 قدمًا");
    // Both scripts read: an Arabic engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Arabic.
    expect(engine.evaluate("2 km").formatted).toBe("2 كيلومتران");
    expect(engine.evaluate("100 سم").formatted).toBe("100 سنتيمتر");
  });

  test("what it prints, it reads back", () => {
    for (const input of [
      "1 كم + 500 م",
      "3 أقدام إلى بوصة",
      "1 ميل إلى قدم",
      "11 م",
      "5 أميال",
      "2 بوصة",
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
    const out = engine.evaluate("11 م").formatted;
    expect(out).toMatch(/^11 /);
    expect(out).not.toMatch(/[\u200E\u200F\u2066-\u2069]/u);
  });
});
