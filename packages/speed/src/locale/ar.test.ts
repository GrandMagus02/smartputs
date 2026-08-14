import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { speed } from "../index";
import speedAr from "./ar";

const engine = createEngine({
  locales: [composeLocale(arabic, [speedAr])],
  kinds: [speed],
});

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (
  unit: string,
  count?: number,
  slot: "after-number" | "conversion-target" = "after-number",
) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "speed",
    unit,
    slot,
  });

/** What this unit would print at this count — the table entry, not the rendering. */
const word = (unit: string, count?: number) =>
  speedAr.units[unit]?.forms?.[key(unit, count)];

/**
 * Exactly the six CLDR categories `arabic.selectForm` can return, sorted. Not
 * eight and not two: one axis, because the case a preposition governs in Arabic
 * is a short vowel nobody writes, and the one written case ending is already
 * carried by `many`.
 */
const SIX_KEYS = ["few", "many", "one", "other", "two", "zero"];

describe("speed ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids, magnitude bands and one bridge signature naming
  // its operand kinds by string, so no script but ASCII may reach it.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(speed)).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("only `knot` declares written forms", () => {
    // The decision `en.ts` records, restated for the language that would need
    // six keys rather than two. Arabic writes a speed as "كيلومتر في الساعة",
    // and the middle word is `arabic`'s `in` keyword — so the spelled-out name
    // does not merely fail to lex as one unit token, it lexes as a *conversion*.
    // The abbreviated forms carry "/", which is always division. Either way
    // there is no single Arabic token to put in a table.
    expect(speedAr.units.mps?.forms).toBeUndefined();
    expect(speedAr.units.kph?.forms).toBeUndefined();
    expect(speedAr.units.mph?.forms).toBeUndefined();
    expect(Object.keys(speedAr.units.knot?.forms ?? {}).sort()).toEqual(SIX_KEYS);
  });

  test("the three compounds leave the Arabic head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming كيلومتر for `kph` here would give "5 كيلومتر" a second reading
    // in any engine where `@smartput/length` is also installed — a length and a
    // speed, told apart by nothing. The kind's own `length ÷ duration` bridge is
    // what Arabic gets instead, and it needs no alias of this kind's at all.
    // Symbols may name them, because a symbol is printed and never indexed.
    for (const unit of ["mps", "kph", "mph"] as const) {
      for (const alias of speedAr.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims an Arabic head noun`).not.toMatch(
          /\p{Script=Arabic}/u,
        );
      }
    }
    expect(speedAr.units.knot?.aliases).toContain("عقدة");
  });

  test("the six keys are the six CLDR categories, on one axis", () => {
    expect([0, 1, 2, 5, 11, 100, 1.5].map((n) => key("knot", n))).toEqual([
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
    expect(key("knot", 103)).toBe("few");
    expect(key("knot", 111)).toBe("many");
    // One axis. Ukrainian and Russian answer differently for a conversion target
    // because a preposition governs a case there; Arabic's case marking on this
    // noun is a short vowel that is not written, so the slot is inert.
    expect(key("knot", 5, "conversion-target")).toBe(key("knot", 5, "after-number"));
    // Ruling R5: a target has no magnitude, and Arabic's generic category is the
    // genitive singular — the opposite of French, where it is plural.
    expect(key("knot")).toBe("other");
    expect(word("knot")).toBe("عقدة");
  });

  test("`knot` is feminine, so five of its six rows are one string", () => {
    // عقدة ends in tāʾ marbūṭa, so its tanwīn is a bare mark with no alif under
    // it and the `many` row is spelled exactly like the singular. Only the dual
    // and the plural stand apart — and both are forms no analyzer could have
    // derived: the dual *replaces* the ة rather than following it, and عقد is a
    // broken plural, the stem re-arranged.
    expect(word("knot", 0)).toBe("عقدة");
    expect(word("knot", 1)).toBe("عقدة");
    expect(word("knot", 2)).toBe("عقدتان");
    expect(word("knot", 5)).toBe("عقد");
    expect(word("knot", 11)).toBe("عقدة");
    // The fractional row, which is where a table ported by renaming English
    // columns prints a plural at a user. It is the genitive singular.
    expect(word("knot", 1.5)).toBe("عقدة");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias can still round-trip, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. So nothing fails while the
  // vocabulary quietly relies on a guess for a word it had itself chosen to
  // print. Neither عقدتان nor عقد is reachable that way.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(speedAr.units)) {
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
      assertLocaleContract(composeLocale(arabic, [speedAr]), [speed]),
    ).not.toThrow();
    // The default counts are all integers. They do reach five of Arabic's six
    // categories, but they never reach `other` through a fraction — and a
    // fraction is the case this table is likeliest to get wrong, because CLDR
    // calls that category "other" and Arabic fills it with a singular.
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [speedAr]), [speed], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic speed", () => {
    // The category boundary, on the one unit here whose output moves across it.
    expect(engine.evaluate("1 عقدة").formatted).toBe("1 عقدة");
    expect(engine.evaluate("2 عقدة").formatted).toBe("2 عقدتان");
    expect(engine.evaluate("5 عقد").formatted).toBe("5 عقد");
    expect(engine.evaluate("11 عقدة").formatted).toBe("11 عقدة");
    // The fraction, reached both by typing it and by a sum — which is how a user
    // gets there without meaning to. `other` is the genitive singular.
    expect(engine.evaluate("1.5 عقدة").formatted).toBe("1.5 عقدة");
    expect(engine.evaluate("1 عقدة + 0.5 عقدة").formatted).toBe("1.5 عقدة");
    // A conversion, written with الى — the hamza-less spelling of إلى that most
    // Arabic keyboards produce — out into the compound symbol, whose slash is
    // the division `parse/lex.ts` reads it as.
    expect(engine.evaluate("10 عقد الى kph").formatted).toBe("18.52 كم/س");
    // And back the other way, into the one unit that prints as a word.
    expect(engine.evaluate("37.04 kph الى عقدة").formatted).toBe("20 عقدة");
    // Latin in, Arabic out: an `ar` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts`.
    expect(engine.evaluate("3 mps").formatted).toBe("3 م/ث");
    expect(engine.evaluate("1 kmh").formatted).toBe("1 كم/س");
    expect(engine.evaluate("60 mph").formatted).toBe("60 ميل/س");
    // Grouping comes from the `latn` numbering system pinned in
    // `@smartput/core/locale/ar`: "," for thousands and "." for the decimal.
    expect(engine.evaluate("2000 kph").formatted).toBe("2,000 كم/س");
  });

  test("the output is logically ordered, with Latin digits, and nothing invisible in it", () => {
    // The compound symbol is the interesting case, not the word: "2,000 كم/س"
    // mixes a Latin number, an Arabic numerator, an ASCII slash and an Arabic
    // denominator, and the bidi algorithm re-orders all four at display time.
    // **None of that is a string property.** In memory the number comes first
    // and the slash sits between كم and س, whichever way the line is drawn, and
    // that is exactly what makes it re-readable as `length ÷ duration`.
    const printed = engine.evaluate("2000 kph").formatted;
    expect(printed).toBe("2,000 كم/س");
    expect(printed.indexOf("2,000")).toBeLessThan(printed.indexOf("كم"));
    expect(printed.indexOf("كم")).toBeLessThan(printed.indexOf("/"));
    // And nothing invisible travels in it. Bidi marks and isolates (U+200E,
    // U+200F, U+2066–U+2069) would survive `normalize()`, which strips only the
    // zero-width family, and reach the lexer.
    expect(printed).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    expect(engine.evaluate("1234.5 عقدة").formatted).toBe("1,234.5 عقدة");
  });

  test("Arabic-Indic digits are a core-level gap, not one a vocabulary can close", () => {
    // `lex`'s `isDigit` is a `"0"…"9"` range check, so ٥ is neither a digit nor
    // a letter and falls through the "unrecognized character: skip it" branch.
    // What reaches the parser is a bare unit word, which reads as one of it. The
    // wrong answer is pinned rather than described, so that the day core grows a
    // digit-folding seam in `normalize()` this test fails and names the fix.
    expect(engine.evaluate("٥ عقد").formatted).toBe("1 عقدة");
  });

  test("its own output reads back to the same value", () => {
    // `knot` only. The other three print on a symbol carrying "/", which is an
    // operator character the lexer will not take back inside a unit word — the
    // same fact `units.ts` gives for refusing byte-per-second units in
    // `@smartput/datarate`. Their route back is the kind's `length ÷ duration`
    // bridge, which needs `@smartput/length`'s Arabic vocabulary installed
    // beside this one and therefore belongs to the barrel's own locale test
    // rather than to a per-package one.
    for (const input of [
      "1 عقدة",
      "2 عقدة",
      "5 عقد",
      "11 عقدة",
      "1.5 عقدة",
      "37.04 kph الى عقدة",
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
