import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberHi from "@smartput/number/locale/hi";
import { percent } from "../index";
import percentHi from "./hi";

const locale = composeLocale(hindi, [percentHi]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/** Devanagari, which is every letter this vocabulary writes. */
const DEVANAGARI = /\p{Script=Devanagari}/u;

/** The key `hindi` will index a unit's `forms` with, for this count and slot. */
const key = (slot: "bare" | "after-number" | "conversion-target", count?: number) =>
  hindi.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "percent",
    unit: "%",
    slot,
  });

describe("percent hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentHi.units).sort()).toEqual(units.sort());
    expect(percentHi.locale).toBe("hi");
    expect(percentHi.kind).toBe("percent");
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is one ratio and one unit id, so no script but ASCII may reach it. Devanagari
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Hindi word", () => {
    expect(JSON.stringify(percent)).not.toMatch(DEVANAGARI);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so the micro path (`parsePercent`) and the engine path cannot drift.
  test("the Latin aliases are reused, and the Hindi ones appended", () => {
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(percentHi.units["%"]?.aliases, latin).toContain(latin);
    }
    // The Sanskritic compound and the Perso-Arabic word, which are two layers of
    // the language naming one thing — and both are single tokens, unlike Arabic's
    // "في المئة", so neither can be mistaken for a conversion.
    expect(percentHi.units["%"]?.aliases).toContain("प्रतिशत");
    expect(percentHi.units["%"]?.aliases).toContain("फ़ीसदी");
    // Nukta-less, which no normalization will ever join to the nukta-bearing form
    // because ज़/फ़ and ज/फ are different letters.
    expect(percentHi.units["%"]?.aliases).toContain("फीसदी");
  });

  // The trap that would make a table test green and be unreachable through the
  // engine: फ़ (U+095E) is a Unicode composition *exclusion*, so NFKC — which
  // `normalize()` applies before a word reaches the resolver — decomposes it into
  // फ + U+093C. An alias written with the precomposed character would never be
  // matched by anything a user typed.
  test("every alias survives NFKC unchanged", () => {
    const aliases = percentHi.units["%"]?.aliases ?? [];
    expect(aliases.filter((a) => a.normalize("NFKC") !== a)).toEqual([]);
    // Written out, so the intent is not a coincidence of whatever editor saved
    // this file: the nukta is its own codepoint.
    expect(percentHi.units["%"]?.aliases).toContain("फ़ीसदी");
  });

  // No `forms`, and for `en`'s reason rather than a grammatical one: the written
  // form of this unit is the symbol. Hindi adds a second reason that costs nothing
  // to state — प्रतिशत is a consonant-final masculine noun whose direct plural is
  // the same word, so the two categories would hold one string twice.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentHi.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  // `selectForm` answers all the same — it is a function of the count and the slot
  // and knows nothing about which units carry tables — so what makes the two
  // categories unreachable here is the missing `forms`, not a missing key. The
  // boundary is the row worth pinning: Hindi's `one` is CLDR's `i = 0 or n = 1`,
  // so 0 and every fraction below 1 are singular where English puts 0 in `other`.
  // A table ported from `en` by translating two strings in place would print the
  // wrong row for zero and be right about everything else.
  test("selectForm produces two keys this kind has no table to index", () => {
    expect(key("after-number", 0)).toBe("one");
    expect(key("after-number", 0.5)).toBe("one");
    expect(key("after-number", 1)).toBe("one");
    expect(key("after-number", 1.5)).toBe("other");
    expect(key("after-number", 2)).toBe("other");
    expect(key("after-number", 100)).toBe("other");
    // No case axis: `hi.ts` keeps the oblique in the analyzer chain instead, so
    // the slot names the same key in every direction.
    expect(key("bare", 5)).toBe(key("after-number", 5));
    expect(key("conversion-target", 5)).toBe(key("after-number", 5));
    // Ruling R5: a conversion target has no count, and CLDR's generic category
    // answers for it.
    expect(key("conversion-target")).toBe("other");
    expect(new Set([0, 0.5, 1, 1.5, 2, 5, 100].map((n) => key("bare", n)))).toEqual(
      new Set(["one", "other"]),
    );
    expect(percentHi.units["%"]?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* at all — and in
    // Hindi a fraction below 1 lands on the *singular*, which is the boundary
    // English does not have. A fractional count is added for the same reason every
    // other `hi` vocabulary adds one, except that here it can only confirm the
    // absence of a `forms` table, since a unit with none is skipped before any key
    // is asked for. The alias half is what carries this kind.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Hindi percentages", () => {
    const e = engine();
    // Both layers of the language, and the nukta-less spelling of the second.
    expect(e.evaluate("20 प्रतिशत").formatted).toBe("20%");
    expect(e.evaluate("20 फ़ीसदी").formatted).toBe("20%");
    expect(e.evaluate("20 फीसदी").formatted).toBe("20%");
    // Note the *absence* of a space, and that it is the language's decision rather
    // than this file's: `hindi.renderQuantity` branches on the script of the
    // symbol, spacing a Devanagari abbreviation off from the number ("5 किग्रा")
    // and closing up a Latin one. "%" is Latin, so Hindi prints "20%" tight, as
    // English does — and unlike Arabic, which spaces every symbol and prints
    // "20 %". Pinned so nobody has to guess whether the space was meant to be
    // there.
    expect(e.evaluate("20%").formatted).toBe("20%");
    // A sum that lands on a fraction — the `other` row reached from below rather
    // than from above. The output does not move, which is the point of a
    // symbol-only unit: neither category has a word to select.
    expect(e.evaluate("1.5 प्रतिशत").formatted).toBe("1.5%");
    expect(e.evaluate("1 प्रतिशत जोड़ 0.5 प्रतिशत").formatted).toBe("1.5%");
    // The other side of Hindi's boundary, where 0.5 is singular and 1.5 is not,
    // and where a kind with words would print two different rows.
    expect(e.evaluate("0.5 प्रतिशत").formatted).toBe("0.5%");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares. Recognition is many-to-one, generation is
    // one (design decision I6).
    expect(e.evaluate("50 pct").formatted).toBe("50%");
    expect(e.evaluate("20 percent").formatted).toBe("20%");
    // Grouped output, and the recorded gap with it: `Intl.NumberFormat("hi")`
    // writes 1,00,000 where `formatNumber`'s fixed period of three writes
    // 100,000. It round-trips either way, because the reader strips every
    // separator wherever it falls.
    expect(e.evaluate("2000 प्रतिशत").formatted).toBe("2,000%");
    expect(e.evaluate("100000 प्रतिशत").formatted).toBe("100,000%");
    expect(new Intl.NumberFormat("hi").format(100000)).toBe("1,00,000");
  });

  // The oblique plural, which is the one place Hindi morphology touches this unit
  // — "बीस प्रतिशतों में" is what a postposition demands of a plural noun. It is
  // deliberately *not* an alias: `hindi`'s suffix stripper takes ों at
  // `weight: -2` and recovers it, and a penalised reading is still a reading. This
  // is the analyzer earning its place rather than the vocabulary padding itself.
  test("the oblique plural is reached by the stripper, not by a listed alias", () => {
    expect(percentHi.units["%"]?.aliases).not.toContain("प्रतिशतों");
    expect(engine().evaluate("20 प्रतिशतों").formatted).toBe("20%");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion
  // it can be the target of comes from outside the kind.
  test("reads a conversion into percent, through all three postpositions", () => {
    const e = createEngine({
      locales: [composeLocale(hindi, [percentHi, numberHi])],
      kinds: [percent, number],
    });
    // में, को and से are listed under one keyword in `@smartput/core/locale/hi`,
    // so all three have to reach the unit or the sentence a Hindi speaker writes
    // stops parsing when they pick a different postposition. All three sit in the
    // infix position here, which is the whole test a Hindi postposition had to
    // pass to be claimable at all.
    expect(e.evaluate("5 / 50 में प्रतिशत").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 को प्रतिशत").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 से %").formatted).toBe("10%");
  });

  // का is what Hindi says for `of` — "50 का 20%" — and it is deliberately not a
  // keyword: it puts the base first and the percentage second, where this engine's
  // `of` wants them the other way round, and a keyword table cannot swap operands.
  // Recorded as an assertion rather than left in a comment, so that the day
  // percentage arithmetic grows an `OpSignature` of its own the gap is already
  // named.
  //
  // Multiplication is not a substitute, and the shape of the difference is worth
  // pinning rather than asserting away: `* | percent | number` answers a
  // *percent*, so the canonical magnitude is the 10 an English "20% of 50" gives
  // and the unit it wears is "%", printing "1,000%". A right answer with the
  // wrong kind on it is exactly what a dedicated operator exists to prevent, and
  // it is why no keyword table could have stood in for one here.
  test("का is unclaimed, so Hindi's own of-phrase does not parse", () => {
    const e = createEngine({
      locales: [composeLocale(hindi, [percentHi, numberHi])],
      kinds: [percent, number],
    });
    expect(hindi.keywords.of).toBeUndefined();
    expect(() => e.evaluate("50 का 20 प्रतिशत")).toThrow();
    const product = e.evaluate("20 प्रतिशत गुणा 50");
    expect(product.value?.canonical.toString()).toBe("10");
    expect(product.value?.kind).toBe("percent");
    expect(product.formatted).toBe("1,000%");
  });

  // Devanagari digits, inherited and pinned here too because this kind's output is
  // a number with one character after it. `lex` decides digit-ness with an ASCII
  // range test and २ is `\p{Nd}`, so it is skipped as an unrecognized character —
  // which for "२० प्रतिशत" means the digits vanish and the bare unit reads as one
  // percent. Silent, and worse than a throw, which is why it is written down.
  test("Devanagari digits are dropped by the lexer, not read", () => {
    const e = engine();
    expect(e.evaluate("२० प्रतिशत").formatted).toBe("1%");
    expect(() => e.evaluate("२०")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20 प्रतिशत",
      "0.5 फ़ीसदी",
      "1.5 प्रतिशत",
      "2000 प्रतिशत",
      "100000 प्रतिशत",
      "50 pct",
      "1 प्रतिशत जोड़ 0.5 प्रतिशत",
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
