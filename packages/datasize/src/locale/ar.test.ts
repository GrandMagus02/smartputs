import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeAr from "./ar";

const engine = createEngine({
  locales: [composeLocale(arabic, [datasizeAr])],
  kinds: [datasize],
});

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (
  unit: string,
  count?: number,
  slot: "after-number" | "conversion-target" = "after-number",
) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "datasize",
    unit,
    slot,
  });

/** What `word(unit, n)` would print — the table entry, not the rendered string. */
const word = (unit: string, count?: number) =>
  datasizeAr.units[unit]?.forms?.[key(unit, count)];

/**
 * Exactly the six CLDR categories `arabic.selectForm` can return, sorted. Not
 * eight and not two: one axis, because the case a preposition governs in Arabic
 * is a short vowel nobody writes, and the one written case ending is already
 * carried by `many`.
 */
const SIX_KEYS = ["few", "many", "one", "other", "two", "zero"];

describe("datasize ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and magnitude bands, so no script but ASCII may
  // reach it. An Arabic letter anywhere in the descriptor would mean a
  // translation had leaked into the half of the package that is language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(datasize)).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("every unit carries exactly the six keys the language can ask for", () => {
    // All nine units are single nouns an Arabic speaker writes out — none is a
    // symbol-only compound the way `speed`'s "كم/س" is — so the assertion is
    // unconditional. Six keys is exactly what `arabic.selectForm` can produce
    // and therefore exactly what it may index: a seventh would never be read and
    // a missing sixth renders a wrong word rather than throwing.
    for (const unit of Object.keys(datasizeAr.units)) {
      expect(Object.keys(datasizeAr.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        SIX_KEYS,
      );
    }
  });

  test("the six keys are the six CLDR categories, on one axis", () => {
    expect([0, 1, 2, 5, 11, 100, 1.5].map((n) => key("b", n))).toEqual([
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
    expect(key("b", 103)).toBe("few");
    expect(key("b", 111)).toBe("many");
    // One axis. Ukrainian and Russian answer differently for a conversion target
    // because a preposition governs a case there; Arabic's case marking on these
    // nouns is a short vowel that is not written, so the slot is inert and
    // saying so is cheaper than six more rows per unit that would hold the same
    // strings.
    expect(key("b", 5, "conversion-target")).toBe(key("b", 5, "after-number"));
    // Ruling R5: a target has no magnitude, and Arabic's generic category is the
    // genitive singular — the opposite of French, where it is plural.
    expect(key("b")).toBe("other");
    expect(word("b")).toBe("بايت");
  });

  test("the six rows are three decisions, and one of them is a dual", () => {
    // `zero`, `one` and `other` hold one string, and that is correct rather than
    // half-finished: the three differ only in a final short vowel and Arabic
    // does not write short vowels.
    expect(word("b", 0)).toBe("بايت");
    expect(word("b", 1)).toBe("بايت");
    expect(word("b", 100)).toBe("بايت");
    // The DUAL. A suffixed form of the noun meaning exactly two of the thing —
    // no other language shipped in this repo has one.
    expect(word("b", 2)).toBe("بايتان");
    // The plural, for three through ten.
    expect(word("b", 5)).toBe("بايتات");
    // The tamyīz: an accusative **singular** with tanwīn, spelled with the alif
    // that carries the mark. Written out as escapes so the assertion cannot pass
    // by way of an invisible combining character being dropped in an edit — the
    // failure mode `ar.ts`'s `AN` constant exists to prevent.
    expect(word("b", 11)).toBe("بايتًا");
    // The fractional row, which is where a table ported by renaming English
    // columns prints a plural at a user. It is the genitive singular.
    expect(word("mb", 1.5)).toBe("ميغابايت");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias can still round-trip, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. So nothing fails while the
  // vocabulary quietly relies on a guess for a word it had itself chosen to
  // print. Asserting the containment keeps the two halves of a unit's entry —
  // what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(datasizeAr.units)) {
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
      assertLocaleContract(composeLocale(arabic, [datasizeAr]), [datasize]),
    ).not.toThrow();
    // The default counts are all integers. They do reach five of Arabic's six
    // categories, but they never reach `other` through a fraction — and a
    // fraction is the case this table is likeliest to get wrong, because CLDR
    // calls that category "other" and Arabic fills it with a singular.
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [datasizeAr]), [datasize], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the decimal and binary families never fold together", () => {
    // `kb` is 1000 bytes and `kib` is 1024, so كيلوبايت and كيبيبايت have to be
    // two units in Arabic exactly as they are two units in English. A shared
    // alias would be a silent factor-of-1.024 error.
    expect(engine.evaluate("1 كيلوبايت").value?.canonical.toFixed()).toBe("1000");
    expect(engine.evaluate("1 كيبيبايت").value?.canonical.toFixed()).toBe("1024");
    for (const [unit, words] of Object.entries(datasizeAr.units)) {
      for (const alias of words.aliases) {
        const rivals = Object.entries(datasizeAr.units).filter(
          ([other, w]) => other !== unit && w.aliases.includes(alias),
        );
        expect(
          rivals.map(([o]) => o),
          `${unit} shares alias "${alias}"`,
        ).toEqual([]);
      }
    }
  });

  test("an engine built from it reads and writes Arabic datasize", () => {
    // The category boundary, all of it, on one noun. This is what six rows buy:
    // English moves once between 1 and 2 and Arabic moves four times.
    expect(engine.evaluate("0 بايت").formatted).toBe("0 بايت");
    expect(engine.evaluate("1 بايت").formatted).toBe("1 بايت");
    expect(engine.evaluate("2 بايت").formatted).toBe("2 بايتان");
    expect(engine.evaluate("5 بايت").formatted).toBe("5 بايتات");
    expect(engine.evaluate("11 بايت").formatted).toBe("11 بايتًا");
    expect(engine.evaluate("100 بايت").formatted).toBe("100 بايت");
    // A sum that lands on a fraction — the assertion that would read
    // "1.5 غيغابايتات" if `other` held a plural instead of the genitive singular
    // it is.
    expect(engine.evaluate("1 غيغابايت + 500 ميغابايت").formatted).toBe("1.5 غيغابايت");
    // A conversion, written with الى — the hamza-less spelling of إلى that most
    // Arabic keyboards produce — and the "," group separator the `latn`
    // numbering system pinned in `@smartput/core/locale/ar` gives.
    expect(engine.evaluate("2 كيلوبايت الى بايت").formatted).toBe("2,000 بايت");
    // Latin in, Arabic out: an `ar` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts` before the Arabic
    // spellings are appended to it. 5 is `few`, so the plural prints.
    expect(engine.evaluate("5 gb").formatted).toBe("5 غيغابايتات");
    // The jīm spelling of the foreign /g/, which Egypt and the Levant write
    // where the Gulf writes ghayn. Read, never printed.
    expect(engine.evaluate("2 جيجابايت").formatted).toBe("2 غيغابايتان");
  });

  test("the output is logically ordered, with Latin digits, and nothing invisible in it", () => {
    const printed = engine.evaluate("2 كيلوبايت").formatted;
    // **Right-to-left is a display property, not a string property.** The number
    // comes first in memory here exactly as it does in "2 kilobytes"; the bidi
    // algorithm in the terminal or the browser is what draws it on the right. A
    // "fix" that reversed the parts would emit the label first in logical order,
    // which `parse` reads as a unit followed by a number.
    expect(printed.indexOf("2")).toBeLessThan(printed.indexOf("كيلوبايتان"));
    // And nothing invisible travels in it. Bidi marks and isolates (U+200E,
    // U+200F, U+2066–U+2069) would survive `normalize()`, which strips only the
    // zero-width family, and reach the lexer.
    expect(printed).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    // Latin digits, because that is the only kind this engine can emit:
    // `formatNumber` builds from `Decimal.toFixed()`, which is ASCII.
    expect(engine.evaluate("1234.5 ميغابايت").formatted).toBe("1,234.5 ميغابايت");
  });

  test("Arabic-Indic digits are a core-level gap, not one a vocabulary can close", () => {
    // `lex`'s `isDigit` is a `"0"…"9"` range check, so ٥ is neither a digit nor
    // a letter and falls through the "unrecognized character: skip it" branch.
    // What reaches the parser is a bare unit word, which reads as one of it. The
    // wrong answer is pinned rather than described, so that the day core grows a
    // digit-folding seam in `normalize()` this test fails and names the fix.
    expect(engine.evaluate("٥ بايت").formatted).toBe("1 بايت");
  });

  test("round-trips its own output", () => {
    // Every category is in this list, because the printed noun differs in four
    // of them and a round trip that only ever exercised the singular would prove
    // nothing about the dual, the plural or the tamyīz.
    for (const input of [
      "1 بايت",
      "2 بايت",
      "5 بايت",
      "11 بايت",
      "1.5 ميغابايت",
      "1 غيغابايت + 500 ميغابايت",
      "2 كيلوبايت الى بايت",
      "5 gb",
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
