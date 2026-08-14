import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoAr from "./ar";

const engine = createEngine({
  locales: [composeLocale(arabic, [tempoAr])],
  kinds: [tempo],
});

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (
  unit: string,
  count?: number,
  slot: "after-number" | "conversion-target" = "after-number",
) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "tempo",
    unit,
    slot,
  });

/** What this unit would print at this count — the table entry, not the rendering. */
const word = (unit: string, count?: number) =>
  tempoAr.units[unit]?.forms?.[key(unit, count)];

/**
 * Exactly the six CLDR categories `arabic.selectForm` can return, sorted. Not
 * eight and not two: one axis, because the case a preposition governs in Arabic
 * is a short vowel nobody writes, and the one written case ending is already
 * carried by `many`.
 */
const SIX_KEYS = ["few", "many", "one", "other", "two", "zero"];

describe("tempo ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is two ratios, two unit ids, magnitude bands and a reciprocal bridge
  // naming its operand kinds by string, so no script but ASCII may reach it.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("`hz` carries exactly the six keys and `bpm` carries none", () => {
    // Arabic writes bpm as "نبضة في الدقيقة", and the middle word is `arabic`'s
    // `in` keyword — so the spelled-out name does not merely fail to lex as one
    // unit token, it lexes as a *conversion*. The abbreviated "ن/د" carries "/",
    // which is always division. There is no single Arabic token to put in a
    // table, so the bare noun ships as the symbol with the "في الدقيقة" elided —
    // the same trade `@smartput/datarate/locale/ru` makes with "Мбит".
    expect(tempoAr.units.bpm?.forms).toBeUndefined();
    expect(tempoAr.units.bpm?.symbol).toBe("نبضة");
    // هرتز is one token, so it declares all six. Six keys is exactly what
    // `arabic.selectForm` can produce and therefore exactly what may be indexed.
    expect(Object.keys(tempoAr.units.hz?.forms ?? {}).sort()).toEqual(SIX_KEYS);
  });

  test("the six keys are the six CLDR categories, on one axis", () => {
    expect([0, 1, 2, 5, 11, 100, 1.5].map((n) => key("hz", n))).toEqual([
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
    expect(key("hz", 103)).toBe("few");
    expect(key("hz", 111)).toBe("many");
    // One axis. Ukrainian and Russian answer differently for a conversion target
    // because a preposition governs a case there; Arabic's case marking on this
    // noun is a short vowel that is not written, so the slot is inert.
    expect(key("hz", 5, "conversion-target")).toBe(key("hz", 5, "after-number"));
    // Ruling R5: a target has no magnitude, and Arabic's generic category is the
    // genitive singular — the opposite of French, where it is plural.
    expect(key("hz")).toBe("other");
    expect(word("hz")).toBe("هرتز");
  });

  test("`hz` inflects where English leaves it invariant", () => {
    // `en.ts` spells both its categories "hertz", on the grounds that the word
    // is its own plural. Arabic inflects borrowed unit nouns productively —
    // كيلوغرام duals to كيلوغرامان in `@smartput/core/locale/ar`'s own worked
    // example — so leaving one borrowing invariant would be the inconsistency.
    expect(word("hz", 1)).toBe("هرتز");
    expect(word("hz", 2)).toBe("هرتزان");
    expect(word("hz", 5)).toBe("هرتزات");
    // The tamyīz: an accusative **singular** with tanwīn, not a plural. This is
    // the row a table ported by renaming English columns gets wrong.
    expect(word("hz", 11)).toBe("هرتزًا");
    // And the fractional row — the one a tempo actually reaches, since a
    // sub-hertz cycle is an ordinary thing to type. It is the genitive singular.
    expect(word("hz", 0.5)).toBe("هرتز");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias can still round-trip, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. So nothing fails while the
  // vocabulary quietly relies on a guess for a word it had itself chosen to
  // print. Asserting the containment keeps the two halves of a unit's entry —
  // what it writes and what it reads — in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(tempoAr.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
    // The same property for the one unit that prints no form at all: its symbol
    // is the only string it can emit, and it re-reads *because it is an alias*
    // of the unit that prints it — the only route open to a kind with no
    // arithmetic to fall back on.
    const symbol = tempoAr.units.bpm?.symbol as string;
    expect(symbol).not.toMatch(/[/*+\-·×⋅]/);
    expect(tempoAr.units.bpm?.aliases).toContain(symbol);
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [tempoAr]), [tempo]),
    ).not.toThrow();
    // The default counts are all integers. They do reach five of Arabic's six
    // categories, but they never reach `other` through a fraction — and a
    // fraction is the case this table is likeliest to get wrong, because CLDR
    // calls that category "other" and Arabic fills it with a singular. For this
    // kind it is also the commonest real input: a slow tempo is under one hertz.
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [tempoAr]), [tempo], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic tempo", () => {
    // The symbol-only unit: number, space, noun, with the "per minute" elided.
    expect(engine.evaluate("120 نبضة").formatted).toBe("120 نبضة");
    // The category boundary on the unit that does decline.
    expect(engine.evaluate("1 هرتز").formatted).toBe("1 هرتز");
    expect(engine.evaluate("2 هرتز").formatted).toBe("2 هرتزان");
    expect(engine.evaluate("5 هرتز").formatted).toBe("5 هرتزات");
    expect(engine.evaluate("11 هرتز").formatted).toBe("11 هرتزًا");
    // A sum landing on a fraction — the assertion that would read "1.5 هرتزات"
    // if `other` held a plural instead of the genitive singular it is.
    expect(engine.evaluate("1 هرتز + 0.5 هرتز").formatted).toBe("1.5 هرتز");
    // A conversion, written with في — the preposition Arabic states one with —
    // and the "," group separator the `latn` numbering system gives.
    expect(engine.evaluate("60 هرتز في نبضة").formatted).toBe("3,600 نبضة");
    // Latin in, Arabic out: an `ar` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts`.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 نبضة");
    // The dual and the plural are read as well as printed.
    expect(engine.evaluate("2 هرتزان").formatted).toBe("2 هرتزان");
    expect(engine.evaluate("2 نبضتان").formatted).toBe("2 نبضة");
  });

  test("the output is logically ordered, with Latin digits, and nothing invisible in it", () => {
    const printed = engine.evaluate("2 هرتز").formatted;
    // **Right-to-left is a display property, not a string property.** The number
    // comes first in memory here exactly as it does in "2 hertz"; the bidi
    // algorithm in the terminal or the browser is what draws it on the right. A
    // "fix" that reversed the parts would emit the label first in logical order,
    // which `parse` reads as a unit followed by a number.
    expect(printed.indexOf("2")).toBeLessThan(printed.indexOf("هرتزان"));
    // And nothing invisible travels in it. Bidi marks and isolates (U+200E,
    // U+200F, U+2066–U+2069) would survive `normalize()`, which strips only the
    // zero-width family, and reach the lexer.
    expect(printed).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    // Latin digits with "," grouping and "." for the decimal: the `latn`
    // numbering system, transcribed in `@smartput/core/locale/ar` rather than
    // read from `Intl`, because this engine can only emit Latin digits and
    // pairing them with the Arabic-Indic separators would print "1٬234٫5".
    expect(engine.evaluate("1234.5 نبضة").formatted).toBe("1,234.5 نبضة");
  });

  test("Arabic-Indic digits are a core-level gap, not one a vocabulary can close", () => {
    // `lex`'s `isDigit` is a `"0"…"9"` range check, so ٥ is neither a digit nor
    // a letter and falls through the "unrecognized character: skip it" branch.
    // What reaches the parser is a bare unit word, which reads as one of it. The
    // wrong answer is pinned rather than described, so that the day core grows a
    // digit-folding seam in `normalize()` this test fails and names the fix.
    expect(engine.evaluate("٥ هرتز").formatted).toBe("1 هرتز");
  });

  test("round-trips its own output", () => {
    for (const input of [
      "120 نبضة",
      "1 هرتز",
      "2 هرتز",
      "5 هرتز",
      "11 هرتز",
      "1 هرتز + 0.5 هرتز",
      "60 هرتز في نبضة",
      "120 bpm",
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
