import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberAr from "@smartput/number/locale/ar";
import { percent } from "../index";
import percentAr from "./ar";

const locale = composeLocale(arabic, [percentAr]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/** Arabic and Arabic Supplement, which is every letter this phase can write. */
const ARABIC = /[؀-ۿݐ-ݿ]/;

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (slot: "after-number" | "conversion-target", count?: number) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "percent",
    unit: "%",
    slot,
  });

describe("percent ar vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentAr.units).sort()).toEqual(units.sort());
    expect(percentAr.locale).toBe("ar");
    expect(percentAr.kind).toBe("percent");
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is one ratio and one unit id, so no script but ASCII may reach it. Arabic
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(percent)).not.toMatch(ARABIC);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so the micro path (`parsePercent`) and the engine path cannot drift.
  test("the Latin aliases are reused, and the Arabic ones appended", () => {
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(percentAr.units["%"]?.aliases, latin).toContain(latin);
    }
    expect(percentAr.units["%"]?.aliases).toContain("بالمئة");
    // Both orthographies of the same word: مائة writes an alif that is not
    // pronounced, and a reader has no way to know which one a keyboard produced.
    // The same pairing `ar-cardinals.ts` makes for the numeral 100.
    expect(percentAr.units["%"]?.aliases).toContain("بالمائة");
  });

  // No `forms`, and for two reasons rather than `en`'s one. `en`'s applies: the
  // written form of this unit is the symbol. Arabic adds its own — بالمئة is a
  // frozen prepositional phrase (بـ + الـ + مئة), not a noun, so it takes no dual,
  // no plural and no tamyīz and does not move across a single one of the six
  // categories. A table here would be six copies of one string.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentAr.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  // `selectForm` answers all the same — it is a function of the count and the slot
  // and knows nothing about which units carry tables — so what makes the
  // six-category grammar unreachable here is the missing `forms`, not a missing
  // key. The rows named are the six Arabic cells this unit would have owed, and
  // the point is that all six would have held بالمئة.
  test("selectForm produces six keys this kind has no table to index", () => {
    expect(key("after-number", 0)).toBe("zero");
    expect(key("after-number", 1)).toBe("one");
    // The dual, which no other language in this repo has.
    expect(key("after-number", 2)).toBe("two");
    expect(key("after-number", 5)).toBe("few");
    // Not a plural: the accusative singular with tanwīn, the tamyīz.
    expect(key("after-number", 11)).toBe("many");
    // Decided by n mod 100, which is why 103 goes back to `few`.
    expect(key("after-number", 103)).toBe("few");
    expect(key("after-number", 111)).toBe("many");
    // The fractional row, where Arabic writes a genitive SINGULAR.
    expect(key("after-number", 1.5)).toBe("other");
    // Ruling R5: a conversion target has no count. The slot is inert in Arabic —
    // the case a preposition governs is a short vowel Arabic does not write — so
    // it names the same key the count alone would.
    expect(key("conversion-target")).toBe("other");
    expect(key("conversion-target", 2)).toBe("two");
    expect(percentAr.units["%"]?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* — the row Arabic
    // spells as a genitive singular where French spells it plural. A fractional
    // count is added for the same reason every other `ar` vocabulary adds one,
    // except that here it can only confirm the absence of a `forms` table, since a
    // unit with none is skipped before any key is asked for. The alias half is
    // what carries this kind.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic percentages", () => {
    const e = engine();
    // The one-token spelling, which is the one that says "20 percent" and means
    // it. Note the space before the symbol: `arabic.renderQuantity` sets a symbol
    // off from the number the way SI typography does in Arabic (٥ كغ, never ٥كغ),
    // so a percentage prints "20 %" where English prints "20%". That is the
    // language's decision, it round-trips, and the exact string is pinned here so
    // nobody has to guess whether the space was intended.
    expect(e.evaluate("20 بالمئة").formatted).toBe("20 %");
    expect(e.evaluate("20 بالمائة").formatted).toBe("20 %");
    expect(e.evaluate("20 بالمية").formatted).toBe("20 %");
    // A sum that lands on a fraction — CLDR's `other` row, reached from below
    // rather than from above. The output does not move, which is the point of a
    // symbol-only unit: none of the six categories has a word to select.
    expect(e.evaluate("1.5 بالمئة").formatted).toBe("1.5 %");
    expect(e.evaluate("1 بالمئة زائد 0.5 بالمئة").formatted).toBe("1.5 %");
    // The dual (2) and the tamyīz (11), which in a sibling kind are two different
    // Arabic words and here are the same symbol.
    expect(e.evaluate("2 بالمئة").formatted).toBe("2 %");
    expect(e.evaluate("11 بالمئة").formatted).toBe("11 %");
    // Grouped output, with the "," this language transcribes rather than reading
    // from CLDR — and unlike Russian's U+00A0 it survives `normalize()`, so it
    // reads back (see the round-trip below).
    expect(e.evaluate("2000 بالمئة").formatted).toBe("2,000 %");
    // Both scripts read: an Arabic engine still takes the Latin aliases the one
    // alias map in `units.ts` declares. Recognition is many-to-one, generation is
    // one (design decision I6).
    expect(e.evaluate("50 pct").formatted).toBe("50 %");
    expect(e.evaluate("20%").formatted).toBe("20 %");
    // The `of` operator through its Arabic keyword. من is "of"/"from" and it is
    // the word a percentage is stated with; `off` is left unclaimed entirely,
    // because Arabic states a discount as خصم ٢٠٪ من ٥٠ — a noun plus the same
    // preposition.
    expect(e.evaluate("20 بالمئة من 50").formatted).toBe("10");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion
  // it can be the target of comes from outside the kind.
  test("reads a conversion into percent, through both Arabic prepositions", () => {
    const e = createEngine({
      locales: [composeLocale(arabic, [percentAr, numberAr])],
      kinds: [percent, number],
    });
    // إلى is "to" and في is "in"; `@smartput/core/locale/ar` lists both under one
    // keyword, so both have to reach the unit or the sentence an Arabic speaker
    // writes stops parsing when they pick the other preposition.
    expect(e.evaluate("5 / 50 إلى بالمئة").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 في المئة").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 إلى %").formatted).toBe("10 %");
  });

  // The Arabic-specific hazard, recorded rather than left to be rediscovered.
  // "٢٠ في المئة" is standard written Arabic for "20 percent" — and في is core's
  // `in` keyword in this language, so those three tokens are the *conversion* "20
  // in percent", which really is 2,000 %. Declining the المئة alias would not
  // change the answer: the resolver reaches the unit through a fuzzy correction to
  // بالمئة at one edit's penalty. The one-token spelling is the one that means
  // what the writer meant, and the difference between the two is asserted here.
  test('"في المئة" reads as a conversion, not as a percentage', () => {
    const e = engine();
    expect(e.evaluate("20 في المئة").formatted).toBe("2,000 %");
    expect(e.evaluate("20 بالمئة").formatted).toBe("20 %");
  });

  // ٪ is the sign Arabic typography actually sets, and it is deliberately not an
  // alias: `parse/lex.ts` skips it as an unrecognized character, so an alias
  // carrying it could never be produced. What is worth pinning is that the input
  // does not throw — it silently loses the unit — which is the whole reason the
  // absence is argued in prose next door instead of left as a gap.
  test("the Arabic percent sign is dropped by the lexer, not read", () => {
    const e = engine();
    expect(percentAr.units["%"]?.aliases).not.toContain("٪");
    expect(e.evaluate("20٪").value?.kind).toBe("number");
    expect(e.evaluate("20٪").formatted).toBe("20");
    // And with nothing but the sign there is nothing left to parse at all.
    expect(() => e.evaluate("٪")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Including the grouped case, which Russian's row cannot do: `ru` groups with
    // U+00A0, `normalize()` folds it to a plain space, and "2 000%" comes back as
    // two numbers. Arabic groups with "," — transcribed in `arabic.numberFormat`
    // rather than read from CLDR — and "2,000 %" reads back whole.
    for (const input of [
      "20 بالمئة",
      "1.5 بالمئة",
      "2 بالمئة",
      "11 بالمئة",
      "2000 بالمئة",
      "50 pct",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  // Right-to-left, asserted so a later reader does not "fix" it. The rendered
  // string is in *logical* order — the number first, the label second — and the
  // Unicode Bidirectional Algorithm is what puts the number on the right at
  // display time. Reversing the parts here would emit a unit followed by a number,
  // which `parse` cannot read back, and bidi isolates (U+2066–2069) are invisible
  // characters `normalize()` does not strip, so they would travel into the lexer.
  test("the rendered quantity is logically ordered and carries no bidi controls", () => {
    const formatted = engine().evaluate("20 بالمئة").formatted;
    expect(formatted).toBe("20 %");
    expect(formatted.indexOf("20")).toBeLessThan(formatted.indexOf("%"));
    expect(formatted).not.toMatch(/[‎‏⁦-⁩]/);
  });
});
