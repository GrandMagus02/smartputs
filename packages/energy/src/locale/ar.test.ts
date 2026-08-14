import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "@smartput/duration";
import durationAr from "@smartput/duration/locale/ar";
import { power } from "@smartput/power";
import powerAr from "@smartput/power/locale/ar";
import { energy } from "../index";
import energyAr from "./ar";

const engine = createEngine({
  locales: [composeLocale(arabic, [energyAr])],
  kinds: [energy],
});

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (
  unit: string,
  count?: number,
  slot: "after-number" | "conversion-target" = "after-number",
) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "energy",
    unit,
    slot,
  });

/** What this unit would print at this count — the table entry, not the rendering. */
const word = (unit: string, count?: number) =>
  energyAr.units[unit]?.forms?.[key(unit, count)];

/**
 * Exactly the six CLDR categories `arabic.selectForm` can return, sorted. Not
 * eight and not two: one axis, because the case a preposition governs in Arabic
 * is a short vowel nobody writes, and the one written case ending is already
 * carried by `many`.
 */
const SIX_KEYS = ["few", "many", "one", "other", "two", "zero"];

describe("energy ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyAr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, unit ids, magnitude bands and four bridge signatures naming
  // their operand kinds by string, so no script but ASCII may reach it.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(energy)).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("five units carry exactly the six keys, and four carry none", () => {
    // Six keys is exactly what `arabic.selectForm` can produce and therefore
    // exactly what may be indexed: a seventh would never be read, and a missing
    // sixth renders a wrong word rather than throwing.
    for (const unit of ["j", "kj", "mj", "cal", "kcal"]) {
      expect(Object.keys(energyAr.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        SIX_KEYS,
      );
    }
    // The watt-hour family is a compound in Arabic exactly as in English —
    // "كيلوواط ساعة", two words, and a space ends a word token — so there is no
    // single token to put in a table. BTU is three words ("وحدة حرارية
    // بريطانية") abbreviated with dots the lexer skips, so it has no Arabic word
    // at all and keeps the Latin symbol.
    for (const unit of ["wh", "kwh", "mwh", "btu"]) {
      expect(energyAr.units[unit]?.forms, unit).toBeUndefined();
    }
    expect(energyAr.units.btu?.symbol).toBe("btu");
    expect(energyAr.units.btu?.aliases.join("")).not.toMatch(/\p{Script=Arabic}/u);
  });

  test("the six keys are the six CLDR categories, on one axis", () => {
    expect([0, 1, 2, 5, 11, 100, 1.5].map((n) => key("j", n))).toEqual([
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
    expect(key("j", 103)).toBe("few");
    expect(key("j", 111)).toBe("many");
    // One axis. Ukrainian and Russian answer differently for a conversion target
    // because a preposition governs a case there; Arabic's case marking on these
    // nouns is a short vowel that is not written, so the slot is inert.
    expect(key("j", 5, "conversion-target")).toBe(key("j", 5, "after-number"));
    // Ruling R5: a target has no magnitude, and Arabic's generic category is the
    // genitive singular — the opposite of French, where it is plural.
    expect(key("j")).toBe("other");
    expect(word("j")).toBe("جول");
  });

  test("gender decides how many of the six rows differ", () => {
    // **Masculine, borrowed.** جول takes the productive endings: a suffixed dual,
    // a sound plural, and a tamyīz whose alif makes it visibly different from
    // the singular. Three distinct strings across six rows.
    expect(word("j", 1)).toBe("جول");
    expect(word("j", 2)).toBe("جولان");
    expect(word("j", 5)).toBe("جولات");
    expect(word("j", 11)).toBe("جولًا");
    // The fractional row, which is where a table ported by renaming English
    // columns prints a plural at a user. It is the genitive singular.
    expect(word("kj", 1.5)).toBe("كيلوجول");
    // **Feminine.** سعرة ends in tāʾ marbūṭa, so its tanwīn is a bare mark with
    // no alif under it and the `many` row is spelled exactly like the singular:
    // five of its six rows are one string, and only the dual stands apart — and
    // that dual *replaces* the ة rather than following it, which is why no
    // suffix strip could ever have produced it.
    expect(word("cal", 1)).toBe("سعرة");
    expect(word("cal", 2)).toBe("سعرتان");
    expect(word("cal", 5)).toBe("سعرات");
    expect(word("cal", 11)).toBe("سعرة");
    expect(word("cal", 1.5)).toBe("سعرة");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias can still round-trip, because `arabic`'s suffix
  // stripper recovers it — at `weight: -2`. So nothing fails while the
  // vocabulary quietly relies on a guess for a word it had itself chosen to
  // print. The feminine duals are exactly the forms the stripper could never
  // have produced, because they replace a letter rather than append to one.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(energyAr.units)) {
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
      assertLocaleContract(composeLocale(arabic, [energyAr]), [energy]),
    ).not.toThrow();
    // The default counts are all integers. They do reach five of Arabic's six
    // categories, but they never reach `other` through a fraction — and a
    // fraction is the case this table is likeliest to get wrong, because CLDR
    // calls that category "other" and Arabic fills it with a singular.
    expect(() =>
      assertLocaleContract(composeLocale(arabic, [energyAr]), [energy], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic energy", () => {
    // The category boundary, on the noun this kind is canonical in.
    expect(engine.evaluate("2 كيلوجول").formatted).toBe("2 كيلوجولان");
    expect(engine.evaluate("5 كيلوجول").formatted).toBe("5 كيلوجولات");
    expect(engine.evaluate("11 جول").formatted).toBe("11 جولًا");
    // The fractional row, reached both by typing it and by a sum — which is how
    // a user gets there without meaning to. `other` is the genitive singular, so
    // this reads "1.5 كيلوجول"; "1.5 كيلوجولات" is the mistake six rows prevent.
    expect(engine.evaluate("1.5 كيلوجول").formatted).toBe("1.5 كيلوجول");
    expect(engine.evaluate("1 كيلوجول + 500 جول").formatted).toBe("1.5 كيلوجول");
    // A conversion, written with في — the preposition Arabic states one with —
    // and the "," group separator the `latn` numbering system gives.
    expect(engine.evaluate("1 كيلوجول في جول").formatted).toBe("1,000 جول");
    // The feminine noun, where four of six rows coincide and only the dual and
    // the plural stand apart.
    expect(engine.evaluate("2 سعرة").formatted).toBe("2 سعرتان");
    expect(engine.evaluate("5 سعرات").formatted).toBe("5 سعرات");
    // BTU prints the Latin initialism, because Arabic has no one-token spelling
    // of it — the same call Ukrainian makes and the opposite of Russian's, which
    // has a settled "БТЕ" to print.
    expect(engine.evaluate("2 btu").formatted).toBe("2 btu");
    // The jīm spelling of the foreign /g/, which Egypt and the Levant write
    // where the Gulf writes ghayn. Read, never printed.
    expect(engine.evaluate("2 ميجاجول").formatted).toBe("2 ميغاجولان");
  });

  test("the watt-hour symbol prints, and is a product where its operands exist", () => {
    // "كيلوواط·ساعة" is the correct Arabic symbol, and `parse/lex.ts` builds a
    // unit word out of letters plus trailing digits, so the interpunct ends the
    // token and the printed symbol reaches the resolver as "كيلوواط" and "ساعة"
    // — never as one alias, however many times the alias is listed. What sits
    // between them is U+00B7, which `lex` reads as `*`, so the symbol is an
    // expression and this kind's own `* | power | duration` signature turns
    // kilowatts times hours into joules. The same route "m/s" takes in English.
    //
    // Which means the two operands have to be *registered*, and the engine here
    // is deliberately this kind alone — the point of a per-package locale test
    // is that the vocabulary is checked without the rest of the repo propping it
    // up. So the symbol fails to read here for a stated reason ("كيلوواط" is no
    // unit of any registered kind) rather than for want of an operator.
    expect(engine.evaluate("2 kwh").formatted).toBe("2 كيلوواط·ساعة");
    expect(() => engine.evaluate("2 كيلوواط·ساعة")).toThrow(/كيلوواط/);
  });

  test("wired to power and duration, the printed symbol reads back as a product", () => {
    // The other half of the paragraph above, and the reason this package's `ar`
    // vocabulary can be shipped beside `@smartput/power`'s and
    // `@smartput/duration`'s rather than only with them: all three are Arabic,
    // all three name their kind by id string, and `composeLocale` is where they
    // meet. "ساعة" is duration's Arabic word for the hour and "كيلوواط" is
    // power's for the kilowatt, so the product is spelled entirely out of words
    // those two vocabularies already declare.
    const wired = createEngine({
      locales: [composeLocale(arabic, [energyAr, powerAr, durationAr])],
      kinds: [energy, power, duration],
    });
    // 5 kW for an hour: 5000 W × 3600 s, in canonical joules.
    const product = wired.evaluate("5 كيلوواط·ساعة");
    expect(product.value?.kind).toBe("energy");
    expect(product.value?.canonical.toFixed()).toBe("18000000");
    // And it converts like any other energy, into a unit that does decline. 7.2
    // is a fraction, so the target lands on `other` — the genitive singular.
    expect(wired.evaluate("2 كيلوواط·ساعة الى ميغاجول").formatted).toBe("7.2 ميغاجول");
  });

  test("the output is logically ordered, with Latin digits, and nothing invisible in it", () => {
    const printed = engine.evaluate("2 كيلوجول").formatted;
    // **Right-to-left is a display property, not a string property.** The number
    // comes first in memory here exactly as it does in "2 kilojoules"; the bidi
    // algorithm in the terminal or the browser is what draws it on the right. A
    // "fix" that reversed the parts would emit the label first in logical order,
    // which `parse` reads as a unit followed by a number.
    expect(printed.indexOf("2")).toBeLessThan(printed.indexOf("كيلوجولان"));
    // And nothing invisible travels in it. Bidi marks and isolates (U+200E,
    // U+200F, U+2066–U+2069) would survive `normalize()`, which strips only the
    // zero-width family, and reach the lexer.
    expect(printed).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    // Latin digits with "," grouping and "." for the decimal: the `latn`
    // numbering system, transcribed in `@smartput/core/locale/ar` rather than
    // read from `Intl`, because this engine can only emit Latin digits and
    // pairing them with the Arabic-Indic separators would print "1٬234٫5".
    expect(engine.evaluate("1234.5 جول").formatted).toBe("1,234.5 جول");
  });

  test("Arabic-Indic digits are a core-level gap, not one a vocabulary can close", () => {
    // `lex`'s `isDigit` is a `"0"…"9"` range check, so ٥ is neither a digit nor
    // a letter and falls through the "unrecognized character: skip it" branch.
    // What reaches the parser is a bare unit word, which reads as one of it. The
    // wrong answer is pinned rather than described, so that the day core grows a
    // digit-folding seam in `normalize()` this test fails and names the fix.
    expect(engine.evaluate("٥ جول").formatted).toBe("1 جول");
  });

  test("round-trips its own output", () => {
    // Every category the printed noun differs in is here, plus the two units
    // that print no noun at all. The watt-hour symbols are deliberately absent:
    // they re-read as arithmetic over kinds this engine does not register, which
    // the wired test above covers instead.
    for (const input of [
      "2 كيلوجول",
      "5 كيلوجول",
      "11 جول",
      "1.5 كيلوجول",
      "1 كيلوجول + 500 جول",
      "1 كيلوجول في جول",
      "5 سعرات",
      "2 btu",
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
