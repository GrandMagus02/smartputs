import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleHi from "./hi";

const hi = () => composeLocale(hindi, [angleHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [angle] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts the
 * tables agree with the list. Sweeping the counts that move a plural rule in any
 * language in this repo against all three slots is what shows the answer is two
 * keys on one axis.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "angle", unit: "deg", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "angle", unit: "deg", slot }),
      ),
    ]),
  ),
].sort();

describe("angle hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the four nouns: the kind is ratios,
    // unit ids and magnitude bands, so any character from a script no ratio
    // could contain is the failure.
    expect(JSON.stringify(angle)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("every unit carries exactly that key set", () => {
    for (const [unit, words] of Object.entries(angleHi.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `hindi`'s suffix
  // stripper recovers it — at `weight: -2`. फेरे is exactly that trap: the
  // stripper's े rule takes it to the non-word फेर, so the containment below is
  // what proves the printed plural is reached by an exact hit and not a guess.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(angleHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("every string in the file survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and Devanagari has two traps in it: ड़ and ज़ are Unicode composition
    // *exclusions*, so NFKC decomposes U+095C/U+095B into a consonant plus the
    // nukta U+093C. A table written with the precomposed characters tests green
    // against this object and is unreachable through the engine. Angle has no
    // nukta today; the assertion is here so the day one arrives (a गॉन spelled
    // with one, say) it is caught in this package rather than in core's.
    for (const [unit, words] of Object.entries(angleHi.units)) {
      const strings = [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ];
      for (const s of strings) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [angle])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, so 0.5 and 1.5 land on opposite
    // rows and neither is reached by an integer sweep at all. A half turn is
    // also the commonest angle anyone writes, so the row is not a corner case.
    expect(() =>
      assertLocaleContract(hi(), [angle], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("फेरा/फेरे is a real plural, and it is where the boundary shows", () => {
    // The one native Hindi noun in the kind, and the only inflecting row: a
    // masculine ा-final noun takes -े in the direct plural whatever else is
    // going on, so एक फेरा and दो फेरे.
    expect(word("turn", 1)).toBe("फेरा");
    expect(word("turn", 2)).toBe("फेरे");
    // Hindi's `one` is `i = 0 or n = 1`: zero is singular, where English's is
    // plural, and so is every fraction below one. 1.5 is the first count on the
    // other side. This is the row a table ported from `en` gets wrong.
    expect(word("turn", 0)).toBe("फेरा");
    expect(word("turn", 0.5)).toBe("फेरा");
    expect(word("turn", 1.5)).toBe("फेरे");
  });

  test("the three borrowings print one word, because a measure noun does not count", () => {
    // Not a half-finished table: "नब्बे डिग्री" is ninety degrees. डिग्रियाँ is
    // the regular plural of a feminine ी-final noun and is good Hindi in a
    // sentence about qualifications, and nobody writes it after a numeral — so
    // it is an alias here and never a form.
    for (const unit of ["rad", "deg", "grad"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("deg", 90)).toBe("डिग्री");
    expect(angleHi.units.deg?.aliases).toContain("डिग्रियाँ");
    expect(Object.values(angleHi.units.deg?.forms ?? {})).not.toContain("डिग्रियाँ");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("turn", count, "conversion-target")).toBe(
        word("turn", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("turn", undefined)).toBe("फेरे");
  });

  test("an engine built from it reads and writes Hindi angle", () => {
    const e = engine();
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // फेरे में कितनी डिग्री".
    expect(e.evaluate("1 फेरा में डिग्री").formatted).toBe("360 डिग्री");
    expect(e.evaluate("1 फेरा को ग्रेडियन").formatted).toBe("400 ग्रेडियन");
    expect(e.evaluate("90 डिग्री से ग्रेडियन").formatted).toBe("100 ग्रेडियन");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and on this unit `other` is a different
    // word.
    expect(e.evaluate("1 फेरा जोड़ 180 डिग्री").formatted).toBe("1.5 फेरे");
    // The other side of the boundary, on the same unit: a half turn stays
    // singular in Hindi where English would print "0.5 turns".
    expect(e.evaluate("1 फेरा भाग 2").formatted).toBe("0.5 फेरा");
    expect(e.evaluate("0 फेरा").formatted).toBe("0 फेरा");
    // The oblique plural, which this file lists rather than leaving to the
    // stripper: an ा-final noun replaces its final vowel to go oblique, and a
    // stripper that only removes cannot undo that.
    expect(e.evaluate("दो फेरों में डिग्री").formatted).toBe("720 डिग्री");
    // चक्कर is the everyday synonym, read and never printed.
    expect(e.evaluate("2 चक्कर").formatted).toBe("2 फेरे");
    // अंश is the Sanskritic term a geometry textbook uses; गॉन is the gon under
    // its own name. Both read back as the printed spelling.
    expect(e.evaluate("90 अंश").formatted).toBe("90 डिग्री");
    expect(e.evaluate("100 गॉन").formatted).toBe("100 ग्रेडियन");
    // A cardinal read through `hindi.numerals`.
    expect(e.evaluate("पाँच डिग्री").formatted).toBe("5 डिग्री");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("90 deg").formatted).toBe("90 डिग्री");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("10000 फेरे में डिग्री").formatted).toBe("3,600,000 डिग्री");
    expect(new Intl.NumberFormat("hi").format(3_600_000)).toBe("36,00,000");
    // What the gap does *not* break is the round trip: `parseNumber` removes
    // every occurrence of the group character wherever it falls and never counts
    // digits between them, so the reader is grouping-agnostic and accepts the
    // Indian form the writer cannot yet produce. The day core learns about
    // grouping periods, the first assertion above fails and this one is already
    // its regression test.
    expect(engine().evaluate("36,00,000 डिग्री").formatted).toBe("3,600,000 डिग्री");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 फेरा जोड़ 180 डिग्री",
      "1 फेरा में डिग्री",
      "90 डिग्री से ग्रेडियन",
      "दो फेरों में डिग्री",
      "0.5 फेरा",
      "2 चक्कर",
      "1 रेडियन",
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
