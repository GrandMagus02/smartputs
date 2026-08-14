import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massHi from "./hi";

const hi = () => composeLocale(hindi, [massHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [mass] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts that
 * the tables agree with the list. Sweeping the counts that move a plural rule in
 * any language in this repo against all three slots is what shows the answer is
 * two keys on one axis, which is what makes the Hindi tables below two rows.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "mass", unit: "kg", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot }),
      ),
    ]),
  ),
].sort();

describe("mass hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the six nouns: the kind is ratios,
    // unit ids and magnitude bands, so any character from a script no ratio
    // could contain is the failure.
    expect(JSON.stringify(mass)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    // The contract this whole file keys off, asserted before anything indexes a
    // table with it. Two, where Arabic has six and Ukrainian has eight on two
    // axes — `@smartput/core/locale/hi` rejected an oblique-case axis on purpose,
    // because the direct and oblique singular of a consonant-final masculine
    // loanword are the same word.
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("every unit carries exactly that key set", () => {
    for (const [unit, words] of Object.entries(massHi.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `hindi`'s suffix
  // stripper recovers it — at `weight: -2`. Hindi widens that trap in a way no
  // other language here does, because the stripper knows ों and would quietly
  // cover an oblique plural the vocabulary chose to print while leaving the
  // matra-level variants (मिलिग्राम, पौंड) unreachable.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(massHi.units)) {
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
    // against direct calls on `massHi.units` and is unreachable through the
    // engine. Mass has no nukta in it today; the assertion is here so that the
    // day one arrives it is caught in this package rather than in core's.
    for (const [unit, words] of Object.entries(massHi.units)) {
      for (const s of [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ]) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [mass])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction
    // below 1 as well, so 0.5 and 1.5 land on opposite rows and neither is
    // reached by an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [mass], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("the plural boundary is not English's", () => {
    // Hindi's `one` is `i = 0 or n = 1`. Zero is singular here and plural in
    // English, and every fraction below one is singular too. This is the row a
    // table ported from `en` by translating two strings in place gets wrong.
    expect(
      hindi.selectForm({ count: new Decimal(0), kind: "mass", unit: "kg", slot: "bare" }),
    ).toBe("one");
    expect(
      hindi.selectForm({
        count: new Decimal(0.5),
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("one");
    expect(
      hindi.selectForm({
        count: new Decimal(1.5),
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("other");
  });

  test("both rows hold one word, because a Hindi measure noun does not count", () => {
    // Not a half-finished table. A unit noun after a numeral stays in the direct
    // singular — "पाँच किलोग्राम", never "पाँच किलोग्रामें" — so the two rows
    // agree on every unit here, including औंस, which is feminine and would take
    // ें if the measure-noun rule did not outrank the gender rule.
    for (const unit of Object.keys(massHi.units)) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("kg", 1)).toBe("किलोग्राम");
    expect(word("oz", 5)).toBe("औंस");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("kg", count, "conversion-target")).toBe(
        word("kg", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("kg", undefined)).toBe("किलोग्राम");
  });

  test("an engine built from it reads and writes Hindi mass", () => {
    const e = engine();
    // The plain quantity, in both registers: the spelled noun and the dotless
    // Devanagari abbreviation, which is what R8's symbol is here because
    // कि.ग्रा. with its full stops would end the word token at the first dot.
    expect(e.evaluate("5 किलोग्राम").formatted).toBe("5 किलोग्राम");
    expect(e.evaluate("500 मिग्रा").formatted).toBe("500 मिलीग्राम");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // किलोग्राम में कितने ग्राम".
    expect(e.evaluate("1 किलोग्राम में ग्राम").formatted).toBe("1,000 ग्राम");
    expect(e.evaluate("1 किलोग्राम को ग्राम").formatted).toBe("1,000 ग्राम");
    expect(e.evaluate("1 किलोग्राम से ग्राम").formatted).toBe("1,000 ग्राम");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and the word is the same one 1 takes.
    expect(e.evaluate("1 किग्रा जोड़ 500 ग्रा").formatted).toBe("1.5 किलोग्राम");
    // Zero and a half: Hindi's singular row, where English would use its plural.
    // The strings are equal, which is exactly why the `selectForm` assertions
    // above are stated against the language and not left to the formatter.
    expect(e.evaluate("0.5 किलोग्राम").formatted).toBe("0.5 किलोग्राम");
    // A cardinal read through `hindi.numerals`, including लाख — the scale
    // English has no word for.
    expect(e.evaluate("पाँच किलोग्राम").formatted).toBe("5 किलोग्राम");
    expect(e.evaluate("एक लाख ग्राम को किलोग्राम").formatted).toBe("100 किलोग्राम");
    // The oblique plural, read by `hindi`'s stripper rather than listed here.
    expect(e.evaluate("पच्चीस किलोग्रामों में ग्राम").formatted).toBe("25,000 ग्राम");
    // The imperial units, in their Hindi spellings.
    expect(e.evaluate("1 पाउंड को औंस").formatted).toBe("16 औंस");
    expect(e.evaluate("3 टन").formatted).toBe("3 टन");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("2 kg").formatted).toBe("2 किलोग्राम");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("1 टन को ग्राम").formatted).toBe("1,000,000 ग्राम");
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip, which is the property
    // everything else rests on: `parseNumber` removes every occurrence of the
    // group character wherever it falls and never counts digits between them, so
    // the reader is grouping-agnostic and accepts the Indian form the writer
    // cannot yet produce. The day core learns about grouping periods, the first
    // assertion above fails and this one is already its regression test.
    expect(engine().evaluate("10,00,000 ग्राम").formatted).toBe("1,000,000 ग्राम");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 किग्रा जोड़ 500 ग्रा",
      "1 किलोग्राम में ग्राम",
      "1 टन को ग्राम",
      "1 पाउंड को औंस",
      "500 मिग्रा",
      "0.5 किलोग्राम",
      "3 टन",
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
