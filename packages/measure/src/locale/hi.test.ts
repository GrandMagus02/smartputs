import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureHi from "./hi";

const hi = () => composeLocale(hindi, [measureHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [measure] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      hindi.selectForm({ kind: "measure", unit: "pt", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "measure", unit: "pt", slot }),
      ),
    ]),
  ),
].sort();

describe("measure hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the six nouns: the kind is ratios,
    // unit ids, the one dynamic `px` closure and magnitude bands, so any
    // character from a script no ratio could contain is the failure.
    expect(JSON.stringify(measure)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("every unit carries exactly that key set", () => {
    for (const [unit, words] of Object.entries(measureHi.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `hindi`'s suffix
  // stripper recovers it — at `weight: -2`. The stripper knows ों and would
  // quietly cover a printed पिक्सेलों while leaving the transliteration variants
  // (प्वाइंट, पिक्सल) unreachable, so the containment below is what proves each
  // printed word is reached by an exact hit and not a guess.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(measureHi.units)) {
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
    // against this object and is unreachable through the engine. Measure has no
    // nukta today; the assertion is here so the day one arrives it is caught in
    // this package rather than in core's.
    for (const [unit, words] of Object.entries(measureHi.units)) {
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
    expect(() => assertLocaleContract(hi(), [measure])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, so 0.5 and 1.5 land on opposite
    // rows and neither is reached by an integer sweep at all. Half a point is an
    // ordinary type size, so the row is not a corner case.
    expect(() =>
      assertLocaleContract(hi(), [measure], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("both rows hold one word, पाइका included", () => {
    // Not a half-finished table: "बारह पॉइंट" is twelve points and "बारह
    // पॉइंटें" is not Hindi. पाइका is the row worth arguing about — it ends in
    // the same ा as `@smartput/angle`'s फेरा, which *does* print फेरे — and it
    // stays one word because ा-final loanwords are the unmarked class. The rule
    // is about how thoroughly a word has been absorbed, not about how it ends.
    for (const unit of Object.keys(measureHi.units)) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("pc", 1)).toBe("पाइका");
    expect(word("pc", 5)).toBe("पाइका");
    expect(word("px", 96)).toBe("पिक्सेल");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("pt", count, "conversion-target")).toBe(
        word("pt", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("pt", undefined)).toBe("पॉइंट");
  });

  test("an engine built from it reads and writes Hindi typographic measures", () => {
    const e = engine();
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक इंच
    // में कितने पॉइंट".
    expect(e.evaluate("1 इंच में पॉइंट").formatted).toBe("72 पॉइंट");
    expect(e.evaluate("1 इंच को पिक्सेल").formatted).toBe("96 पिक्सेल");
    expect(e.evaluate("1 इंच से सेमी").formatted).toBe("2.54 सेंटीमीटर");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and on a Hindi measure noun `other` is
    // the same word `one` is — which is the point, not an omission.
    expect(e.evaluate("1 पाइका जोड़ 6 पॉइंट").formatted).toBe("1.5 पाइका");
    // Half an inch: Hindi's singular row, where English would print a plural.
    expect(e.evaluate("0.5 इंच").formatted).toBe("0.5 इंच");
    // The oblique plural, read by `hindi`'s stripper rather than listed here.
    expect(e.evaluate("96 पिक्सलों में इंच").formatted).toBe("1 इंच");
    // बिंदु and प्वाइंट are read and never printed: both come back as the one
    // spelling this vocabulary generates.
    expect(e.evaluate("12 बिंदु").formatted).toBe("12 पॉइंट");
    expect(e.evaluate("12 प्वाइंट").formatted).toBe("12 पॉइंट");
    // A cardinal read through `hindi.numerals`.
    expect(e.evaluate("पाँच इंच").formatted).toBe("5 इंच");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares — pt, pc and px are the short forms Hindi
    // typesetting actually uses — and prints them back in Devanagari.
    expect(e.evaluate("12 pt").formatted).toBe("12 पॉइंट");
    expect(e.evaluate("1 pc").formatted).toBe("1 पाइका");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore — the first group from
    // the right is three digits and every group after it is two — while
    // `formatNumber` inserts the separator with a fixed period of three, because
    // `NumberFormatSpec` carries a separator character and no grouping *rule*.
    expect(engine().evaluate("100000 इंच को पिक्सेल").formatted).toBe("9,600,000 पिक्सेल");
    expect(new Intl.NumberFormat("hi").format(9_600_000)).toBe("96,00,000");
    // What the gap does *not* break is the round trip: `parseNumber` removes
    // every occurrence of the group character wherever it falls and never counts
    // digits between them, so the reader is grouping-agnostic and accepts the
    // Indian form the writer cannot yet produce. The day core learns about
    // grouping periods, the first assertion above fails and this one is already
    // its regression test.
    expect(engine().evaluate("96,00,000 पिक्सेल").formatted).toBe("9,600,000 पिक्सेल");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 पाइका जोड़ 6 पॉइंट",
      "1 इंच में पॉइंट",
      "1 इंच को पिक्सेल",
      "1 इंच से सेमी",
      "0.5 इंच",
      "12 बिंदु",
      "100000 इंच को पिक्सेल",
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
