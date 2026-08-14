import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberHi from "./hi";

const locale = composeLocale(hindi, [numberHi]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/** Devanagari, which is every letter this vocabulary could have written. */
const DEVANAGARI = /\p{Script=Devanagari}/u;

/** The key `hindi` will index a unit's `forms` with, for this count and slot. */
const key = (slot: "bare" | "after-number" | "conversion-target", count?: number) =>
  hindi.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "number",
    unit: "one",
    slot,
  });

describe("number hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberHi.units).sort()).toEqual(units.sort());
    expect(numberHi.locale).toBe("hi");
    expect(numberHi.kind).toBe("number");
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is a ratio of 1 and an id, so no script but ASCII may reach it. Devanagari in
  // the descriptor would mean a translation had leaked into the half of the
  // package that is supposed to be language-free.
  test("the kind itself carries no Hindi word", () => {
    expect(JSON.stringify(number)).not.toMatch(DEVANAGARI);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* at all — and in
    // Hindi the fractional row is on the far side of a boundary English does not
    // have, since `one` is `i = 0 or n = 1` and therefore covers 0.5 while 1.5
    // takes `other`. A fractional count is added for the same reason every other
    // `hi` vocabulary adds one, except that here it can only confirm the absence
    // of a `forms` table: a unit with none is skipped before any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  // The contract check above is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and the absence of any Hindi word
  // with it. एक is the numeral 1 and `hindi.numerals` claims it before the alias
  // index is consulted; इकाई is the mathematical unit and संख्या is the name of
  // this kind. Writing any of them would tell the next translator that "unit
  // noun" is a category this kind has, and it is not.
  test("declares no forms, and no Hindi word at all", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test above
    // owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberHi.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
    }
    expect(JSON.stringify(numberHi)).not.toMatch(DEVANAGARI);
  });

  // `selectForm` still answers for this unit — it is a function of the count and
  // the slot and knows nothing about which units have tables — so the reason the
  // two categories go unexercised here is the missing `forms`, not a missing key.
  // Pinning the whole key set keeps the "no word moves" test below honest: it
  // asserts output does not change across the plural boundary, and this says why.
  test("selectForm produces two keys this kind has no table to index", () => {
    // The row a table ported from `en` gets wrong: Hindi's `one` is CLDR's `i = 0
    // or n = 1`, so 0 and every fraction below 1 are singular where English puts
    // 0 in `other`.
    expect(key("after-number", 0)).toBe("one");
    expect(key("after-number", 0.5)).toBe("one");
    expect(key("after-number", 1)).toBe("one");
    expect(key("after-number", 1.5)).toBe("other");
    expect(key("after-number", 2)).toBe("other");
    expect(key("after-number", 100000)).toBe("other");
    // No case axis, so the slot is inert in both directions — see `hi.ts` on why
    // the oblique lives in the analyzer chain instead.
    expect(key("bare", 5)).toBe(key("after-number", 5));
    // Ruling R5: a conversion target has no count, and the category CLDR requires
    // every locale to define as its generic one answers for it.
    expect(key("conversion-target")).toBe("other");
    expect(new Set([0, 0.5, 1, 1.5, 2, 5, 100].map((n) => key("bare", n)))).toEqual(
      new Set(["one", "other"]),
    );
    expect(numberHi.units.one?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Hindi numbers", () => {
    // The `latn` numbering system, read out of CLDR by `numberFormat: "intl"`:
    // "." marks the decimal and "," groups, the same pair English uses — which is
    // exactly why the grouping test below exists, since checking the separators
    // alone would find nothing unusual about Hindi at all.
    expect(engine.evaluate("1.5").formatted).toBe("1.5");
    expect(engine.evaluate("2000").formatted).toBe("2,000");
    // Hindi cardinals in, Latin digits out, through all four arithmetic nouns.
    // Hindi states an operation as "<left> को <right> से गुणा कीजिए" — operands
    // first, operator last — but the bare operator noun is also used infix, and
    // that is the register a calculator and a schoolbook write in.
    expect(engine.evaluate("पच्चीस जोड़ एक").formatted).toBe("26");
    expect(engine.evaluate("दस घटा तीन").formatted).toBe("7");
    expect(engine.evaluate("पाँच गुणा तीन").formatted).toBe("15");
    expect(engine.evaluate("दस भाग दो").formatted).toBe("5");
    // A sum that lands on a fraction — the `other` row reached from below rather
    // than from above, and the side of Hindi's boundary that 0.5 is not on.
    expect(engine.evaluate("1 जोड़ 0.5").formatted).toBe("1.5");
  });

  // The half of this table English has no word for, and therefore the half a
  // reader cannot check by analogy. The Indian ladder is ×1000, ×100, ×100: लाख
  // is 10^5 and करोड़ is 10^7, so 25,00,000 is "पच्चीस लाख" — twenty-five of
  // them — where English would want two-and-a-half million.
  test("reads लाख and करोड़, the scales English cannot name", () => {
    expect(engine.evaluate("एक लाख").formatted).toBe("100,000");
    expect(engine.evaluate("दो लाख पचास हज़ार").formatted).toBe("250,000");
    expect(engine.evaluate("एक करोड़").formatted).toBe("10,000,000");
    // सौ multiplies the current group rather than closing it, so it composes with
    // a scale above it as well as with an addend below it.
    expect(engine.evaluate("सौ करोड़").formatted).toBe("1,000,000,000");
    expect(engine.evaluate("दो सौ पचास").formatted).toBe("250");
    // The nukta-less spellings, which no normalization joins to the nukta-bearing
    // ones, so `hi-cardinals.ts` declares each as its own key.
    expect(engine.evaluate("एक हजार").formatted).toBe("1,000");
    expect(engine.evaluate("एक करोड").formatted).toBe("10,000,000");
  });

  // The gap this kind exists to make visible, because here the number *is* the
  // whole output. `Intl.NumberFormat("hi")` groups by lakh and crore — the first
  // group from the right is three digits and every group after it is two — while
  // `formatNumber` inserts the separator with a fixed `/\B(?=(\d{3})+(?!\d))/g`
  // and `NumberFormatSpec` has no field that could say otherwise. Both strings are
  // pinned side by side so the gap is a recorded fact rather than a surprise, and
  // so that the day core learns about grouping periods this line is the one that
  // fails and tells the next reader exactly what changed.
  test("the engine groups by threes where Hindi groups by lakh and crore", () => {
    expect(engine.evaluate("100000").formatted).toBe("100,000");
    expect(new Intl.NumberFormat("hi").format(100000)).toBe("1,00,000");
    expect(engine.evaluate("10000000").formatted).toBe("10,000,000");
    expect(new Intl.NumberFormat("hi").format(10000000)).toBe("1,00,00,000");
  });

  // The property the fidelity gap does *not* break, and it is worth separating
  // because everything else rests on it: `parseNumber` removes every occurrence
  // of the group character wherever it falls and never counts digits between them,
  // so the reader is grouping-agnostic by construction. It reads what this engine
  // writes and what a Hindi page writes, and answers the same number for both.
  test("the reader takes genuinely Indian grouping, so both forms round-trip", () => {
    expect(engine.evaluate("1,00,000").value?.canonical.toString()).toBe("100000");
    expect(engine.evaluate("100,000").value?.canonical.toString()).toBe("100000");
    expect(engine.evaluate("12,34,567.5").value?.canonical.toString()).toBe("1234567.5");
    expect(engine.evaluate("1,00,00,000").value?.canonical.toString()).toBe("10000000");
  });

  // Pinned here rather than only in core, because this is the kind where a number
  // is the whole value. CLDR's default numbering system for the bare `hi` tag is
  // `latn`, NFKC does not fold १ onto 1, and `lex` decides digit-ness with an
  // ASCII range test while १ is `\p{Nd}` — so a Devanagari digit is neither a
  // digit nor a letter and is skipped as an unrecognized character before
  // `numerals` or `analyze` could see it. Closing it needs a digit-folding pass in
  // `normalize()`, which is core's; a `Language` has no hook that sees a digit and
  // a `Vocabulary` still less. Do not "fix" this by adding digits to `aliases`.
  test("Devanagari digits are unreadable, and that is a core-level gap", () => {
    expect(new Intl.NumberFormat("hi").resolvedOptions().numberingSystem).toBe("latn");
    // With nothing but digits there is nothing left to parse at all.
    expect(() => engine.evaluate("१२३")).toThrow();
    // And with a unit behind them the failure is silent, which is worse: the
    // digits vanish and the bare unit reads as one.
    expect(engine.evaluate("१२३ one").formatted).toBe("1");
    // The written-out cardinal is how a Hindi reader reaches the same value
    // without Latin digits, and it works.
    expect(engine.evaluate("एक सौ तेईस").formatted).toBe("123");
  });

  // The plural boundary every sibling row turns into a different word. This kind
  // has one answer for both categories, which is the whole of what it contributes
  // to the Hindi phase: nothing is appended after the numeral, so 0.5 (`one`) and
  // 1.5 (`other`) are byte-identical to their own digits.
  test("the 0.5/1.5 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("0.5").formatted).toBe("0.5");
    expect(engine.evaluate("1.5").formatted).toBe("1.5");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where a sibling vocabulary would be asked for the target's
    // word. में is the commonest of Hindi's three `in` postpositions — "एक
    // किलोग्राम में कितने ग्राम" — and here the target word vanishes and the
    // numeral is all that prints.
    expect(engine.evaluate("2 one में one").formatted).toBe("2");
    expect(engine.evaluate("1.5 one को one").formatted).toBe("1.5");
    expect(engine.evaluate("5 one से one").formatted).toBe("5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Hindi claims the Latin
  // word — `CARDINALS` is Devanagari throughout — so here the self-alias is live,
  // which is the alias earning its keep, since `formatNumber` emits exactly this
  // string.
  test("the Latin self-alias is live under hi, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("round-trips its own output", () => {
    // Five inputs: a fractional, a grouped four-digit number, a lakh (where the
    // engine's grouping and Hindi's disagree and the round trip holds anyway), a
    // spelled cardinal, and the facade's own `${raw}one` string.
    for (const input of ["1.5", "2000", "एक लाख", "पच्चीस जोड़ एक", "999one", "1,00,000"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
