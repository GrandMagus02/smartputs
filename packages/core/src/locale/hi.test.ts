import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { formatNumber } from "../format/format";
import type { Slot } from "../types";
import { composeLocale } from "./compose";
import { hindi } from "./hi";
import { CARDINALS, SPELLING } from "./hi-cardinals";
import { numberSymbols, parseNumber } from "./number";
import { defineVocabulary } from "./vocabulary";

const form = (n: number, slot: Slot = "bare") =>
  hindi.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

/**
 * A mass vocabulary, here and not in `@smartput/mass`, because these tests are
 * about the *language* and need something to say. It is deliberately small and
 * deliberately mixed-register: किग्रा is a Devanagari abbreviation and the Latin
 * "kg" is an alias beside it, which is the pair `renderQuantity` branches on.
 */
const MASS = defineVocabulary({
  locale: "hi",
  kind: "mass",
  units: {
    kg: {
      aliases: ["किलोग्राम", "किग्रा", "किलो", "kg"],
      symbol: "किग्रा",
      forms: { one: "किलोग्राम", other: "किलोग्राम" },
    },
    g: {
      aliases: ["ग्राम", "ग्रा", "g"],
      symbol: "ग्रा",
      forms: { one: "ग्राम", other: "ग्राम" },
    },
    t: { aliases: ["टन", "t"], symbol: "टन", forms: { one: "टन", other: "टन" } },
  },
});

const engine = createEngine({
  locales: [composeLocale(hindi, [MASS])],
  kinds: BUILTIN_KINDS,
  format: "hi",
});

