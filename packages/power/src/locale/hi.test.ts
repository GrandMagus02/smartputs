import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerHi from "./hi";

const hi = () => composeLocale(hindi, [powerHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [power] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts that
 * the tables agree with the list. Sweeping the counts that move a plural rule in
 * any language in this repo against all three slots is what shows the answer is
 * two keys on one axis, which is what makes the tables below two rows.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "power", unit: "kw", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "power", unit: "kw", slot }),
      ),
    ]),
  ),
].sort();

describe("power hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the five nouns: the kind is ratios,
    // unit ids and magnitude bands, so any character from a script no ratio could
    // contain is the failure.
    expect(JSON.stringify(power)).not.toMatch(/\p{Script=Devanagari}/u);
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
    for (const [unit, words] of Object.entries(powerHi.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // The gap this closes is invisible to every other test here: a printed form
    // that is not a listed alias still round-trips, because `hindi`'s suffix
    // stripper recovers it — at `weight: -2`. A word the printer emits should
    // never come back through the penalised path.
    for (const [unit, words] of Object.entries(powerHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
      expect(words.aliases, `${unit} prints a symbol it does not list`).toContain(
        words.symbol as string,
      );
    }
  });

  test("every symbol is one token", () => {
    // Nothing here can survive a symbol carrying an operator: `power` declares no
    // ops of its own, so a compound symbol would have nothing to compute back and
    // the printed quantity would throw on its own output. That is the argument
    // `@smartput/tempo/locale/uk` spells out at length, and it applies to every
    // unit in this file — which is exactly why the Hindi abbreviations, all of
    // them written with full stops, could not be used.
    for (const [unit, words] of Object.entries(powerHi.units)) {
      const symbol = words.symbol as string;
      expect(symbol, `${unit}'s symbol holds an operator character`).not.toMatch(
        /[/*+\-·×⋅]/,
      );
      expect(symbol, `${unit}'s symbol is more than one token`).not.toMatch(/[\s.]/u);
    }
  });

  test("every string in the file survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and Devanagari has a trap in it: ड़, ज़ and फ़ are Unicode composition
    // *exclusions*, so NFKC decomposes U+095C/U+095B/U+095E into a consonant plus
    // the nukta U+093C. A table written with a precomposed character tests green
    // against direct calls on this object and is unreachable through the engine.
    // Nothing here carries a nukta today; the assertion is what stops one
    // arriving precomposed.
    for (const [unit, words] of Object.entries(powerHi.units)) {
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
    expect(() => assertLocaleContract(hi(), [power])).not.toThrow();
    // Run again with fractions in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction below
    // 1 as well, so 0.5 and 1.5 land on opposite rows and neither is reached by
    // an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [power], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("the plural boundary is not English's", () => {
    // Hindi's `one` is `i = 0 or n = 1`. Zero is singular here and plural in
    // English, and every fraction below one is singular too. The words agree on
    // this kind, which is exactly why the boundary is stated against the language
    // rather than left to the formatter — `@smartput/duration/locale/hi` is where
    // the same two keys select two different words.
    const key = (n: number) =>
      hindi.selectForm({
        count: new Decimal(n),
        kind: "power",
        unit: "kw",
        slot: "bare",
      });
    expect([key(0), key(0.5), key(1), key(1.5)]).toEqual(["one", "one", "one", "other"]);
    expect(word("kw", 0)).toBe("किलोवाट");
    expect(word("kw", 1.5)).toBe("किलोवाट");
  });

  test("both rows hold one word, because a Hindi measure noun does not count", () => {
    // Not a half-finished table. A unit noun after a numeral stays in the direct
    // singular — "पाँच किलोवाट", never "पाँच किलोवाटें" — so the two rows agree on
    // every unit here, अश्वशक्ति included: it is feminine and ī-final and would
    // take अश्वशक्तियाँ if the measure-noun rule did not outrank the gender rule.
    for (const unit of Object.keys(powerHi.units)) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("w", 1)).toBe("वाट");
    expect(word("hp", 150)).toBe("अश्वशक्ति");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("kw", count, "conversion-target")).toBe(
        word("kw", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("kw", undefined)).toBe("किलोवाट");
  });

  test("an engine built from it reads and writes Hindi power", () => {
    const e = engine();
    expect(e.evaluate("5 किलोवाट").formatted).toBe("5 किलोवाट");
    // The one unit whose Hindi name is older than the borrowing, and the two
    // borrowings that are read into it.
    expect(e.evaluate("150 अश्वशक्ति").formatted).toBe("150 अश्वशक्ति");
    expect(e.evaluate("150 एचपी").formatted).toBe("150 अश्वशक्ति");
    expect(e.evaluate("150 हॉर्सपावर").formatted).toBe("150 अश्वशक्ति");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // किलोवाट में कितने वाट".
    expect(e.evaluate("1 किलोवाट में वाट").formatted).toBe("1,000 वाट");
    expect(e.evaluate("1 किलोवाट को वाट").formatted).toBe("1,000 वाट");
    expect(e.evaluate("1 किलोवाट से वाट").formatted).toBe("1,000 वाट");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and the word is the one 1 takes.
    expect(e.evaluate("1 मेगावाट जोड़ 500 किलोवाट").formatted).toBe("1.5 मेगावाट");
    // Zero and a half: Hindi's singular row, where English would use its plural.
    expect(e.evaluate("0 वाट").formatted).toBe("0 वाट");
    expect(e.evaluate("0.5 किलोवाट").formatted).toBe("0.5 किलोवाट");
    // A cardinal read through `hindi.numerals`, including लाख — the scale English
    // has no word for, and the reason `hi-cardinals.ts` is not a translation of
    // `en`'s table.
    expect(e.evaluate("पाँच किलोवाट").formatted).toBe("5 किलोवाट");
    expect(e.evaluate("एक लाख वाट को किलोवाट").formatted).toBe("100 किलोवाट");
    // The matra variant of the giga- prefix, which a phonetic keyboard produces
    // and no rule reaches from the dictionary spelling.
    expect(e.evaluate("2 गिगावाट").formatted).toBe("2 गीगावाट");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("5 kw").formatted).toBe("5 किलोवाट");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("1 मेगावाट को वाट").formatted).toBe("1,000,000 वाट");
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip, which is the property
    // everything else rests on: `parseNumber` removes every occurrence of the
    // group character wherever it falls and never counts digits between them, so
    // the reader is grouping-agnostic and accepts the Indian form the writer
    // cannot yet produce. The day core learns about grouping periods, the first
    // assertion above fails and this one is already its regression test.
    expect(engine().evaluate("10,00,000 वाट").formatted).toBe("1,000,000 वाट");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "5 किलोवाट",
      "150 अश्वशक्ति",
      "1 किलोवाट में वाट",
      "1 मेगावाट जोड़ 500 किलोवाट",
      "0.5 किलोवाट",
      "0 वाट",
      "2 गिगावाट",
      "5 kw",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("किलोवाट is the alias `@smartput/energy/locale/hi` prints through", () => {
    // Not an accident of the word list. Hindi's energy vocabulary prints its
    // watt-hour family as "किलोवाट·घंटा", where U+00B7 lexes as `*` and the
    // energy kind's `* | power | duration` signature multiplies the operands back
    // into joules. That symbol only re-reads because this alias exists, so the
    // two files are wired together by this list rather than by an import — and
    // dropping it here would break a test in a package that does not import this
    // one.
    expect(powerHi.units.kw?.aliases).toContain("किलोवाट");
    expect(powerHi.units.w?.aliases).toContain("वाट");
    expect(powerHi.units.mw?.aliases).toContain("मेगावाट");
  });
});
