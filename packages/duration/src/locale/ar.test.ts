import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationAr from "./ar";

const engine = createEngine({
  locales: [composeLocale(arabic, [durationAr])],
  kinds: [duration],
});

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (
  unit: string,
  count?: number,
  slot: "after-number" | "conversion-target" = "after-number",
) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "duration",
    unit,
    slot,
  });

/** What this unit would print at this count — the table entry, not the rendering. */
const word = (unit: string, count?: number) =>
  durationAr.units[unit]?.forms?.[key(unit, count)];

/**
 * Exactly the six CLDR categories `arabic.selectForm` can return, sorted. Not
 * eight and not two: one axis, because the case a preposition governs in Arabic
 * is a short vowel nobody writes, and the one written case ending is already
 * carried by `many`.
 */
const SIX_KEYS = ["few", "many", "one", "other", "two", "zero"];

describe("duration ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and magnitude bands, so no script but ASCII may
  // reach it. An Arabic letter anywhere in the descriptor would mean a
  // translation had leaked into the half of the package that is language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(duration)).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("five units carry exactly the six keys, and `ms` carries none", () => {
    // Six keys is exactly what `arabic.selectForm` can produce and therefore
    // exactly what may be indexed: a seventh would never be read, and a missing
    // sixth renders a wrong word rather than throwing.
    for (const unit of ["s", "min", "h", "d", "wk"]) {
      expect(Object.keys(durationAr.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        SIX_KEYS,
      );
    }
    // `ms` is the exception and the reason is the lexer, not Arabic: the name is
    // "ميلي ثانية", two words, and a space ends a word token. There is no single
    // Arabic token to put in a table, and no settled one-token abbreviation to
    // print either — "م.ث" carries a dot, which the lexer skips. So the Latin
    // symbol ships, the same call `@smartput/energy/locale/uk` makes for BTU.
    expect(durationAr.units.ms?.forms).toBeUndefined();
    expect(durationAr.units.ms?.symbol).toBe("ms");
    expect(durationAr.units.ms?.aliases.join("")).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("the six keys are the six CLDR categories, on one axis", () => {
    expect([0, 1, 2, 5, 11, 100, 1.5].map((n) => key("h", n))).toEqual([
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
    expect(key("h", 103)).toBe("few");
    expect(key("h", 111)).toBe("many");
    // One axis. Ukrainian and Russian answer differently for a conversion target
    // because a preposition governs a case there; Arabic's case marking on these
    // nouns is a short vowel that is not written, so the slot is inert — and
    // saying so is cheaper than six more rows per unit holding the same strings.
    expect(key("h", 5, "conversion-target")).toBe(key("h", 5, "after-number"));
    // Ruling R5: a target has no magnitude, and Arabic's generic category is the
    // genitive singular — "٩٠ دقيقة في ساعة", singular, the opposite of French.
    expect(key("h")).toBe("other");
    expect(word("h")).toBe("ساعة");
  });

  test("gender decides how many of the six rows differ", () => {
    // **Feminine.** ساعة ends in tāʾ marbūṭa, so its tanwīn is a bare mark with
    // no alif under it and the `many` row is spelled exactly like the singular:
    // five of six rows are one string, and only the dual stands apart. That dual
    // *replaces* the ة rather than following it, which is why no suffix strip
    // could ever have produced it.
    expect(word("h", 1)).toBe("ساعة");
    expect(word("h", 2)).toBe("ساعتان");
    expect(word("h", 5)).toBe("ساعات");
    expect(word("h", 11)).toBe("ساعة");
    expect(word("h", 1.5)).toBe("ساعة");
    // **Masculine.** يوم takes the visible accusative ending, so its `many` row
    // is a different string from its singular — the one written case ending in
    // Arabic, and the whole reason this language needs six categories where
    // Ukrainian needs four.
    expect(word("d", 1)).toBe("يوم");
    expect(word("d", 2)).toBe("يومان");
    expect(word("d", 11)).toBe("يومًا");
    // **Broken plurals.** ثوان، دقائق، أيام and أسابيع are formed by
    // re-arranging the stem, so nothing in `arabic`'s analyzer chain can derive
    // them from the singular and they are listed rather than hoped for.
    expect(word("s", 5)).toBe("ثوان");
    expect(word("min", 5)).toBe("دقائق");
    expect(word("d", 5)).toBe("أيام");
    expect(word("wk", 5)).toBe("أسابيع");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias can still round-trip, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. So nothing fails while the
  // vocabulary quietly relies on a guess for a word it had itself chosen to
  // print. It is the check that catches a broken plural, which the stripper
  // could never have produced from the singular.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(durationAr.units)) {
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
      assertLocaleContract(composeLocale(arabic, [durationAr]), [duration]),
    ).not.toThrow();
    // The default counts are all integers. They do reach five of Arabic's six
    // categories, but they never reach `other` through a fraction — and a
    // fraction is the case this table is likeliest to get wrong, because CLDR
    // calls that category "other" and Arabic fills it with a singular.
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [durationAr]), [duration], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic duration", () => {
    // The category boundary, all of it, on one noun. This is what six rows buy:
    // English moves once between 1 and 2 and Arabic moves three times here.
    expect(engine.evaluate("0 ثانية").formatted).toBe("0 ثانية");
    expect(engine.evaluate("1 ساعة").formatted).toBe("1 ساعة");
    expect(engine.evaluate("2 ساعة").formatted).toBe("2 ساعتان");
    expect(engine.evaluate("5 ساعات").formatted).toBe("5 ساعات");
    // A sum that lands on a fraction, written with the one-letter symbols Arabic
    // genuinely abbreviates the clock units with. `other` is the genitive
    // singular, so this reads "1.5 ساعة" — printing "1.5 ساعات" is the specific
    // mistake the six-row table exists to prevent.
    expect(engine.evaluate("1 س + 30 د").formatted).toBe("1.5 ساعة");
    // The same fraction reached by a conversion rather than a sum, written with
    // في — the preposition Arabic states a conversion with, claimed as `in`
    // rather than as `times` because conversion has no second word here.
    expect(engine.evaluate("90 د في ساعات").formatted).toBe("1.5 ساعة");
    // A conversion whose result lands in `many` (48 mod 100), which on a
    // feminine noun is spelled exactly like the singular.
    expect(engine.evaluate("2 يوم في ساعات").formatted).toBe("48 ساعة");
    // A broken plural out: 7 is `few`, and أيام is the stem re-arranged.
    expect(engine.evaluate("1 أسبوع في أيام").formatted).toBe("7 أيام");
    // The masculine tamyīz, the row a table ported from English fills with a
    // plural: "11 يومًا" is a singular noun in the accusative.
    expect(engine.evaluate("11 يوم").formatted).toBe("11 يومًا");
    // The unit with no Arabic word at all, printing its Latin symbol.
    expect(engine.evaluate("500 ms").formatted).toBe("500 ms");
    // Latin in, Arabic out: an `ar` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts`.
    expect(engine.evaluate("2 h").formatted).toBe("2 ساعتان");
    // The plain-alif spelling a typist produces without the hamza key. The
    // orthographic fold in `@smartput/core/locale/ar` runs one way only — it
    // deletes a hamza and can never invent one — so اسبوع is declared beside
    // أسبوع rather than left to be derived.
    expect(engine.evaluate("2 اسبوع").formatted).toBe("2 أسبوعان");
  });

  test("the output is logically ordered, with Latin digits, and nothing invisible in it", () => {
    const printed = engine.evaluate("2 ساعة").formatted;
    // **Right-to-left is a display property, not a string property.** The number
    // comes first in memory here exactly as it does in "2 hours"; the bidi
    // algorithm in the terminal or the browser is what draws it on the right. A
    // "fix" that reversed the parts would emit the label first in logical order,
    // which `parse` reads as a unit followed by a number.
    expect(printed.indexOf("2")).toBeLessThan(printed.indexOf("ساعتان"));
    // And nothing invisible travels in it. Bidi marks and isolates (U+200E,
    // U+200F, U+2066–U+2069) would survive `normalize()`, which strips only the
    // zero-width family, and reach the lexer.
    expect(printed).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    // Latin digits with "," grouping and "." for the decimal: the `latn`
    // numbering system, transcribed in `@smartput/core/locale/ar` rather than
    // read from `Intl`, because this engine can only emit Latin digits and
    // pairing them with the Arabic-Indic separators would print "1٬234٫5".
    expect(engine.evaluate("1234.5 ساعة").formatted).toBe("1,234.5 ساعة");
  });

  test("Arabic-Indic digits are a core-level gap, not one a vocabulary can close", () => {
    // `lex`'s `isDigit` is a `"0"…"9"` range check, so ٥ is neither a digit nor
    // a letter and falls through the "unrecognized character: skip it" branch.
    // What reaches the parser is a bare unit word, which reads as one of it. The
    // wrong answer is pinned rather than described, so that the day core grows a
    // digit-folding seam in `normalize()` this test fails and names the fix.
    expect(engine.evaluate("٥ ساعات").formatted).toBe("1 ساعة");
  });

  test("round-trips its own output", () => {
    // Every category the printed noun differs in is in this list, because a
    // round trip that only exercised the singular would prove nothing about the
    // dual, the broken plurals or the tamyīz.
    for (const input of [
      "1 ساعة",
      "2 ساعة",
      "5 ساعات",
      "11 يوم",
      "1 س + 30 د",
      "90 د في ساعات",
      "1 أسبوع في أيام",
      "500 ms",
      "5 دقائق",
      "3 ثوان",
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