describe("hindi", () => {
  test("keys are the two CLDR categories and nothing else", () => {
    expect(hindi.id).toBe("hi");
    // The whole key set three vocabularies will be written against. No case
    // axis: see `hi.ts` on why the direct/oblique distinction stays in the
    // analyzer chain instead.
    expect(new Set([0, 0.5, 1, 1.5, 2, 5, 21, 100, 100000].map((n) => form(n)))).toEqual(
      new Set(["one", "other"]),
    );
    expect(new Intl.PluralRules("hi").resolvedOptions().pluralCategories).toEqual([
      "one",
      "other",
    ]);
  });

  test("zero and every fraction below one are singular", () => {
    // Hindi's `one` is `i = 0 or n = 1`, which is not where English puts the
    // boundary — this is the row a table ported from `en` by translating two
    // strings in place will silently get wrong.
    expect(form(0)).toBe("one");
    expect(form(0.5)).toBe("one");
    expect(form(1)).toBe("one");
    // And on the other side of it.
    expect(form(1.5)).toBe("other");
    expect(form(2)).toBe("other");
    expect(form(100000)).toBe("other");
  });

  test("the slot changes nothing, in either direction", () => {
    for (const slot of ["bare", "after-number", "conversion-target"] as Slot[]) {
      expect(form(1, slot)).toBe("one");
      expect(form(5, slot)).toBe("other");
    }
    // A count-free conversion target — ruling R5's row — answers CLDR's generic
    // category.
    expect(
      hindi.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
  });

  test("takes its number symbols from CLDR", () => {
    // Plain ASCII, the same pair `en` uses — which is exactly why the grouping
    // test below exists: checking the symbols alone would find nothing unusual
    // about Hindi at all.
    expect(numberSymbols(hindi)).toEqual({ group: ",", decimal: "." });
  });

  test("CLDR's own default numbering system for the bare tag is latn", () => {
    // The ruling behind `numberFormat: "intl"`. A Hindi page writes 1,00,000,
    // not १,००,०००, and choosing `deva` here would be disagreeing with the
    // platform about the language.
    expect(new Intl.NumberFormat("hi").resolvedOptions().numberingSystem).toBe("latn");
    // The alternative, pinned so it is visible rather than hypothetical.
    expect(
      new Intl.NumberFormat("hi", { numberingSystem: "deva" }).format(1234567.5),
    ).toBe("१२,३४,५६७.५");
  });

  test("Intl groups by lakh and crore, not by a fixed period of three", () => {
    const nf = new Intl.NumberFormat("hi");
    expect(nf.format(100000)).toBe("1,00,000");
    expect(nf.format(10000000)).toBe("1,00,00,000");
    expect(nf.format(1234567.5)).toBe("12,34,567.5");
    // Said as a rule rather than as three examples: the first group from the
    // right is three digits and every group after it is two.
    expect(nf.format(12345678901).split(",")).toEqual(["12", "34", "56", "78", "901"]);
  });

  test("core's formatter still writes a fixed period of three", () => {
    // A recorded gap, not an aspiration. `NumberFormatSpec` carries a separator
    // and no grouping rule, and `formatNumber` inserts it every three digits,
    // so the engine prints the first of these where Hindi writes the second.
    // The day core learns about grouping periods, this line is the one that
    // fails and tells the next reader exactly what changed.
    expect(formatNumber(new Decimal(1234567.5), hindi)).toBe("1,234,567.5");
    expect(new Intl.NumberFormat("hi").format(1234567.5)).toBe("12,34,567.5");
  });

  test("the reader is grouping-agnostic, so both forms round-trip", () => {
    // What the engine writes today, read back.
    const written = formatNumber(new Decimal(1234567.5), hindi);
    expect(parseNumber(written, hindi)?.toString()).toBe("1234567.5");
    // And what Hindi actually writes, which the formatter cannot yet produce —
    // so this half is the regression test waiting for the fix above.
    expect(parseNumber("12,34,567.5", hindi)?.toString()).toBe("1234567.5");
    expect(parseNumber("1,00,000", hindi)?.toString()).toBe("100000");
    expect(parseNumber("1,00,00,000", hindi)?.toString()).toBe("10000000");
  });

  test("reads cardinals, including the scales English has no word for", () => {
    expect(hindi.numerals?.(["पच्चीस"])).toEqual({ value: new Decimal(25), consumed: 1 });
    // लाख is 10^5 and करोड़ is 10^7: the ladder goes x1000, x100, x100, which is
    // the half of this table a reader cannot check against English by analogy.
    expect(hindi.numerals?.(["एक", "लाख"])).toEqual({
      value: new Decimal(100_000),
      consumed: 2,
    });
    expect(hindi.numerals?.(["पच्चीस", "लाख"])).toEqual({
      value: new Decimal(2_500_000),
      consumed: 2,
    });
    expect(hindi.numerals?.(["एक", "करोड़"])).toEqual({
      value: new Decimal(10_000_000),
      consumed: 2,
    });
    expect(hindi.numerals?.(["दो", "लाख", "पचास", "हज़ार"])).toEqual({
      value: new Decimal(250_000),
      consumed: 4,
    });
    // सौ multiplies rather than closing a group, so it composes with a scale
    // above it as well as with an addend below it.
    expect(hindi.numerals?.(["दो", "सौ", "पचास"])).toEqual({
      value: new Decimal(250),
      consumed: 3,
    });
    expect(hindi.numerals?.(["सौ", "करोड़"])).toEqual({
      value: new Decimal(1_000_000_000),
      consumed: 2,
    });
  });

  test("reads the fractional atoms English has no single word for", () => {
    // डेढ़, ढाई and आधा are single Hindi words where English composes "one and a
    // half" out of parts it already has, so a table translated from `en` has no
    // slot for them and "ढाई घंटे" does not parse at all.
    expect(hindi.numerals?.(["डेढ़"])?.value).toEqual(new Decimal(1.5));
    expect(hindi.numerals?.(["ढाई"])?.value).toEqual(new Decimal(2.5));
    expect(hindi.numerals?.(["आधा"])?.value).toEqual(new Decimal(0.5));
    // आधे is the oblique/plural of आधा — an ending Hindi substitutes rather than
    // appends, so no stripper reaches it.
    expect(hindi.numerals?.(["आधे"])?.value).toEqual(new Decimal(0.5));
    // साढ़े is an increment rather than a value: it adds a half to what follows,
    // which is exactly what `cardinalNumerals` does with an addend.
    expect(hindi.numerals?.(["साढ़े", "तीन"])?.value).toEqual(new Decimal(3.5));
    // And the increments survive the scale ladder, which is the property that
    // decides which of these words may be declared at all.
    expect(hindi.numerals?.(["डेढ़", "सौ"])?.value).toEqual(new Decimal(150));
    expect(hindi.numerals?.(["ढाई", "लाख"])?.value).toEqual(new Decimal(250_000));
    expect(hindi.numerals?.(["डेढ़", "करोड़"])?.value).toEqual(new Decimal(15_000_000));
    expect(hindi.numerals?.(["साढ़े", "तीन", "सौ"])?.value).toEqual(new Decimal(350));
    expect(hindi.numerals?.(["साढ़े", "सात", "लाख"])?.value).toEqual(new Decimal(750_000));
    // सवा (+¼) and पौने (−¼) are the two that could not be declared: they are
    // increments too, but Hindi writes them in front of a scale word as well, and
    // there the addend model answers wrongly rather than not at all — सवा सौ is
    // 125 and would fold to 0.25 × 100. Pinned as an absence so the next reader
    // knows it was decided rather than forgotten: the fold declines the run
    // outright rather than claiming a suffix of it.
    expect(hindi.numerals?.(["सवा", "तीन"])).toBeNull();
    expect(hindi.numerals?.(["पौने", "तीन"])).toBeNull();
    // Nothing fractional is ever written back: the speller declines a
    // non-integer before it consults a table.
    expect(hindi.spell?.(new Decimal(1.5))).toBeNull();
    // End to end, through the lexer and the resolver, because the point of these
    // rows is that "डेढ़ किलो" is a phrase a person types.
    expect(engine.evaluate("डेढ़ किलोग्राम").formatted).toBe("1.5 किलोग्राम");
    expect(engine.evaluate("आधा किलोग्राम").formatted).toBe("0.5 किलोग्राम");
    expect(engine.evaluate("ढाई लाख ग्राम को किलोग्राम").formatted).toBe("250 किलोग्राम");
  });

  test("reads both spellings of a nukta and both of a nasal", () => {
    // पाँच with the chandrabindu and पांच with the anusvara are one word; there
    // is no way to know which one a keyboard produced, and NFKC folds neither
    // onto the other.
    expect(hindi.numerals?.(["पाँच"])?.value).toEqual(new Decimal(5));
    expect(hindi.numerals?.(["पांच"])?.value).toEqual(new Decimal(5));
    expect(hindi.numerals?.(["छह"])?.value).toEqual(new Decimal(6));
    expect(hindi.numerals?.(["छः"])?.value).toEqual(new Decimal(6));
    // The nukta-less spellings, which no normalization will ever join to the
    // nukta-bearing ones.
    expect(hindi.numerals?.(["एक", "हजार"])?.value).toEqual(new Decimal(1000));
    expect(hindi.numerals?.(["एक", "करोड"])?.value).toEqual(new Decimal(10_000_000));
    // And the four ड़-bearing atoms, which need the twin more than the scales do:
    // the numeral fold has no fuzzy path, so an unlisted spelling here is a
    // phrase that does not parse rather than one that parses at a penalty.
    expect(hindi.numerals?.(["अडतीस"])?.value).toEqual(new Decimal(38));
    expect(hindi.numerals?.(["अडतालीस"])?.value).toEqual(new Decimal(48));
    expect(hindi.numerals?.(["सडसठ"])?.value).toEqual(new Decimal(67));
    expect(hindi.numerals?.(["अडसठ"])?.value).toEqual(new Decimal(68));
  });

  test("every nukta-bearing word in the tables has a nukta-less twin", () => {
    // Said as a rule rather than as six examples. NFKC settles how the mark is
    // *encoded*; nothing ever supplies one that was not typed, so a table that
    // declares ज़ or ड़ and not the bare letter is unreadable for half the
    // people who would type the word.
    const NUKTA = "़";
    const words = [...Object.keys(CARDINALS.units), ...Object.keys(CARDINALS.scales)];
    const declared = new Set(words);
    expect(
      words.filter((w) => w.includes(NUKTA) && !declared.has(w.replaceAll(NUKTA, ""))),
    ).toEqual([]);
    for (const spellings of Object.values(hindi.keywords)) {
      expect(
        spellings.filter(
          (w) => w.includes(NUKTA) && !spellings.includes(w.replaceAll(NUKTA, "")),
        ),
      ).toEqual([]);
    }
  });

  test("every cardinal word survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the numeral
    // fold, and ड़/ज़ are Unicode composition *exclusions* — NFKC decomposes
    // U+095C and U+095B into a consonant plus U+093C. A table written with the
    // precomposed characters would be unreachable through the engine while
    // testing green against direct calls, so the tables are written in the
    // decomposed form and this asserts they stay that way.
    const words = [
      ...Object.keys(CARDINALS.units),
      ...Object.keys(CARDINALS.tens),
      ...Object.keys(CARDINALS.scales),
      ...Object.values(hindi.keywords).flat(),
    ];
    expect(words.filter((w) => w.normalize("NFKC") !== w)).toEqual([]);
  });

  test("spells back through the same table", () => {
    expect(hindi.spell?.(new Decimal(0))).toBe("शून्य");
    // 21 is not "बीस एक": every value below 100 is a fused atom, which is why
    // `tens` is empty and `units` holds all hundred of them.
    expect(hindi.spell?.(new Decimal(21))).toBe("इक्कीस");
    expect(hindi.spell?.(new Decimal(45))).toBe("पैंतालीस");
    expect(hindi.spell?.(new Decimal(99))).toBe("निन्यानवे");
    // सौ lives in `scales`, so 100 spells as "एक सौ" and never as the bare
    // "सौ" — declaring सौ as an atom too would make "दो सौ" parse as 102.
    expect(hindi.spell?.(new Decimal(100))).toBe("एक सौ");
    expect(hindi.spell?.(new Decimal(250))).toBe("दो सौ पचास");
    // The Indian scales, in the writing direction.
    expect(hindi.spell?.(new Decimal(1000))).toBe("एक हज़ार");
    expect(hindi.spell?.(new Decimal(100_000))).toBe("एक लाख");
    expect(hindi.spell?.(new Decimal(250_000))).toBe("दो लाख पचास हज़ार");
    expect(hindi.spell?.(new Decimal(10_000_000))).toBe("एक करोड़");
    expect(hindi.spell?.(new Decimal(12_500_000))).toBe("एक करोड़ पच्चीस लाख");
    expect(hindi.spell?.(new Decimal(1_000_000_000))).toBe("एक अरब");
    // The two `cardinalSpeller` declines, both mirroring something the parsing
    // side cannot do either: there is no word for a decimal point anywhere in
    // the tables, and no word for a sign.
    expect(hindi.spell?.(new Decimal(1.5))).toBeNull();
    expect(hindi.spell?.(new Decimal(-5))).toBeNull();
  });

  test("a spelled number reads back as itself", () => {
    for (const n of [
      0, 7, 21, 45, 99, 100, 105, 250, 1000, 100_000, 250_000, 12_500_000,
    ]) {
      const written = hindi.spell?.(new Decimal(n));
      expect(written).toBeString();
      expect(hindi.numerals?.((written as string).split(" "))?.value).toEqual(
        new Decimal(n),
      );
    }
  });

  test("the writing table is derived from the reading one, not written twice", () => {
    // The nukta-less synonyms are readable and unwritable, and `SPELLING` is
    // what makes the second half true. Every one of its words is one of
    // `CARDINALS`', and every value `CARDINALS` can read is one `SPELLING` can
    // name — so a row added to the reading table cannot go missing from the
    // writing one.
    for (const table of ["units", "tens", "scales"] as const) {
      const read = CARDINALS[table];
      const write = SPELLING[table];
      expect(Object.keys(write).every((w) => w in read)).toBe(true);
      expect(new Set(Object.values(write))).toEqual(new Set(Object.values(read)));
    }
    expect(SPELLING.scales).not.toHaveProperty("हजार");
    expect(SPELLING.scales).toHaveProperty("हज़ार");
  });

  test("claims the conversion postpositions and the four arithmetic nouns", () => {
    expect(hindi.keywords.in).toEqual(["में", "को", "से"]);
    // Two spellings of one word, not two words: ड़ is a composition exclusion,
    // so NFKC settles how the nukta is *encoded* and never supplies one that
    // was not typed. A keyword has no fuzzy fallback, so the nukta-less
    // spelling has to be listed or "दस जोड पाँच" throws outright.
    expect(hindi.keywords.plus).toEqual(["जोड़", "जोड"]);
    expect(hindi.keywords.minus).toEqual(["घटा"]);
    expect(hindi.keywords.times).toEqual(["गुणा"]);
    expect(hindi.keywords.over).toEqual(["भाग"]);
    // `by` is unclaimed: `foldWordOps` looks for it *after* the operator word
    // and Hindi's companion particle (से) comes before it. `of` and `off` are
    // unclaimed because का and छूट put the operands the other way round.
    expect(hindi.keywords.by).toBeUndefined();
    expect(hindi.keywords.of).toBeUndefined();
    expect(hindi.keywords.off).toBeUndefined();
  });

  test("no segment hook, because Devanagari is a spaced script", () => {
    expect(hindi.segment).toBeUndefined();
  });

  test("a Devanagari word survives lexing whole", () => {
    // The change Hindi needed outside its own file. An abugida writes its
    // vowels as combining marks, so a letter run built out of `\p{L}` alone
    // stopped at the first matra and किलोग्राम reached the resolver as the bare
    // consonant क. This is the end-to-end proof that it no longer does.
    expect(engine.evaluate("5 किलोग्राम").formatted).toBe("5 किलोग्राम");
    expect(engine.evaluate("1 किलोग्राम को ग्राम").formatted).toBe("1,000 ग्राम");
  });

  test("each conversion postposition reaches the parser as an infix", () => {
    // में is the one a Hindi speaker actually asks a conversion question with:
    // "एक किलोग्राम में कितने ग्राम" — "in one kilogram, how many grams".
    expect(engine.evaluate("1 किलोग्राम में ग्राम").formatted).toBe("1,000 ग्राम");
    expect(engine.evaluate("1 किलोग्राम को ग्राम").formatted).toBe("1,000 ग्राम");
    expect(engine.evaluate("1 किलोग्राम से ग्राम").formatted).toBe("1,000 ग्राम");
  });

  test("the arithmetic nouns read infix", () => {
    expect(engine.evaluate("दस किलोग्राम जोड़ पाँच किलोग्राम").formatted).toBe("15 किलोग्राम");
    // The same word typed on a keyboard with no nukta key. A keyword has no
    // fuzzy fallback — `buildKeywords` is an exact map consulted before the
    // alias index — so before the twin was listed this threw `Unknown unit
    // "जोड"` rather than reading at a penalty.
    expect(engine.evaluate("दस किलोग्राम जोड पाँच किलोग्राम").formatted).toBe("15 किलोग्राम");
    expect(engine.evaluate("दस किलोग्राम घटा तीन किलोग्राम").formatted).toBe("7 किलोग्राम");
    expect(engine.evaluate("पाँच किलोग्राम गुणा तीन").formatted).toBe("15 किलोग्राम");
    expect(engine.evaluate("दस किलोग्राम भाग दो").formatted).toBe("5 किलोग्राम");
    expect(engine.evaluate("एक लाख ग्राम को किलोग्राम").formatted).toBe("100 किलोग्राम");
  });

  test("the oblique plural is read by the analyzer chain", () => {
    // ों is what a plural unit noun becomes in front of a postposition, which
    // is exactly the position the `in` keywords put it in. The vocabulary lists
    // किलोग्राम and never किलोग्रामों; the stripper is what closes the gap.
    expect(engine.evaluate("पच्चीस किलोग्रामों में ग्राम").formatted).toBe("25,000 ग्राम");
  });

  test("a Devanagari symbol is spaced, a Latin one is not", () => {
    const parts = { number: "5", kind: "mass", unit: "kg", slot: "bare" as Slot };
    expect(hindi.renderQuantity?.({ ...parts, symbol: "किग्रा" })).toBe("5 किग्रा");
    expect(hindi.renderQuantity?.({ ...parts, symbol: "kg" })).toBe("5kg");
    // A word always takes a space, and the caller's own separator always wins —
    // `Printer`'s `spacing` is a typographic choice belonging to the caller.
    expect(hindi.renderQuantity?.({ ...parts, form: "किलोग्राम" })).toBe("5 किलोग्राम");
    expect(hindi.renderQuantity?.({ ...parts, symbol: "किग्रा", gap: "" })).toBe("5किग्रा");
  });

  test("the engine reads its own output back", () => {
    // The property the grouping gap above must not break, asserted through the
    // real formatter rather than reasoned about.
    for (const input of ["1234567 ग्राम", "100000 किलोग्राम को ग्राम", "0.5 किलोग्राम"]) {
      const once = engine.evaluate(input).formatted;
      expect(engine.evaluate(once).formatted).toBe(once);
    }
  });

  test("Devanagari digits are not readable, and fail visibly rather than well", () => {
    // Documented in `hi.ts`: `lex` decides what a digit is with an ASCII range
    // test and what a word is with `\p{L}`, and १ is `\p{Nd}` — so it is
    // skipped as an unrecognized character before `numerals` could see it.
    // The consequence is not an error but a *wrong answer*: the digits vanish
    // and a bare unit is left standing, which reads as one of it. Pinned
    // because it is the case a future digit-folding pass in `normalize()` has
    // to fix, and because a silent 1 is worse than a throw.
    expect(engine.evaluate("१२३ किलोग्राम").formatted).toBe("1 किलोग्राम");
    expect(engine.evaluate("123 किलोग्राम").formatted).toBe("123 किलोग्राम");
  });
});
