import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthHi from "./hi";

const hi = () => composeLocale(hindi, [lengthHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [length] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "length",
    unit,
    slot,
  });
  return (lengthHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      hindi.selectForm({ kind: "length", unit: "m", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "length", unit: "m", slot }),
      ),
    ]),
  ),
].sort();

describe("length hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the eight nouns: the kind is ratios,
    // unit ids and magnitude bands, so any character from a script no ratio
    // could contain is the failure.
    expect(JSON.stringify(length)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("every unit carries exactly that key set", () => {
    for (const [unit, words] of Object.entries(lengthHi.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `hindi`'s suffix
  // stripper recovers it — at `weight: -2`. Hindi widens that trap, because the
  // stripper knows ों and would quietly cover an oblique plural the vocabulary
  // chose to print while leaving फीट, गज़ and the matra-level variants
  // unreachable.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(lengthHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("every string in the file survives NFKC unchanged", () => {
    // ड़ and ज़ are Unicode composition *exclusions*: NFKC decomposes U+095C and
    // U+095B into a consonant plus the nukta U+093C, and `normalize()` NFKC-folds
    // the input before a word ever reaches the alias index. गज़ and फ़ुट below are
    // written in the decomposed form for exactly that reason; a precomposed
    // spelling would test green against this object and be unreachable through
    // the engine, which is the one Hindi failure no other assertion here catches.
    for (const [unit, words] of Object.entries(lengthHi.units)) {
      const strings = [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ];
      for (const s of strings) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
    // Said positively as well, so the nukta is asserted to be *there* and not
    // merely to be stable: गज़ is ज + U+093C, three code points, not two.
    expect([...(lengthHi.units.yd?.symbol ?? "")].map((c) => c.codePointAt(0))).toEqual([
      0x917, 0x91c, 0x93c,
    ]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [length])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, so 0.5 and 1.5 land on opposite
    // rows and neither is reached by an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [length], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("फुट/फीट is a real plural, and it is where the boundary shows", () => {
    // Hindi borrowed both members of English's suppletive pair and uses them as
    // a genuine singular and plural. Seven of the eight units here print one
    // word on both rows, so this is the only unit on which `selectForm`'s answer
    // is observable at all.
    expect(word("ft", 1)).toBe("फुट");
    expect(word("ft", 5)).toBe("फीट");
    // Hindi's `one` is `i = 0 or n = 1`: zero is singular, where English's is
    // plural, and so is every fraction below one. 1.5 is the first count on the
    // other side. This is the row a table ported from `en` gets wrong.
    expect(word("ft", 0)).toBe("फुट");
    expect(word("ft", 0.5)).toBe("फुट");
    expect(word("ft", 1.5)).toBe("फीट");
  });

  test("the other seven print one word, because a measure noun does not count", () => {
    // Not a half-finished table: "पाँच मीटर" is five metres and "पाँच मीटरें" is
    // not Hindi. The numeral carries the count and the noun does not repeat it.
    for (const unit of Object.keys(lengthHi.units)) {
      if (unit === "ft") continue;
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("m", 5)).toBe("मीटर");
    expect(word("in", 5)).toBe("इंच");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("ft", count, "conversion-target")).toBe(
        word("ft", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other` — so a conversion
    // *into* feet names them in the plural, "फीट में".
    expect(word("ft", undefined)).toBe("फीट");
  });

  test("an engine built from it reads and writes Hindi length", () => {
    const e = engine();
    // Both registers: the spelled noun and the dotless Devanagari abbreviation,
    // which is what R8's symbol is here because से.मी. with its full stops would
    // end the word token at the first dot.
    expect(e.evaluate("5 सेमी").formatted).toBe("5 सेंटीमीटर");
    expect(e.evaluate("5 सेंटीमीटर").formatted).toBe("5 सेंटीमीटर");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // मीटर में कितने सेंटीमीटर".
    expect(e.evaluate("1 मीटर में सेंटीमीटर").formatted).toBe("100 सेंटीमीटर");
    expect(e.evaluate("1 मीटर को सेंटीमीटर").formatted).toBe("100 सेंटीमीटर");
    expect(e.evaluate("1 किमी से मीटर").formatted).toBe("1,000 मीटर");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and on this unit `other` is a different
    // word: "डेढ़ फीट".
    expect(e.evaluate("1 फुट जोड़ 6 इंच").formatted).toBe("1.5 फीट");
    // The same sum one inch shorter stays on the singular row, which is the
    // assertion that would read "1 फीट" if the two rows had been collapsed.
    expect(e.evaluate("0.5 फुट").formatted).toBe("0.5 फुट");
    expect(e.evaluate("0 फुट").formatted).toBe("0 फुट");
    // A cardinal read through `hindi.numerals`, and the oblique plural read by
    // its suffix stripper rather than listed in this file.
    expect(e.evaluate("पाँच मीटर").formatted).toBe("5 मीटर");
    expect(e.evaluate("दो मीटरों में सेंटीमीटर").formatted).toBe("200 सेंटीमीटर");
    // The imperial units in their Hindi spellings, including the Persian गज़
    // with its decomposed nukta.
    expect(e.evaluate("6 फीट को इंच").formatted).toBe("72 इंच");
    expect(e.evaluate("1 गज़ को इंच").formatted).toBe("36 इंच");
    expect(e.evaluate("1 गज को फुट").formatted).toBe("3 फीट");
    expect(e.evaluate("2 मील").formatted).toBe("2 मील");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("2 km").formatted).toBe("2 किलोमीटर");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("1 किमी को मिमी").formatted).toBe("1,000,000 मिलीमीटर");
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip, which is the property
    // everything else rests on: `parseNumber` removes every occurrence of the
    // group character wherever it falls and never counts digits between them, so
    // the reader is grouping-agnostic and accepts the Indian form the writer
    // cannot yet produce. The day core learns about grouping periods, the first
    // assertion above fails and this one is already its regression test.
    expect(engine().evaluate("10,00,000 मिलीमीटर").formatted).toBe("1,000,000 मिलीमीटर");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 फुट जोड़ 6 इंच",
      "1 मीटर में सेंटीमीटर",
      "1 किमी को मिमी",
      "1 गज़ को इंच",
      "6 फीट",
      "0.5 फुट",
      "2 मील",
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
