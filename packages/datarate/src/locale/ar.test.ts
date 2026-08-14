import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateAr from "./ar";

const engine = createEngine({
  locales: [composeLocale(arabic, [datarateAr])],
  kinds: [datarate],
});

/** The key `arabic` will index a unit's `forms` with, for this count. */
const key = (unit: string, count?: number) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "datarate",
    unit,
    slot: "after-number",
  });

describe("datarate ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids and magnitude bands, so no script but ASCII may
  // reach it. An Arabic letter anywhere in the descriptor would mean a
  // translation had leaked into the half of the package that is language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(datarate)).not.toMatch(/\p{Script=Arabic}/u);
  });

  // The decision `en.ts` records, restated for the language that would need six
  // keys rather than two. Arabic writes a rate as "ميغابت في الثانية", and the
  // middle word is `arabic`'s `in` keyword — so the spelled-out name does not
  // merely fail to lex as one unit token, it lexes as a *conversion*. There is
  // no single Arabic token meaning "megabits per second" to put in a table.
  test("no unit declares a written form", () => {
    for (const [unit, words] of Object.entries(datarateAr.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // `selectForm`'s contract, asserted here rather than assumed, because the
  // absence above is only defensible if the thing being declined is understood.
  // Six categories, one axis, and a dual at count 2 — the row no other language
  // in this repo has at all.
  test("the language would ask for six keys, and this kind answers with one symbol", () => {
    expect([0, 1, 2, 5, 11, 100, 1.5].map((n) => key("mbps", n))).toEqual([
      "zero",
      "one",
      "two",
      "few",
      "many",
      "other",
      "other",
    ]);
    // Ruling R5: a conversion target has no magnitude, and Arabic's generic
    // category is the genitive singular.
    expect(key("mbps")).toBe("other");
    // Every one of those keys lands on the same printed string, because the
    // renderer falls through to the symbol when there is no form.
    for (const n of [0, 1, 2, 5, 11, 100, 1.5]) {
      expect(datarateAr.units.mbps?.forms?.[key("mbps", n)]).toBeUndefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [datarateAr]), [datarate]),
    ).not.toThrow();
    // The default counts are all integers. In Arabic they do reach five of the
    // six categories, but never through a fraction — and a fraction is what
    // lands on `other`, the row a vocabulary is likeliest to get wrong. The kind
    // declares no forms for it to select, so this second call proves the
    // *absence* is uniform rather than merely untested: a unit that grew a
    // partial `forms` table would fail here and nowhere else.
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [datarateAr]), [datarate], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // The mechanism behind every round trip below, asserted directly rather than
  // left to be inferred from one. This kind's symbols re-read *because they are
  // aliases* of the unit that prints them — the only route open to it.
  // `speed:mps` and `energy:kwh` re-read their compound symbols the other way,
  // as arithmetic over their operand kinds, and that needs a registered
  // signature: `datarate ÷ duration` does not exist and should not, since
  // dividing a rate by a time is not a rate. So if a later edit restores the
  // orthographically correct "ميغابت/ث", this fails first and names the cause.
  test("every symbol is an alias of the unit that prints it", () => {
    for (const [unit, words] of Object.entries(datarateAr.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol);
    }
  });

  test("an engine built from it reads and writes Arabic datarate", () => {
    // Arabic in, Arabic out, with a space between number and symbol — Arabic's
    // `renderQuantity` sets a symbol off from the number where the default
    // template sets it tight, so this reads "100 ميغابت" and not "100ميغابت".
    expect(engine.evaluate("100 ميغابت").formatted).toBe("100 ميغابت");
    // The fractional case. Arabic's decimal mark is "." and its group separator
    // is "," — the `latn` numbering system, transcribed in
    // `@smartput/core/locale/ar` rather than read from `Intl`, because this
    // engine can only emit Latin digits and pairing them with the Arabic-Indic
    // separators would print the hybrid "1٬234٫5" that nobody writes.
    expect(engine.evaluate("1.5 ميغابت").formatted).toBe("1.5 ميغابت");
    // A sum that lands on a fraction. Here it can only move the number, because
    // there is no word to agree with it — the visible consequence of declaring
    // no forms.
    expect(engine.evaluate("1 غيغابت + 500 ميغابت").formatted).toBe("1.5 غيغابت");
    // A conversion, written with الى — the hamza-less spelling of إلى that most
    // Arabic keyboards produce, declared as its own keyword surface because
    // `buildKeywords` matches exact folded strings and never runs a keyword
    // through the orthographic fold.
    expect(engine.evaluate("2 غيغابت الى ميغابت").formatted).toBe("2,000 ميغابت");
    // Latin in, Arabic out: an `ar` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts` before the Arabic
    // spellings are appended to it.
    expect(engine.evaluate("5 mbps").formatted).toBe("5 ميغابت");
  });

  test("the inflections are read even though none is printed", () => {
    // The dual, the sound plural and the tamyīz all reach the same unit, and all
    // three come back as the one symbol. This is the many-to-one shape of
    // recognition: the vocabulary understands four spellings of the noun and
    // generates one.
    expect(engine.evaluate("2 ميغابتان").formatted).toBe("2 ميغابت");
    expect(engine.evaluate("3 بتات").formatted).toBe("3 بت");
    expect(engine.evaluate("11 ميغابتًا").formatted).toBe("11 ميغابت");
    // The tamyīz with the tanwīn left unwritten, which is how it is typed nine
    // times out of ten.
    expect(engine.evaluate("11 ميغابتا").formatted).toBe("11 ميغابت");
    // The jīm spelling of the foreign /g/, which Egypt and the Levant write
    // where the Gulf writes ghayn.
    expect(engine.evaluate("4 جيجابت").formatted).toBe("4 غيغابت");
  });

  test("the output is logically ordered, with Latin digits, and nothing invisible in it", () => {
    const printed = engine.evaluate("100 ميغابت").formatted;
    // **Right-to-left is a display property, not a string property.** The number
    // comes first in memory here exactly as it does in "100 mbps"; the bidi
    // algorithm in the terminal or the browser is what draws it on the right. A
    // "fix" that reversed the parts would emit the label first in logical order,
    // which `parse` reads as a unit followed by a number.
    expect(printed.indexOf("100")).toBeLessThan(printed.indexOf("ميغابت"));
    // And nothing invisible travels in it. Bidi marks and isolates (U+200E,
    // U+200F, U+2066–U+2069) would survive `normalize()`, which strips only the
    // zero-width family, and reach the lexer.
    expect(printed).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    // Latin digits, because that is the only kind this engine can emit:
    // `formatNumber` builds from `Decimal.toFixed()`, which is ASCII.
    expect(printed).toMatch(/^[0-9.,]+ /);
  });

  test("Arabic-Indic digits are a core-level gap, not one a vocabulary can close", () => {
    // `lex`'s `isDigit` is a `"0"…"9"` range check, so ٥ is neither a digit nor
    // a letter and falls through the "unrecognized character: skip it" branch.
    // What reaches the parser is a bare unit word, which reads as one of it. The
    // wrong answer is pinned rather than described, so that the day core grows a
    // digit-folding seam in `normalize()` this test fails and names the fix.
    expect(engine.evaluate("٥ ميغابت").formatted).toBe("1 ميغابت");
  });

  test("round-trips its own output", () => {
    // Including the grouped conversion, whose "," is Arabic's group separator
    // under the `latn` numbering system this locale pins. It is the one input an
    // Arabic engine is guaranteed to be handed: its own output.
    for (const input of [
      "100 ميغابت",
      "1.5 ميغابت",
      "1 غيغابت + 500 ميغابت",
      "2 غيغابت الى ميغابت",
      "5 mbps",
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
