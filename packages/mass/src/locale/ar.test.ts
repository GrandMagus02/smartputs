import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massAr from "./ar";

const ar = () => composeLocale(arabic, [massAr]);
const engine = () => createEngine({ locales: [ar()], kinds: [mass] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = arabic.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massAr.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      arabic.selectForm({ kind: "mass", unit: "kg", slot }),
      ...[0, 1, 2, 3, 5, 10, 11, 21, 99, 100, 103, 111, 1000, 0.5, 1.5].map((n) =>
        arabic.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot }),
      ),
    ]),
  ),
].sort();

describe("mass ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Arabic word", () => {
    // The Arabic block, not a list of the six nouns: the kind is ratios, unit
    // ids and magnitude bands, so any character from a script no ratio could
    // contain is the failure. One sweep is enough where German needed two,
    // because an Arabic word cannot be spelled in the unit ids' own script.
    expect(JSON.stringify(mass)).not.toMatch(/[\u0600-\u06FF]/u);
  });

  test("selectForm produces exactly the six CLDR categories, on one axis", () => {
    // The contract this whole file keys off, asserted before anything indexes a
    // table with it. Six, where English has two — and *one axis*, unlike
    // Ukrainian's `${case}-${category}`: the case an Arabic preposition governs
    // is a short vowel Arabic does not write, so a slot axis would name the same
    // string in every row. `zero` and `two` are the two categories no other
    // language shipped here has at all.
    expect(KEYS).toEqual(["few", "many", "one", "other", "two", "zero"]);
  });

  test("every unit carries exactly that key set", () => {
    for (const [unit, words] of Object.entries(massAr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. Arabic makes that trap wider than
  // any other language here, because the stripper knows ات/ان/ين/ون/ًا and would
  // quietly cover four of the six rows on a sound-plural noun while leaving the
  // broken plurals (أطنان, أرطال) and the ة-duals (أونصتان) unreachable.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(massAr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(ar(), [mass])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and in most languages that means the fractional row is never
    // sampled at all. Arabic is the case where it *happens* to be covered — 100
    // and 1000 already land on `other`, which is where every fraction goes —
    // and running it anyway is what pins that fact: the day `selectForm` grows a
    // fractional branch of its own, this call fails and the one above does not.
    expect(() =>
      assertLocaleContract(ar(), [mass], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the six rows are six different decisions", () => {
    // The dual, which is the row no other language in this repo has: a suffix on
    // the noun, not a second word, and reached only by a count of exactly 2.
    expect(word("kg", 2)).toBe("كيلوغرامان");
    // The 3-10 plural, and the same row on a noun whose plural is *broken* —
    // أطنان re-arranges the stem of طن rather than suffixing it, so no ending
    // rule could have produced it.
    expect(word("kg", 5)).toBe("كيلوغرامات");
    expect(word("t", 5)).toBe("أطنان");
    // The tamyīz: 11-99 takes the accusative *singular*, ending in the tanwīn
    // and its alif. Reading this row as "the big plural" is the mistake, and it
    // would print "11 كيلوغرامات", which is a real Arabic word in the wrong cell.
    expect(word("kg", 11)).toBe("كيلوغرامًا");
    expect(word("kg", 99)).toBe("كيلوغرامًا");
    // The category follows n mod 100, not the leading digit: 103 is `few` and
    // 111 is `many`, so a hundred does not reset the noun to the singular.
    expect(word("kg", 103)).toBe("كيلوغرامات");
    expect(word("kg", 111)).toBe("كيلوغرامًا");
    // zero, one and other are one string in unvocalised writing — they differ
    // only in a final short vowel nobody writes — and repeating it is correct.
    expect(word("kg", 0)).toBe("كيلوغرام");
    expect(word("kg", 1)).toBe("كيلوغرام");
    expect(word("kg", 100)).toBe("كيلوغرام");
    // Every fraction lands on `other`, the genitive singular. A plural here
    // prints "1.5 كيلوغرامات", which no round-trip in this file would catch.
    expect(word("kg", 1.5)).toBe("كيلوغرام");
    expect(word("kg", 0.5)).toBe("كيلوغرام");
  });

  test("a tāʾ-marbūṭa noun inflects on two rows, not four", () => {
    // أونصة is feminine and ends in ة, and that changes the shape of the table
    // rather than the stem inside it. The dual *replaces* the ة (أونصتان), which
    // no suffix strip undoes — and the accusative takes no alif, because the
    // tanwīn on a ة is a bare mark ordinary prose leaves off. So the `many` row
    // is spelled exactly like the singular, and four of six rows coincide.
    expect(word("oz", 2)).toBe("أونصتان");
    expect(word("oz", 5)).toBe("أونصات");
    expect(word("oz", 11)).toBe("أونصة");
    expect(word("oz", 1)).toBe("أونصة");
    // The masculine comparison, on the same counts: here the accusative alif is
    // written, so `many` and `one` are visibly different strings.
    expect(word("lb", 11)).toBe("رطلًا");
    expect(word("lb", 1)).toBe("رطل");
  });

  test("the slot is inert: Arabic's axis is the count alone", () => {
    // Ukrainian's conversion target is locative and Arabic's is not anything at
    // all — the case a preposition governs is a short vowel Arabic does not
    // write. Asserted so that a later reader who adds a slot axis has to delete
    // a test that says why there isn't one.
    for (const count of [1, 2, 5, 11, undefined]) {
      expect(word("kg", count, "conversion-target")).toBe(word("kg", count, "bare"));
    }
    // And the count-free target (ruling R5) lands on `other` — the genitive
    // SINGULAR, "إلى كيلوغرام". This is the opposite of French, where a bare
    // conversion target is plural.
    expect(word("kg", undefined)).toBe("كيلوغرام");
  });

  test("an engine built from it reads and writes Arabic mass", () => {
    const e = engine();
    // The dual and the plural through the formatter, not just the table.
    expect(e.evaluate("2 كغ").formatted).toBe("2 كيلوغرامان");
    expect(e.evaluate("5 كغ").formatted).toBe("5 كيلوغرامات");
    expect(e.evaluate("11 كغ").formatted).toBe("11 كيلوغرامًا");
    expect(e.evaluate("0 كغ").formatted).toBe("0 كيلوغرام");
    // A sum landing on a fraction: `other`, the genitive singular, and the
    // decimal point is "." because `arabic.numberFormat` pins the `latn`
    // numbering system rather than reading `Intl`'s default for the bare tag.
    expect(e.evaluate("1 كغ + 500 غ").formatted).toBe("1.5 كيلوغرام");
    // A conversion, written with إلى. 16 is in the 11-99 band, and أونصة is the
    // ة-noun whose tamyīz is spelled like its singular.
    expect(e.evaluate("1 رطل إلى أونصة").formatted).toBe("16 أونصة");
    // A conversion whose result groups: "," is the group separator, and `lex`
    // reads it back — which is why this one may be round-tripped below where
    // Ukrainian's U+00A0-grouped output may not.
    expect(e.evaluate("2 كغ إلى غ").formatted).toBe("2,000 غرام");
    // The broken plural, printed.
    expect(e.evaluate("3 طن").formatted).toBe("3 أطنان");
    // Both scripts read: an Arabic engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Arabic.
    expect(e.evaluate("2 kg").formatted).toBe("2 كيلوغرامان");
    expect(e.evaluate("500 ملغ").formatted).toBe("500 مليغرام");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 كغ + 500 غ",
      "1 رطل إلى أونصة",
      "2 كغ إلى غ",
      "3 طن",
      "11 رطل",
      "500 ملغ",
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
    // Point (c), asserted at the vocabulary rather than left to prose. A string
    // is a sequence in logical order, so the number comes first in memory and
    // the bidi algorithm is what puts it on the right at display time. Nothing
    // here reverses anything, and nothing here wraps the number in isolates
    // (U+2066-2069) or marks (U+200E/200F) — those are invisible characters the
    // lexer would have to read back, and `normalize()` strips only the
    // zero-width family.
    const out = engine().evaluate("11 كغ").formatted;
    expect(out).toMatch(/^11 /);
    expect(out).not.toMatch(/[\u200E\u200F\u2066-\u2069]/u);
  });
});
