import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { formatNumber } from "../format/format";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { foldNumerals } from "../parse/numerals";
import type { Slot } from "../types";
import { arabic } from "./ar";
import { ARABIC_SCALES, CARDINALS } from "./ar-cardinals";
import { composeLocale } from "./compose";
import { numberSymbols, parseNumber } from "./number";

const form = (n: number, slot: Slot = "bare") =>
  arabic.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

/** No vocabularies: every assertion below is about the language's mechanics. */
const ar = composeLocale(arabic);

/**
 * Arabic spaces its numerals and uses no hyphen, so a run is a plain split —
 * simpler than French's, and the reason there is no `collectRun` subtlety to
 * mirror here. "خمسة وعشرون" is two tokens because of the space, not in spite of
 * the glued و, which is part of the second word.
 */
const asRun = (spelled: string) => spelled.split(/\s+/);

/**
 * The whole numbering-system decision, pinned from four sides so that no single
 * platform change can move the language without a test saying so.
 */
describe("arabic number symbols", () => {
  /** What the language actually declares, and what every other pass reads. */
  test("declares the latn separators", () => {
    expect(numberSymbols(arabic)).toEqual({ group: ",", decimal: "." });
  });

  /**
   * The transcription checked against the numbering system it claims to be. If
   * ICU ever revises what `latn` looks like under an Arabic locale, this fails —
   * which is the whole point of transcribing a *named* numbering system rather
   * than two characters someone liked.
   */
  test("the transcription is exactly what ar-u-nu-latn produces", () => {
    const parts = new Intl.NumberFormat("ar-u-nu-latn").formatToParts(1234567.5);
    expect(parts.find((p) => p.type === "group")?.value).toBe(",");
    expect(parts.find((p) => p.type === "decimal")?.value).toBe(".");
    expect(new Intl.NumberFormat("ar-u-nu-latn").format(1234567.5)).toBe("1,234,567.5");
  });

  /**
   * The platform's own answer for "Arabic", recorded as it is on this runtime
   * rather than as the folklore says it is: the regional tags disagree with the
   * bare one and with each other. `ar-MA` is the row that shows why "just take
   * `intl`" would not even be a stable *Latin-digit* answer — the Maghreb
   * writes Latin digits with French separators.
   *
   * The bare tag is the sharpest version of the point, and the one thing here
   * that is not a fact about CLDR at all: it is a fact about the ICU build
   * underneath. macOS resolves `ar` to `latn`, the Linux CI runners to `arab`.
   * Asserted as "one of the two known answers" for that reason — pinning it to
   * whichever this machine gives would just fail on the other machine, and the
   * claim being made is that the bare tag cannot be relied on.
   */
  test("CLDR's answer depends on which Arabic you ask for", () => {
    expect(["latn", "arab"]).toContain(
      new Intl.NumberFormat("ar").resolvedOptions().numberingSystem,
    );
    expect(new Intl.NumberFormat("ar-EG").resolvedOptions().numberingSystem).toBe("arab");
    expect(new Intl.NumberFormat("ar-MA").format(1234567.5)).toBe("1.234.567,5");
    // The separators `arab` brings with it, as escapes rather than literals:
    // U+066C and U+066B are near-invisible commas in source, and they are
    // exactly the two characters this language would inherit on any runtime
    // that resolves the bare tag that way.
    const eg = new Intl.NumberFormat("ar-EG").formatToParts(1234567.5);
    expect(eg.find((p) => p.type === "group")?.value).toBe("\u066C");
    expect(eg.find((p) => p.type === "decimal")?.value).toBe("\u066B");
    // What the language declares is tied to the numbering system it transcribes
    // and never to the bare tag, which is the whole reason `latn` is named in
    // the locale rather than taken from whatever `ar` resolves to here.
    expect(numberSymbols(arabic)).toEqual({
      group: new Intl.NumberFormat("ar-u-nu-latn")
        .formatToParts(1234)
        .find((p) => p.type === "group")?.value as string,
      decimal: new Intl.NumberFormat("ar-u-nu-latn")
        .formatToParts(1.5)
        .find((p) => p.type === "decimal")?.value as string,
    });
  });

  /**
   * The measurement the decision rests on: the engine's number path is ASCII in
   * three independent places, so Arabic-Indic digits are not merely unparsed —
   * they are *dropped*, falling through `lex`'s "unrecognized character" branch.
   * Choosing the `arab` separators would therefore have bought nothing and cost
   * a mixed-script output.
   */
  test("arabic-indic digits never reach the number path", () => {
    expect(parseNumber("٥", arabic)).toBeNull();
    expect(parseNumber("١٬٢٣٤", arabic)).toBeNull();

    const tokens = lex(normalize("٥ كغ").text, ar);
    expect(tokens.map((t) => t.type)).toEqual(["word"]);
    expect(tokens[0]).toMatchObject({ type: "word", text: "كغ" });
  });

  /** Latin digits, on the other hand, round-trip through print and read. */
  test("its own printed output reads back", () => {
    const printed = formatNumber(new Decimal("1234567.5"), arabic);
    expect(printed).toBe("1,234,567.5");
    expect(parseNumber(printed, arabic)?.toString()).toBe("1234567.5");

    const tokens = lex(normalize("1,234 كغ").text, ar);
    expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
    expect(tokens[0]).toMatchObject({ type: "number", text: "1,234" });
  });
});

