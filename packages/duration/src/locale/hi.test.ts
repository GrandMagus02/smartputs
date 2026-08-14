import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationHi from "./hi";

const hi = () => composeLocale(hindi, [durationHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [duration] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      hindi.selectForm({ kind: "duration", unit: "h", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "duration", unit: "h", slot }),
      ),
    ]),
  ),
].sort();

describe("duration hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the six nouns: the kind is ratios,
    // unit ids and magnitude bands, so any character from a script no ratio could
    // contain is the failure.
    expect(JSON.stringify(duration)).not.toMatch(/\p{Script=Devanagari}/u);
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
    for (const [unit, words] of Object.entries(durationHi.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // The gap this closes is invisible to every other test here: a printed form
    // that is not a listed alias still round-trips, because `hindi`'s suffix
    // stripper recovers it — at `weight: -2`. This package is where that matters
    // most, because घंटे is the one printed form in the phase that the stripper
    // *does* touch: it strips े and lands on घंट, a stem no alias claims, so
    // without the explicit listing the plural would be reachable only by not
    // being reachable.
    for (const [unit, words] of Object.entries(durationHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
      // And the symbol, which `Printer`'s `symbols: true` mode emits in place of
      // the form.
      expect(words.aliases, `${unit} prints a symbol it does not list`).toContain(
        words.symbol as string,
      );
    }
  });

  test("no unit claims से, which is one of Hindi's `in` keywords", () => {
    // The natural clipping of सेकंड is से, and it is also the postposition
    // `hindi` claims for conversion ("किलोग्राम से ग्राम"). `buildKeywords` folds
    // keywords before the alias index is consulted, so a unit that claimed this
    // surface would turn every conversion written with से into a stray quantity —
    // a failure that shows up three packages away, in whatever engine happens to
    // install this vocabulary. Asserted here, where the temptation lives.
    for (const [unit, words] of Object.entries(durationHi.units)) {
      for (const keyword of hindi.keywords.in ?? []) {
        expect(words.aliases, `${unit} claims the keyword "${keyword}"`).not.toContain(
          keyword,
        );
      }
    }
  });

  test("every string in the file survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and Devanagari has a trap in it: ड़, ज़ and फ़ are Unicode composition
    // *exclusions*, so NFKC decomposes U+095C/U+095B/U+095E into a consonant plus
    // the nukta U+093C. This package has a real one — हफ़्ता — which is why the
    // file builds it from an escaped U+093C rather than a literal. A precomposed
    // table would test green against direct calls on this object and be
    // unreachable through the engine.
    for (const [unit, words] of Object.entries(durationHi.units)) {
      for (const s of [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ]) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
    // And the nukta is the decomposed sequence rather than the precomposed
    // U+095E, stated as codepoints so the assertion cannot be satisfied by a
    // character that merely looks right.
    const hafta = durationHi.units.wk?.aliases.find((a) => a.includes("़"));
    expect(hafta, "हफ़्ता is not in the week's aliases").toBeDefined();
    expect([...(hafta as string)].map((c) => c.codePointAt(0))).toEqual([
      0x939, 0x92b, 0x93c, 0x94d, 0x924, 0x93e,
    ]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [duration])).not.toThrow();
    // Run again with fractions in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction below
    // 1 as well, so 0.5 and 1.5 land on opposite rows and neither is reached by
    // an integer sweep at all. On this kind that is not academic — the two rows
    // of `h` are two different words.
    expect(() =>
      assertLocaleContract(hi(), [duration], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("घंटा is the one unit whose two rows are two words", () => {
    // Hindi marks a plural by substituting the final vowel, and only on ā-final
    // masculine nouns. घंटा is one, so "दो घंटे" is obligatory in a way "पाँच
    // किलोग्राम" is not. The other five units are consonant-final masculines
    // whose direct plural is spelled exactly like the singular.
    expect(word("h", 1)).toBe("घंटा");
    expect(word("h", 2)).toBe("घंटे");
    expect(word("h", 5)).toBe("घंटे");
    for (const unit of ["ms", "s", "min", "d", "wk"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("min", 5)).toBe("मिनट");
    expect(word("d", 5)).toBe("दिन");
    expect(word("wk", 5)).toBe("सप्ताह");
  });

  test("the plural boundary is not English's, and here it moves a word", () => {
    // Hindi's `one` is `i = 0 or n = 1`: zero and every fraction below one are
    // singular, where English puts zero in `other`. Everywhere else in this phase
    // that difference is invisible because the two rows agree; on घंटा it is the
    // difference between printing घंटा and घंटे, which is what makes this the row
    // a table ported from `en` by translating two strings in place gets wrong.
    expect(word("h", 0)).toBe("घंटा");
    expect(word("h", 0.5)).toBe("घंटा");
    expect(word("h", 1)).toBe("घंटा");
    expect(word("h", 1.5)).toBe("घंटे");
    expect(word("h", 2)).toBe("घंटे");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("h", count, "conversion-target")).toBe(
        word("h", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`, which for this unit
    // is the plural — "घंटे में", the heading over a conversion table.
    expect(word("h", undefined)).toBe("घंटे");
  });

  test("an engine built from it reads and writes Hindi duration", () => {
    const e = engine();
    // The pair the whole file exists for, read and written both ways round.
    expect(e.evaluate("1 घंटा").formatted).toBe("1 घंटा");
    expect(e.evaluate("2 घंटे").formatted).toBe("2 घंटे");
    // The conjunct spelling of the same noun, which print uses and no rule
    // reaches from the anusvara spelling.
    expect(e.evaluate("1 घण्टा").formatted).toBe("1 घंटा");
    // Zero and a half take the singular, where English would take its plural.
    expect(e.evaluate("0 घंटा").formatted).toBe("0 घंटा");
    expect(e.evaluate("0.5 घंटा").formatted).toBe("0.5 घंटा");
    // And 1.5 does not: CLDR's Hindi `one` stops at 1.
    expect(e.evaluate("1.5 घंटे").formatted).toBe("1.5 घंटे");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // घंटे में कितने मिनट".
    expect(e.evaluate("1 घंटा में मिनट").formatted).toBe("60 मिनट");
    expect(e.evaluate("1 घंटा को मिनट").formatted).toBe("60 मिनट");
    expect(e.evaluate("1 घंटा से मिनट").formatted).toBe("60 मिनट");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 2.5 is `other`, so the plural comes back.
    expect(e.evaluate("2 घंटे जोड़ 30 मिनट").formatted).toBe("2.5 घंटे");
    // The fractional cardinals, which is the pair of rows this kind exists to
    // show: ढाई is 2.5 in one word and selects `other` (घंटे), आधे is 0.5 and
    // selects `one` (घंटा) — a boundary English does not have, reached by a
    // numeral English has no single word for.
    expect(e.evaluate("ढाई घंटे").formatted).toBe("2.5 घंटे");
    expect(e.evaluate("साढ़े तीन घंटे").formatted).toBe("3.5 घंटे");
    expect(e.evaluate("आधे घंटे में मिनट").formatted).toBe("30 मिनट");
    expect(e.evaluate("डेढ़ घंटे में मिनट").formatted).toBe("90 मिनट");
    // The oblique plural, read by `hindi`'s stripper only as far as the stem —
    // which is why घंटों is a listed alias here rather than left to the fallback.
    expect(e.evaluate("पाँच घंटों में मिनट").formatted).toBe("300 मिनट");
    // The everyday word for the week, read and answered with the formal one:
    // recognition is many-to-one while generation stays the one `forms` table.
    expect(e.evaluate("2 हफ़्ते").formatted).toBe("2 सप्ताह");
    // The same three forms typed on a keyboard with no nukta key. NFKC settles
    // how the mark is *encoded* and never supplies one that was not typed, so
    // these are listed outright: before they were, "एक हफ्ता" resolved only
    // through the fuzzy path, one edit from every other unit one edit from the
    // same string.
    expect(e.evaluate("2 हफ्ते").formatted).toBe("2 सप्ताह");
    expect(e.evaluate("1 हफ्ता").formatted).toBe("1 सप्ताह");
    expect(e.evaluate("दो हफ्तों में दिन").formatted).toBe("14 दिन");
    expect(e.evaluate("1 सप्ताह को दिन").formatted).toBe("7 दिन");
    // A cardinal read through `hindi.numerals`, including लाख — the scale English
    // has no word for, and the reason `hi-cardinals.ts` is not a translation of
    // `en`'s table.
    expect(e.evaluate("पाँच दिन").formatted).toBe("5 दिन");
    expect(e.evaluate("एक लाख मिलीसेकंड को सेकंड").formatted).toBe("100 सेकंड");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari — the
    // plural chosen by the count, not by the script it was typed in.
    expect(e.evaluate("3 h").formatted).toBe("3 घंटे");
    expect(e.evaluate("1 h").formatted).toBe("1 घंटा");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("1 दिन को मिलीसेकंड").formatted).toBe("86,400,000 मिलीसेकंड");
    expect(new Intl.NumberFormat("hi").format(86_400_000)).toBe("8,64,00,000");
    // What the gap does *not* break is the round trip, which is the property
    // everything else rests on: `parseNumber` removes every occurrence of the
    // group character wherever it falls and never counts digits between them, so
    // the reader is grouping-agnostic and accepts the Indian form the writer
    // cannot yet produce. The day core learns about grouping periods, the first
    // assertion above fails and this one is already its regression test.
    expect(engine().evaluate("8,64,00,000 मिलीसेकंड").formatted).toBe("86,400,000 मिलीसेकंड");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 घंटा",
      "2 घंटे",
      "0.5 घंटा",
      "1.5 घंटे",
      "2 घंटे जोड़ 30 मिनट",
      "1 घंटा में मिनट",
      "1 सप्ताह को दिन",
      "1 दिन को मिलीसेकंड",
      "2 हफ़्ते",
      "3 h",
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
