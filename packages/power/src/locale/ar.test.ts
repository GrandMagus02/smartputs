import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerAr from "./ar";

const engine = createEngine({
  locales: [composeLocale(arabic, [powerAr])],
  kinds: [power],
});

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (
  unit: string,
  count?: number,
  slot: "after-number" | "conversion-target" = "after-number",
) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "power",
    unit,
    slot,
  });

/** What this unit would print at this count — the table entry, not the rendering. */
const word = (unit: string, count?: number) =>
  powerAr.units[unit]?.forms?.[key(unit, count)];

/**
 * Exactly the six CLDR categories `arabic.selectForm` can return, sorted. Not
 * eight and not two: one axis, because the case a preposition governs in Arabic
 * is a short vowel nobody writes, and the one written case ending is already
 * carried by `many`.
 */
const SIX_KEYS = ["few", "many", "one", "other", "two", "zero"];

describe("power ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and magnitude bands, so no script but ASCII may
  // reach it. An Arabic letter anywhere in the descriptor would mean a
  // translation had leaked into the half of the package that is language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(power)).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("every unit carries exactly the six keys the language can ask for", () => {
    // All five, including `hp` — which is where Arabic and Russian part company.
    // `@smartput/power/locale/ru` has to drop the horsepower's `forms` because
    // Russian says "лошадиная сила", an adjective plus a noun with a space
    // between them that no alias can claim. Arabic says حصان, one word, so the
    // table is complete here without any special case.
    for (const unit of Object.keys(powerAr.units)) {
      expect(Object.keys(powerAr.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        SIX_KEYS,
      );
    }
  });

  test("the six keys are the six CLDR categories, on one axis", () => {
    expect([0, 1, 2, 5, 11, 100, 1.5].map((n) => key("w", n))).toEqual([
      "zero",
      "one",
      "two",
      "few",
      "many",
      "other",
      "other",
    ]);
    // Category is decided by n mod 100, which is the rule a hand-written plural
    // table gets wrong: 103 is `few` and 111 is `many`.
    expect(key("w", 103)).toBe("few");
    expect(key("w", 111)).toBe("many");
    // One axis. Ukrainian and Russian answer differently for a conversion target
    // because a preposition governs a case there; Arabic's case marking on these
    // nouns is a short vowel that is not written, so the slot is inert.
    expect(key("w", 5, "conversion-target")).toBe(key("w", 5, "after-number"));
    // Ruling R5: a target has no magnitude, and Arabic's generic category is the
    // genitive singular — the opposite of French, where it is plural.
    expect(key("w")).toBe("other");
    expect(word("w")).toBe("واط");
  });

  test("the borrowing takes a sound plural and the native noun a broken one", () => {
    // **Borrowed, masculine.** واط takes the productive endings: a suffixed dual,
    // a sound plural in ـات, and a tamyīz whose alif makes it visibly different
    // from the singular. Three distinct strings across six rows, which is the
    // same paradigm كيلوغرام takes in `@smartput/core/locale/ar`'s worked
    // example.
    expect(word("w", 1)).toBe("واط");
    expect(word("w", 2)).toBe("واطان");
    expect(word("w", 5)).toBe("واطات");
    expect(word("w", 11)).toBe("واطًا");
    // The fractional row, which is where a table ported by renaming English
    // columns prints a plural at a user. It is the genitive singular.
    expect(word("kw", 1.5)).toBe("كيلوواط");
    // **Native.** حصان is an Arabic noun, so its plural is *broken* — the stem
    // re-arranged around an added hamza and a tāʾ marbūṭa — and nothing in
    // `arabic`'s analyzer chain could have derived it from the singular.
    expect(word("hp", 5)).toBe("أحصنة");
    expect(word("hp", 2)).toBe("حصانان");
    expect(word("hp", 11)).toBe("حصانًا");
    expect(word("hp", 300)).toBe("حصان");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias can still round-trip, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. So nothing fails while the
  // vocabulary quietly relies on a guess for a word it had itself chosen to
  // print. أحصنة is exactly the form the stripper could never have produced.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(powerAr.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [powerAr]), [power]),
    ).not.toThrow();
    // The default counts are all integers. They do reach five of Arabic's six
    // categories, but they never reach `other` through a fraction — and a
    // fraction is the case this table is likeliest to get wrong, because CLDR
    // calls that category "other" and Arabic fills it with a singular.
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [powerAr]), [power], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic power", () => {
    // The category boundary, all of it, on one noun.
    expect(engine.evaluate("1 واط").formatted).toBe("1 واط");
    expect(engine.evaluate("2 واط").formatted).toBe("2 واطان");
    expect(engine.evaluate("5 واط").formatted).toBe("5 واطات");
    expect(engine.evaluate("11 واط").formatted).toBe("11 واطًا");
    // A sum that lands on a fraction — the assertion that would read
    // "1.5 كيلوواطات" if `other` held a plural instead of the genitive singular
    // it is.
    expect(engine.evaluate("1 كيلوواط + 500 واط").formatted).toBe("1.5 كيلوواط");
    // A conversion, written with في — the preposition Arabic states one with —
    // and the "," group separator the `latn` numbering system gives.
    expect(engine.evaluate("2 كيلوواط في واط").formatted).toBe("2,000 واط");
    // The horsepower, which Arabic writes as one word and Russian cannot. 300 is
    // `other`, the count a car spec sheet actually carries.
    expect(engine.evaluate("300 حصان").formatted).toBe("300 حصان");
    // ...and the broken plural at the counts that reach it.
    expect(engine.evaluate("5 حصان").formatted).toBe("5 أحصنة");
    expect(engine.evaluate("5 أحصنة").formatted).toBe("5 أحصنة");
    // The plain-alif spelling a typist produces without the hamza key. The
    // orthographic fold in `@smartput/core/locale/ar` runs one way only — it
    // deletes a hamza and can never invent one — so احصنة is declared beside
    // أحصنة rather than left to be derived.
    expect(engine.evaluate("5 احصنة").formatted).toBe("5 أحصنة");
    // Latin in, Arabic out: an `ar` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts`.
    expect(engine.evaluate("5 kw").formatted).toBe("5 كيلوواطات");
    // The tāʾ spelling of the same borrowing, which the Levant writes where the
    // Gulf writes ṭāʾ. Read, never printed.
    expect(engine.evaluate("2 وات").formatted).toBe("2 واطان");
  });

  test("the output is logically ordered, with Latin digits, and nothing invisible in it", () => {
    const printed = engine.evaluate("2 واط").formatted;
    // **Right-to-left is a display property, not a string property.** The number
    // comes first in memory here exactly as it does in "2 watts"; the bidi
    // algorithm in the terminal or the browser is what draws it on the right. A
    // "fix" that reversed the parts would emit the label first in logical order,
    // which `parse` reads as a unit followed by a number.
    expect(printed.indexOf("2")).toBeLessThan(printed.indexOf("واطان"));
    // And nothing invisible travels in it. Bidi marks and isolates (U+200E,
    // U+200F, U+2066–U+2069) would survive `normalize()`, which strips only the
    // zero-width family, and reach the lexer.
    expect(printed).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    // Latin digits with "," grouping and "." for the decimal: the `latn`
    // numbering system, transcribed in `@smartput/core/locale/ar` rather than
    // read from `Intl`, because this engine can only emit Latin digits and
    // pairing them with the Arabic-Indic separators would print "1٬234٫5".
    expect(engine.evaluate("1234.5 واط").formatted).toBe("1,234.5 واط");
  });

  test("Arabic-Indic digits are a core-level gap, not one a vocabulary can close", () => {
    // `lex`'s `isDigit` is a `"0"…"9"` range check, so ٥ is neither a digit nor
    // a letter and falls through the "unrecognized character: skip it" branch.
    // What reaches the parser is a bare unit word, which reads as one of it. The
    // wrong answer is pinned rather than described, so that the day core grows a
    // digit-folding seam in `normalize()` this test fails and names the fix.
    expect(engine.evaluate("٥ واط").formatted).toBe("1 واط");
  });

  test("round-trips its own output", () => {
    for (const input of [
      "1 واط",
      "2 واط",
      "5 واط",
      "11 واط",
      "1 كيلوواط + 500 واط",
      "2 كيلوواط في واط",
      "300 حصان",
      "5 حصان",
      "5 kw",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