/**
 * The six-category contract. Every Arabic `Vocabulary` keys its `forms` table
 * off this, so each row names the grammar behind the category and not just the
 * arithmetic.
 */
describe("arabic plural selection", () => {
  test.each([
    // Zero has a category of its own, which no other language here gives it.
    [0, "zero"],
    [1, "one"],
    // The dual: كيلوغرامان, a suffixed form of the noun.
    [2, "two"],
    [3, "few"],
    [9, "few"],
    [10, "few"],
    // 11–99: the tamyīz, an accusative *singular* — كيلوغرامًا — and the row a
    // table ported by renaming English columns gets wrong.
    [11, "many"],
    [26, "many"],
    [99, "many"],
    // 100 and up: genitive singular again, مئة كيلوغرام.
    [100, "other"],
    [101, "other"],
    [102, "other"],
    // 103 is `few` and 111 is `many`: the category is decided by n mod 100, so
    // these two prove it is not "look at the magnitude".
    [103, "few"],
    [111, "many"],
    [1000, "other"],
    // Every fraction, including the ones English calls `one`.
    [0.5, "other"],
    [1.5, "other"],
    [2.5, "other"],
  ])("%p selects %p", (count, key) => {
    expect(form(count)).toBe(key);
  });

  /**
   * Ruling R5's row. Arabic lands a bare conversion target on the genitive
   * singular — "١ كغ إلى غرام" — which is the opposite of French, where a target
   * with no count is plural.
   */
  test("a count-free conversion target still names a key", () => {
    expect(
      arabic.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
  });

  /**
   * One axis, unlike Ukrainian's and German's. The case a preposition governs is
   * written with a short vowel that unvocalised Arabic omits, so a second axis
   * would name the same string in every row. Pinned rather than left implicit,
   * because "the slot does nothing" is exactly the kind of fact a later edit
   * breaks silently.
   */
  test.each(["bare", "after-number", "conversion-target"] as const)(
    "the %s slot changes no key",
    (slot) => {
      expect(form(0, slot)).toBe("zero");
      expect(form(2, slot)).toBe("two");
      expect(form(11, slot)).toBe("many");
    },
  );

  /** The contract three later vocabularies key their `forms` tables off. */
  test("the key set is exactly the six CLDR categories", () => {
    const keys = new Set<string>();
    const slots: Slot[] = ["bare", "after-number", "conversion-target", "invented"];
    for (const slot of slots) {
      keys.add(arabic.selectForm({ kind: "mass", unit: "kg", slot }));
      for (let n = 0; n <= 220; n += 1) keys.add(form(n, slot));
      for (const n of [0.5, 1.5, 2.5, 1000, 1001, 10_000, 1_000_000]) {
        keys.add(form(n, slot));
      }
    }
    expect([...keys].sort()).toEqual(["few", "many", "one", "other", "two", "zero"]);
    // The same six the platform declares — the set is CLDR's, not this file's.
    expect(
      [...new Intl.PluralRules("ar").resolvedOptions().pluralCategories].sort(),
    ).toEqual(["few", "many", "one", "other", "two", "zero"]);
  });
});

describe("arabic cardinals", () => {
  /**
   * Reading. Every row is something Arabic does that the two built-in languages
   * do not, and the و-prefixed forms are the ones the generated keys exist for.
   */
  test.each([
    [["صفر"], 0, 1],
    // The teens are a sum of two spaced words, with irregular forms for 1 and 2.
    [["أحد", "عشر"], 11, 2],
    [["اثنا", "عشر"], 12, 2],
    [["ثلاثة", "عشر"], 13, 2],
    // Units before tens, joined by a و that is part of the second token.
    [["خمسة", "وعشرون"], 25, 2],
    // The oblique tens, which is what follows a preposition — and therefore what
    // most running text contains.
    [["خمسة", "وعشرين"], 25, 2],
    // Polarity: the bare form agrees with a feminine noun and means the same 3.
    [["ثلاث"], 3, 1],
    // A fused hundred, in both orthographies of مئة.
    [["ثلاثمئة"], 300, 1],
    [["ثلاثمائة"], 300, 1],
    [["ثلاثمئة", "وخمسة", "وعشرون"], 325, 3],
    // مئة multiplies upwards even though the hundreds below it are fused.
    [["مئة", "ألف"], 100_000, 2],
    // The dual of a scale noun is one word and takes no multiplier.
    [["ألفان"], 2000, 1],
    [["ألفان", "وخمسمئة"], 2500, 2],
    // Three to ten take the plural scale noun.
    [["ثلاثة", "آلاف"], 3000, 2],
    // Eleven and up return to the singular.
    [["خمسة", "عشر", "ألف"], 15_000, 3],
    [["مليون"], 1_000_000, 1],
    [["ثلاثة", "ملايين"], 3_000_000, 2],
    [["مليار"], 1_000_000_000, 1],
    // Hamza-less spellings, which is what most keyboards produce.
    [["اربعة"], 4, 1],
    [["الفان"], 2000, 1],
  ])("%p reads as %p", (words, value, consumed) => {
    expect(arabic.numerals?.(words as string[])).toEqual({
      value: new Decimal(value),
      consumed,
    });
  });

  test("a claim stops at the first word it cannot read", () => {
    expect(arabic.numerals?.(["خمسة", "وعشرون", "كيلوغرامًا"])).toEqual({
      value: new Decimal(25),
      consumed: 2,
    });
    expect(arabic.numerals?.(["كيلوغرام"])).toBeNull();
  });

  /**
   * The decision `ar-cardinals.ts` documents, asserted from the outside: a
   * detached و is not a connector, so two spaced quantities are not silently
   * summed into one numeral. Arabic never writes the conjunction apart, so
   * nothing correct is lost.
   */
  test("a detached و is never absorbed", () => {
    expect(arabic.numerals?.(["خمسة", "و", "ثلاثة"])).toEqual({
      value: new Decimal(5),
      consumed: 1,
    });
    expect(CARDINALS.connectors).toBeUndefined();
  });

  /**
   * Writing, pinned as strings wherever Arabic's own order or its fused words
   * are the point: units before tens, the و glued to the following word, the
   * hundreds looked up whole, and a scale noun that changes shape four times as
   * its multiplier grows.
   */
  test.each([
    [0, "صفر"],
    [1, "واحد"],
    [3, "ثلاثة"],
    [10, "عشرة"],
    // عشر, not عشرة, inside a teen — and أحد, not واحد.
    [11, "أحد عشر"],
    [12, "اثنا عشر"],
    [13, "ثلاثة عشر"],
    [20, "عشرون"],
    [21, "واحد وعشرون"],
    [25, "خمسة وعشرون"],
    [100, "مئة"],
    [105, "مئة وخمسة"],
    [111, "مئة وأحد عشر"],
    [125, "مئة وخمسة وعشرون"],
    // The fused hundreds, which are looked up and never composed.
    [200, "مئتان"],
    [300, "ثلاثمئة"],
    [325, "ثلاثمئة وخمسة وعشرون"],
    // One writes no multiplier at all; two is the fused dual.
    [1000, "ألف"],
    [1100, "ألف ومئة"],
    [2000, "ألفان"],
    [2500, "ألفان وخمسمئة"],
    // Three to ten take the plural noun, eleven and up the singular.
    [3000, "ثلاثة آلاف"],
    [3525, "ثلاثة آلاف وخمسمئة وخمسة وعشرون"],
    [15_000, "خمسة عشر ألف"],
    [21_000, "واحد وعشرون ألف"],
    [100_000, "مئة ألف"],
    [1_000_000, "مليون"],
    [1_001_000, "مليون وألف"],
    [1_000_100, "مليون ومئة"],
    [2_000_000, "مليونان"],
    [3_000_000, "ثلاثة ملايين"],
    [1_000_000_000, "مليار"],
    [1_000_000_000_000, "تريليون"],
  ])("%p spells as %p", (value, spelled) => {
    expect(arabic.spell?.(new Decimal(value))).toBe(spelled);
  });

  test("declines the three values the tables cannot reach", () => {
    expect(arabic.spell?.(new Decimal("1.5"))).toBeNull();
    expect(arabic.spell?.(new Decimal(-5))).toBeNull();
    // 1000 × the largest declared scale, exclusive.
    expect(arabic.spell?.(new Decimal("1e15"))).toBeNull();
    expect(arabic.spell?.(new Decimal("999999999999999"))).not.toBeNull();
  });

  /**
   * The two directions closed against each other. This is what the generated
   * و-forms buy: every join the speller writes is a token the parser reads, so
   * an edit to either table that breaks the pairing fails here.
   */
  test.each([
    0, 1, 2, 3, 5, 9, 10, 11, 12, 13, 19, 20, 21, 25, 30, 40, 55, 99, 100, 101, 105, 110,
    111, 125, 200, 250, 300, 325, 500, 999, 1000, 1100, 1500, 2000, 2500, 3000, 3525,
    11_000, 15_000, 21_000, 100_000, 999_999, 1_000_000, 1_000_100, 1_001_000, 1_500_000,
    2_000_000, 3_000_000, 1_000_000_000, 2_000_000_000, 1_000_000_000_000,
  ])("%p spells and reads back as itself", (value) => {
    const spelled = arabic.spell?.(new Decimal(value));
    expect(spelled).not.toBeNull();
    const run = asRun(spelled as string);
    expect(arabic.numerals?.(run)).toEqual({
      value: new Decimal(value),
      consumed: run.length,
    });
  });

  /**
   * The two structures `ar-cardinals.ts` keeps side by side — the flat tables the
   * shared parser reads and the four-form scale rows the speller composes from —
   * checked against each other rather than trusted. Every word the speller can
   * write is a word the parser accepts.
   */
  test.each([...ARABIC_SCALES])("$singular is readable in all three forms", (scale) => {
    expect(CARDINALS.scales[scale.singular]).toBe(scale.value);
    expect(CARDINALS.scales[scale.plural]).toBe(scale.value);
    // The dual is an addend, not a multiplier: ألفان *is* two thousand.
    expect(CARDINALS.tens[scale.dual]).toBe(scale.value * 2);
    // And each one also reads with the conjunction glued to its front, which is
    // how it appears anywhere but first.
    expect(CARDINALS.scales[`و${scale.singular}`]).toBe(scale.value);
    expect(CARDINALS.tens[`و${scale.dual}`]).toBe(scale.value * 2);
  });
});

/**
 * The numerals through the real passes, not through a hand-built run: Arabic
 * letters lex as words, the default segmenter leaves them whole, and
 * `foldNumerals` turns the run into one number token.
 */
describe("arabic numerals through the token stream", () => {
  const foldedValue = (input: string) => {
    const tokens = foldNumerals(lex(normalize(input).text, ar), ar);
    return tokens[0]?.type === "number" ? tokens[0].value.toString() : null;
  };

  test.each([
    ["خمسة وعشرون كغ", "25"],
    ["ثلاثة آلاف وخمسمئة كغ", "3500"],
    ["مئة ألف كغ", "100000"],
  ])("%s folds to %s", (input, value) => {
    expect(foldedValue(input)).toBe(value);
  });
});

describe("arabic morphology", () => {
  const forms = (surface: string) =>
    (arabic.analyze ?? []).flatMap((a) =>
      a(surface, { locale: "ar", words: [surface], index: 0 }),
    );
  const formsOf = (surface: string) => forms(surface).map((f) => f.form);

  /**
   * The orthographic fold: diacritics and the tatwīl are deleted, and the hamza
   * -bearing alifs collapse to the plain one. Written with escapes so the marks
   * are visible in source.
   */
  test.each([
    // كِيلُوغْرَام — the vocalised spelling a dictionary prints.
    ["كِيلُوغْرَام", "كيلوغرام"],
    // The tatwīl, which stretches the baseline and means nothing.
    ["كيلوـغرام", "كيلوغرام"],
    ["أوقية", "اوقية"],
    ["إنش", "انش"],
  ])("%p folds to %p", (surface, folded) => {
    expect(formsOf(surface)).toContain(folded);
  });

  test("an already-bare word gets no duplicate form", () => {
    // `identity()` alone answers for it; the fold declines rather than offering
    // the same string a second time at a penalty.
    expect(formsOf("كيلوغرام")).toEqual(["كيلوغرام"]);
  });

  /** The article and the particles that fuse to it. */
  test.each([
    ["الكيلوغرام", "كيلوغرام"],
    ["بالغرام", "غرام"],
    ["للمتر", "متر"],
    ["والكيلومتر", "كيلومتر"],
  ])("%p strips to %p", (surface, stem) => {
    expect(formsOf(surface)).toContain(stem);
  });

  /** The endings a counted noun takes — the dual and the two plurals. */
  test.each([
    // The `two` row: a suffixed dual, in both its cases.
    ["كيلوغرامان", "كيلوغرام"],
    ["كيلوغرامين", "كيلوغرام"],
    // The `few` row.
    ["كيلوغرامات", "كيلوغرام"],
    // The `many` row, with the tanwīn written and with it left out.
    ["كيلوغرامًا", "كيلوغرام"],
    ["كيلوغراما", "كيلوغرام"],
    // The two-letter noun that `minStem: 2` exists for.
    ["طنان", "طن"],
  ])("%p strips to %p", (surface, stem) => {
    expect(formsOf(surface)).toContain(stem);
  });

  /**
   * The floor, from the other side: no analyzer may manufacture a one-letter
   * stem, because م، غ، ل and ث are real unit symbols and every three-letter
   * Arabic word ending in ا or ن would otherwise become one.
   */
  test("no analyzer produces a one-letter stem", () => {
    for (const word of ["مان", "لات", "غين", "ثما", "الى"]) {
      for (const f of formsOf(word)) expect(f.length).toBeGreaterThan(1);
    }
  });

  /** Every stripped or folded reading is offered below an exact alias. */
  test("every non-identity reading is penalised", () => {
    for (const f of forms("الكيلوغرامات")) {
      if (f.form !== "الكيلوغرامات") expect(f.weight ?? 0).toBeLessThan(0);
    }
  });
});

describe("arabic keywords", () => {
  test("claims both spellings of the conversion preposition", () => {
    // إلى and الى are the same word; `buildKeywords` matches by exact folded
    // string and never runs a keyword through `Language.analyze`, so the
    // hamza-less spelling has to be listed rather than folded into the other.
    expect(arabic.keywords.in).toEqual(["إلى", "الى", "في"]);
  });

  /**
   * The conflict Arabic actually has: في is both the preposition of conversion
   * and the ordinary word for "times". It is claimed as `in`, and ضرب carries
   * multiplication — one surface cannot be two keywords, and `buildKeywords`
   * throws on exactly that.
   */
  test("في is the conversion preposition and not multiplication", () => {
    expect(arabic.keywords.times).toEqual(["ضرب"]);
    expect(arabic.keywords.times).not.toContain("في");
  });

  test("the phrasal operators lex as keywords", () => {
    expect(lex("1 كغ إلى غ", ar).map((t) => t.type)).toEqual([
      "number",
      "word",
      "keyword",
      "word",
    ]);
    // "قسمة على" is two keywords that `foldWordOps` makes one operator; ضرب is
    // the bare form and needs no `by` behind it.
    expect(lex("6 قسمة على 2", ar).map((t) => t.type)).toEqual([
      "number",
      "keyword",
      "keyword",
      "number",
    ]);
    expect(lex("3 ضرب 5", ar).map((t) => t.type)).toEqual([
      "number",
      "keyword",
      "number",
    ]);
  });
});

/**
 * Typography. A space before a symbol, as in German and French — and the part
 * that is Arabic's alone: the number stays first in *logical* order, which is
 * what makes it appear on the right once a bidi-aware renderer has it.
 */
describe("arabic typography", () => {
  test.each([
    [{ symbol: "كغ" }, "5 كغ"],
    [{ symbol: "%" }, "5 %"],
    [{ form: "كيلوغرامات" }, "5 كيلوغرامات"],
    [{ alias: "كيلوغرام" }, "5 كيلوغرام"],
    // The half-translated floor, which must still degrade to the unit key.
    [{}, "5 kg"],
  ])("%p renders as %p", (parts, expected) => {
    expect(
      arabic.renderQuantity?.({
        number: "5",
        kind: "mass",
        unit: "kg",
        slot: "bare",
        ...parts,
      }),
    ).toBe(expected);
  });

  test("a caller's own gap still wins", () => {
    expect(
      arabic.renderQuantity?.({
        number: "5",
        kind: "mass",
        unit: "kg",
        slot: "bare",
        symbol: "كغ",
        gap: "",
      }),
    ).toBe("5كغ");
  });

  /**
   * No reversal, and no bidi controls. The rendered string holds the number
   * first and the label second, exactly as the English one does — a renderer
   * puts the number on the right, and a `parse` of this string reads a number
   * followed by a unit, which is the only order this engine can read back.
   */
  test("the parts are in logical order and carry no bidi controls", () => {
    const rendered = arabic.renderQuantity?.({
      number: "5",
      kind: "mass",
      unit: "kg",
      slot: "bare",
      symbol: "كغ",
    }) as string;
    expect(rendered.indexOf("5")).toBeLessThan(rendered.indexOf("كغ"));
    // U+200E…U+200F and U+2066…U+2069: the marks and isolates a "fix" for RTL
    // would reach for. None of them survives a round trip through `lex`.
    expect(rendered).not.toMatch(/[\u200E\u200F\u2066-\u2069]/);
    expect(lex(normalize(rendered).text, ar).map((t) => t.type)).toEqual([
      "number",
      "word",
    ]);
  });
});

test("the language ships no word for any unit", () => {
  expect(arabic.id).toBe("ar");
  // The whole of what a `Language` may contain, restated as a shape: mechanics,
  // and a keyword table whose every entry is a connective. `off` is absent by
  // decision — see the keyword table's own comment.
  expect(Object.keys(arabic.keywords).sort()).toEqual([
    "by",
    "in",
    "minus",
    "of",
    "over",
    "plus",
    "times",
  ]);
  // Arabic is written with spaces between words, so the default segmenter is
  // right for it and there is nothing to declare.
  expect(arabic.segment).toBeUndefined();
});
