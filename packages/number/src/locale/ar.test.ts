import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberAr from "./ar";

const locale = composeLocale(arabic, [numberAr]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/** Arabic and Arabic Supplement, which is every letter this phase can write. */
const ARABIC = /[؀-ۿݐ-ݿ]/;

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (slot: "after-number" | "conversion-target", count?: number) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "number",
    unit: "one",
    slot,
  });

describe("number ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberAr.units).sort()).toEqual(units.sort());
    expect(numberAr.locale).toBe("ar");
    expect(numberAr.kind).toBe("number");
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is a ratio and a unit id, so no script but ASCII may reach it. Arabic in
  // the descriptor would mean a translation had leaked into the half of the
  // package that is supposed to be language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(number)).not.toMatch(ARABIC);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so CLDR's `other` category is reached
    // only from above (100, 1000) and never through a *fraction* at all — and the
    // fractional row is exactly the one Arabic spells as a genitive singular
    // where French spells it plural. A fractional count is added for the same
    // reason every other `ar` vocabulary adds one, except that here it can only
    // confirm the absence of a `forms` table: a unit with none is skipped before
    // any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // The contract check above is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself. Arabic's `selectForm` would demand
  // all six of its CLDR keys the moment one appeared, the dual among them, and
  // inventing them for a unit nobody spells is the failure the file next door
  // argues against in prose. Assert it in code too, so a later edit has to face it.
  test("declares no forms, in either script", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test above
    // owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberAr.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
    }
    expect(JSON.stringify(numberAr)).not.toMatch(ARABIC);
  });

  // `selectForm` still answers for this unit — it is a function of the count and
  // the slot and knows nothing about which units have tables — so the reason the
  // six-category grammar is unexercised here is the missing `forms`, not a missing
  // key. Pinning the whole key set keeps the "no word moves" tests below honest:
  // they assert output does not change across four separate plural boundaries,
  // and this says why.
  test("selectForm produces six keys this kind has no table to index", () => {
    expect(key("after-number", 0)).toBe("zero");
    expect(key("after-number", 1)).toBe("one");
    // The dual, which no other language in this repo has.
    expect(key("after-number", 2)).toBe("two");
    expect(key("after-number", 5)).toBe("few");
    // Not a plural: the accusative singular with tanwīn, the tamyīz.
    expect(key("after-number", 11)).toBe("many");
    expect(key("after-number", 21)).toBe("many");
    expect(key("after-number", 100)).toBe("other");
    // The category is decided by n mod 100, which is why 103 goes back to `few`
    // and 111 to `many` — a rule no `one`/`other` model can express.
    expect(key("after-number", 103)).toBe("few");
    expect(key("after-number", 111)).toBe("many");
    // The fractional row, where Arabic writes a genitive SINGULAR.
    expect(key("after-number", 1.5)).toBe("other");
    // Ruling R5: a conversion target has no count, and the category CLDR requires
    // every locale to define as its generic one answers for it. The slot is inert
    // in Arabic — see `ar.ts`'s `selectForm` — so it names the same key here.
    expect(key("conversion-target")).toBe("other");
    expect(key("conversion-target", 2)).toBe("two");
    expect(numberAr.units.one?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Arabic numbers", () => {
    // The `latn` numbering system, transcribed into `arabic.numberFormat` rather
    // than read from `Intl`: "." marks the decimal and "," groups the thousands,
    // which is what an Arabic speaker on a Latin keyboard types and what this
    // engine can emit.
    expect(engine.evaluate("1.5").formatted).toBe("1.5");
    expect(engine.evaluate("2000").formatted).toBe("2,000");
    // And grouped output reads back, unlike Russian's — `ru` groups with U+00A0,
    // which `normalize()` folds to a plain space and `lex` then cannot find inside
    // the digit run. "," survives both, so Arabic's grouping round-trips.
    expect(engine.evaluate("2,000").formatted).toBe("2,000");
    // Arabic cardinals in, Latin digits out. `arabicSpeller` and `arabic.numerals`
    // read the one set of tables in `ar-cardinals.ts`, which is what keeps
    // "خمسة وعشرون" the same 25 in both directions — units before tens, with the
    // conjunction و glued to the word that follows it rather than standing alone.
    expect(engine.evaluate("خمسة وعشرون زائد واحد").formatted).toBe("26");
    expect(engine.evaluate("مئة وخمسة ناقص عشرة").formatted).toBe("95");
    // ضرب and قسمة على, which are `times` and `over`+`by`: Arabic's own word for
    // multiplication is في, and it is claimed as `in` instead because conversion
    // has no second word and multiplication does.
    expect(engine.evaluate("ستة ضرب اثنان").formatted).toBe("12");
    expect(engine.evaluate("ستة قسمة على اثنان").formatted).toBe("3");
  });

  // Pinned here rather than only in core, because this is the kind where a number
  // is the whole value: an Arabic-Indic digit is neither a digit to `lex`'s
  // `"0"…"9"` range check nor a letter to `\p{L}`, so it falls through the
  // "unrecognized character: skip it" branch and there is nothing left to parse.
  // Closing it needs a digit-folding seam in `normalize()` or `lex`, which is
  // core's to add — a `Language` has no hook that sees a digit, and a `Vocabulary`
  // still less. Do not "fix" this by adding digits to `aliases`.
  test("Arabic-Indic digits are unreadable, and that is a core-level gap", () => {
    expect(() => engine.evaluate("٥")).toThrow();
    expect(() => engine.evaluate("٢٠٠٠")).toThrow();
    // The written-out cardinal is the way an Arabic reader reaches the same value
    // without a Latin keyboard, and it works.
    expect(engine.evaluate("خمسة").formatted).toBe("5");
  });

  // Right-to-left, asserted so that a later reader does not "fix" it. The string
  // is in logical order and the Unicode Bidirectional Algorithm is what puts the
  // digits on the right at display time; this kind prints digits alone, so its
  // output must be plain ASCII with no invisible direction marks in it.
  test("output carries no bidi controls and is not reversed", () => {
    const formatted = engine.evaluate("مئة وخمسة").formatted;
    expect(formatted).toBe("105");
    expect(formatted).not.toMatch(/[‎‏⁦-⁩]/);
  });

  // The plural boundary every sibling row turns into a different word. This kind
  // has one answer for all six categories, which is the whole of what it
  // contributes to the Arabic phase: nothing is appended after the numeral, so 2
  // (the dual) and 11 (the tamyīz) are byte-identical to their own digits.
  test("the six categories append no word, in either slot", () => {
    expect(engine.evaluate("2").formatted).toBe("2");
    expect(engine.evaluate("11").formatted).toBe("11");
    // A conversion, where a sibling vocabulary would be asked for the target's
    // word. Here the target word vanishes and the numeral is all that prints.
    expect(engine.evaluate("2 one إلى one").formatted).toBe("2");
    expect(engine.evaluate("11 one في one").formatted).toBe("11");
    expect(engine.evaluate("1.5 one إلى one").formatted).toBe("1.5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Arabic claims the
  // Latin word — `CARDINALS` is Arabic throughout — so here the self-alias is
  // live, which is the alias earning its keep, since `formatNumber` emits exactly
  // this string.
  test("the Latin self-alias is live under ar, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("round-trips its own output", () => {
    // Four inputs: a fractional, a grouped four-digit number (which Arabic can
    // round-trip and Russian cannot), a spelled cardinal, and the facade's own
    // `${raw}one` string.
    for (const input of ["1.5", "2000", "خمسة وعشرون زائد واحد", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
