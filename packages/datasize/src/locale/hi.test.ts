import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeHi from "./hi";

const hi = () => composeLocale(hindi, [datasizeHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [datasize] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "datasize",
    unit,
    slot,
  });
  return (datasizeHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      hindi.selectForm({ kind: "datasize", unit: "gb", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "datasize", unit: "gb", slot }),
      ),
    ]),
  ),
].sort();

describe("datasize hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the nine nouns: the kind is ratios,
    // unit ids and magnitude bands, so any character from a script no ratio could
    // contain is the failure.
    expect(JSON.stringify(datasize)).not.toMatch(/\p{Script=Devanagari}/u);
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
    for (const [unit, words] of Object.entries(datasizeHi.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // The gap this closes is invisible to every other test here: a printed form
    // that is not a listed alias still round-trips, because `hindi`'s suffix
    // stripper recovers it — at `weight: -2`. A word the printer emits should
    // never come back through the penalised path, and the stripper widens the
    // trap here by knowing ों, which would quietly cover an oblique plural the
    // vocabulary chose to print while leaving the matra-level variants
    // (गिगाबाइट) unreachable.
    for (const [unit, words] of Object.entries(datasizeHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
      // And the symbol, which `Printer`'s `symbols: true` mode emits in place of
      // the form. केबी, एमबी and जीबी are only usable as symbols because they are
      // also spellings a Hindi reader types.
      expect(words.aliases, `${unit} prints a symbol it does not list`).toContain(
        words.symbol as string,
      );
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
    for (const [unit, words] of Object.entries(datasizeHi.units)) {
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
    expect(() => assertLocaleContract(hi(), [datasize])).not.toThrow();
    // Run again with fractions in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction below
    // 1 as well, so 0.5 and 1.5 land on opposite rows and neither is reached by
    // an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [datasize], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("the plural boundary is not English's", () => {
    // Hindi's `one` is `i = 0 or n = 1`. Zero is singular here and plural in
    // English, and every fraction below one is singular too. This is the row a
    // table ported from `en` by translating two strings in place gets wrong.
    expect(word("gb", 0)).toBe("गीगाबाइट");
    expect(word("gb", 0.5)).toBe("गीगाबाइट");
    expect(word("gb", 1)).toBe("गीगाबाइट");
    expect(word("gb", 1.5)).toBe("गीगाबाइट");
    const key = (n: number) =>
      hindi.selectForm({
        count: new Decimal(n),
        kind: "datasize",
        unit: "gb",
        slot: "bare",
      });
    // The strings above are equal, which is exactly why the boundary is stated
    // against the language rather than left to the formatter: the rows agree, and
    // the keys they are chosen by do not.
    expect([key(0), key(0.5), key(1), key(1.5)]).toEqual(["one", "one", "one", "other"]);
  });

  test("both rows hold one word, because a Hindi measure noun does not count", () => {
    // Not a half-finished table. A unit noun after a numeral stays in the direct
    // singular — "पाँच मेगाबाइट", never "पाँच मेगाबाइटें" — so the two rows agree
    // on every unit here. `@smartput/duration/locale/hi` is where that stops
    // being true: घंटा is ā-final masculine and its plural really is घंटे.
    for (const unit of Object.keys(datasizeHi.units)) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("mb", 1)).toBe("मेगाबाइट");
    expect(word("kib", 5)).toBe("किबिबाइट");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("gb", count, "conversion-target")).toBe(
        word("gb", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("gb", undefined)).toBe("गीगाबाइट");
  });

  test("the decimal and binary units never fold together", () => {
    // `kb` is 1000 bytes and `kib` is 1024, and किलोबाइट and किबिबाइट are as
    // different in Hindi as kilobyte and kibibyte are in English. They differ by
    // more than an ending, so no analyzer can join them; what this catches is a
    // translator listing one as an alias of the other.
    const e = engine();
    expect(e.evaluate("1 किलोबाइट को बाइट").formatted).toBe("1,000 बाइट");
    expect(e.evaluate("1 किबिबाइट को बाइट").formatted).toBe("1,024 बाइट");
    expect(e.evaluate("1 गिबिबाइट को मेबिबाइट").formatted).toBe("1,024 मेबिबाइट");
  });

  test("an engine built from it reads and writes Hindi datasize", () => {
    const e = engine();
    // The plain quantity, in both registers: the spelled noun and the Devanagari
    // initialism a mobile data pack is sold in.
    expect(e.evaluate("5 मेगाबाइट").formatted).toBe("5 मेगाबाइट");
    expect(e.evaluate("2 जीबी").formatted).toBe("2 गीगाबाइट");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // गीगाबाइट में कितने मेगाबाइट".
    expect(e.evaluate("1 जीबी में मेगाबाइट").formatted).toBe("1,000 मेगाबाइट");
    expect(e.evaluate("1 जीबी को मेगाबाइट").formatted).toBe("1,000 मेगाबाइट");
    expect(e.evaluate("1 जीबी से मेगाबाइट").formatted).toBe("1,000 मेगाबाइट");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and the word is the one 1 takes.
    expect(e.evaluate("1 गीगाबाइट जोड़ 500 मेगाबाइट").formatted).toBe("1.5 गीगाबाइट");
    // Zero and a half: Hindi's singular row, where English would use its plural.
    expect(e.evaluate("0 बाइट").formatted).toBe("0 बाइट");
    expect(e.evaluate("0.5 टेराबाइट").formatted).toBe("0.5 टेराबाइट");
    // A cardinal read through `hindi.numerals`, including लाख — the scale English
    // has no word for, and the reason `hi-cardinals.ts` is not a translation of
    // `en`'s table.
    expect(e.evaluate("पाँच जीबी").formatted).toBe("5 गीगाबाइट");
    expect(e.evaluate("एक लाख बाइट").formatted).toBe("100,000 बाइट");
    // The oblique plural, read by `hindi`'s stripper rather than listed here: it
    // is what a plural noun becomes in front of a postposition, which is exactly
    // where the `in` keywords put it.
    expect(e.evaluate("पच्चीस मेगाबाइटों में किलोबाइट").formatted).toBe("25,000 किलोबाइट");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("2 gb").formatted).toBe("2 गीगाबाइट");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("1 टेराबाइट को मेगाबाइट").formatted).toBe("1,000,000 मेगाबाइट");
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip, which is the property
    // everything else rests on: `parseNumber` removes every occurrence of the
    // group character wherever it falls and never counts digits between them, so
    // the reader is grouping-agnostic and accepts the Indian form the writer
    // cannot yet produce. The day core learns about grouping periods, the first
    // assertion above fails and this one is already its regression test.
    expect(engine().evaluate("10,00,000 बाइट").formatted).toBe("1,000,000 बाइट");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "5 मेगाबाइट",
      "1 जीबी में मेगाबाइट",
      "1 गीगाबाइट जोड़ 500 मेगाबाइट",
      "1 किबिबाइट को बाइट",
      "1 टेराबाइट को मेगाबाइट",
      "0.5 टेराबाइट",
      "0 बाइट",
      "2 gb",
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
