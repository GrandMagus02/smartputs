import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import type { Slot } from "../types";
import { createAnalyzerChain } from "./analyze";
import { composeLocale } from "./compose";
import { german } from "./de";
import { CARDINALS } from "./de-cardinals";
import { numberSymbols } from "./number";
import { defineVocabulary } from "./vocabulary";

const form = (n: number, slot: Slot = "bare") =>
  german.selectForm({ count: new Decimal(n), kind: "length", unit: "m", slot });

const read = (...words: string[]) => german.numerals?.(words);
const spell = (n: number) => german.spell?.(new Decimal(n));

describe("german", () => {
  test("keys are case x plural category, and there are exactly four", () => {
    expect(german.id).toBe("de");
    // German's CLDR grammar has two categories and no more, so the key set is
    // the product of two slots' cases with those two — closed at four, which is
    // the contract every German `Vocabulary` keys its `forms` table off.
    expect(new Intl.PluralRules("de").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);

    const keys = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as Slot[]) {
      for (const n of [0, 1, 1.5, 2, 5, 21, 100, 1_000_000]) keys.add(form(n, slot));
      keys.add(german.selectForm({ kind: "length", unit: "m", slot }));
    }
    expect([...keys].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
  });

  test("count picks the number axis, slot picks the case axis", () => {
    expect(form(1)).toBe("nom-one");
    expect(form(2)).toBe("nom-other");
    // Zero is `other` in German — "0 Meilen", marked like any other plural —
    // unlike French, where it agrees with the singular.
    expect(form(0)).toBe("nom-other");
    // A fraction is `other` too, which is why "1,5 Meter" and "7 Meter" select
    // the same row even though only one of them is a plural in any real sense.
    expect(form(1.5)).toBe("nom-other");
    // The case axis, which no `evaluate` can reach: a `Result` is a bare value,
    // so `formatValue` always passes "bare" and only a spelled print ever asks
    // for a conversion target.
    expect(form(1, "conversion-target")).toBe("dat-one");
    expect(form(5, "conversion-target")).toBe("dat-other");
    // "after-number" is not a case of its own — nothing governs a quantity
    // standing beside its own number — so it takes the nominative like "bare".
    expect(form(5, "after-number")).toBe("nom-other");
  });

  test("a count-free conversion target still names a key", () => {
    // Ruling R5: "1 km in Metern" has no magnitude to agree "Metern" with, and
    // the row still has to exist.
    expect(
      german.selectForm({ kind: "length", unit: "m", slot: "conversion-target" }),
    ).toBe("dat-other");
  });

  test("takes its number symbols from CLDR, and they are English's inverted", () => {
    // Both are visible characters here, unlike Ukrainian's U+00A0 group
    // separator — but they are the exact inverse of `en`'s pair, which is the
    // fact a reader of this file most needs pinned.
    expect(numberSymbols(german)).toEqual({ group: ".", decimal: "," });
  });

  test("claims the conversion keywords", () => {
    expect(german.keywords.in).toEqual(["in", "nach", "zu"]);
    expect(german.keywords.of).toEqual(["von"]);
    // The division split: the verb is the operator, the preposition after it is
    // the particle `foldWordOps` swallows into the same token.
    expect(german.keywords.over).toContain("geteilt");
    expect(german.keywords.by).toEqual(["durch"]);
    // Claimed by neither, on purpose: a German discount needs a preposition
    // ("20 % Rabatt auf 50") that a one-token keyword cannot carry.
    expect(german.keywords.off).toBeUndefined();
  });

  test("no surface word is claimed for two different keywords", () => {
    // The check `buildKeywords` would make at boot, made here on one language
    // alone so a conflict inside this table is a German test failure rather
    // than an engine one. "durch" under both `over` and `by` is the specific
    // mistake this guards.
    const seen = new Map<string, string>();
    for (const [keyword, words] of Object.entries(german.keywords)) {
      for (const word of words ?? []) {
        expect(seen.get(word) ?? keyword).toBe(keyword);
        seen.set(word, keyword);
      }
    }
  });
});

/**
 * German writes every numeral below a million as one token, units before tens,
 * with no spaces anywhere. These are the two rows `third-language.test.ts`
 * recorded as things the shared `cardinalNumerals`/`cardinalSpeller` cannot do
 * — it read `["einundzwanzig"]` as null and spelled 21 as "zwanzig ein" — and
 * they pass here because German ships its own tables in `de-cardinals.ts`.
 */
describe("german numerals decompose a single token", () => {
  test.each([
    ["null", 0],
    ["ein", 1],
    // The bare counting one, which German spells differently from the one that
    // stands in front of a noun.
    ["eins", 1],
    ["zwölf", 12],
    // The three irregular teens: sechzehn drops the -s of sechs, siebzehn the
    // -en of sieben, and elf is built from nothing.
    ["sechzehn", 16],
    ["siebzehn", 17],
    // Units before tens, glued by an infixed "und". This is the row the shared
    // helper returns null for.
    ["einundzwanzig", 21],
    ["zweiundzwanzig", 22],
    ["neunundneunzig", 99],
    // dreißig is the one tens word in -ßig, and the Swiss spelling of it is a
    // second key on the same value.
    ["dreißig", 30],
    ["dreissig", 30],
    ["fünfunddreißig", 35],
    // The multiplier before "hundert" may be omitted, so both spellings of 105
    // read as 105.
    ["hundert", 100],
    ["einhundert", 100],
    ["hundertfünf", 105],
    ["einhundertfünf", 105],
    ["hunderteinundzwanzig", 121],
    ["zweihundert", 200],
    // "tausend" is the second multiplying morpheme, and the head before it is
    // itself a sub-1000 compound.
    ["tausend", 1000],
    ["eintausend", 1000],
    ["zweitausendzweihundert", 2200],
    ["hunderttausend", 100_000],
    ["dreihundertfünfundvierzigtausendsechshundertachtundsiebzig", 345_678],
  ])("%s is %d", (word, value) => {
    expect(read(word)).toEqual({ value: new Decimal(value), consumed: 1 });
  });

  test("hundert is found before und, or einhundert would not parse", () => {
    // "hundert" contains "und". A decomposer that split on the infix first
    // would read "einhundert" as "ein" + "hert" and refuse a word it reads
    // perfectly well, so the search order in `de-cardinals.ts` is load-bearing.
    expect(read("einhundert")?.value.toString()).toBe("100");
  });

  test("a spaced numeral is not a German numeral", () => {
    // The mirror of the row above, and the reason "und" is not declared as a
    // connector: German has no spaced numerals below a million, so this claims
    // the 1 and stops rather than reading 21 out of a spelling German does not
    // have.
    expect(read("ein", "und", "zwanzig")).toEqual({
      value: new Decimal(1),
      consumed: 1,
    });
    // Two compounds in a row are two numbers, not one sum: claiming both would
    // silently eat the token after every "300 2" the engine ever sees.
    expect(read("dreihundert", "zwei")).toEqual({
      value: new Decimal(300),
      consumed: 1,
    });
  });

  test("nothing at all is a refusal, not a zero", () => {
    expect(read("Zentimeter")).toBeNull();
    expect(read("und")).toBeNull();
  });

  test("the scale nouns are the one place German puts a space", () => {
    // Million and up are free, capitalised nouns written apart from their
    // multiplier — the reason the word-level `NumeralParser` signature still
    // fits this language at all.
    expect(read("eine", "Million")).toEqual({
      value: new Decimal(1_000_000),
      consumed: 2,
    });
    expect(read("zwei", "Millionen")).toEqual({
      value: new Decimal(2_000_000),
      consumed: 2,
    });
    expect(read("zwei", "Millionen", "fünfhunderttausend")).toEqual({
      value: new Decimal(2_500_000),
      consumed: 3,
    });
  });

  test("Billion is 10^12, the long scale", () => {
    // The single likeliest error in a German numeral table: Milliarde is the
    // 10^9 English calls a billion, and Billion is a thousand times that.
    expect(read("eine", "Milliarde")?.value.toString()).toBe("1000000000");
    expect(read("eine", "Billion")?.value.toString()).toBe("1000000000000");
    expect(CARDINALS.scales.map((s) => [s.singular, s.value])).toEqual([
      ["Million", 1_000_000],
      ["Milliarde", 1_000_000_000],
      ["Billion", 1_000_000_000_000],
    ]);
  });
});

describe("german spells back through the same tables", () => {
  test.each([
    [0, "null"],
    // "ein", not "eins": every magnitude this speller produces stands in front
    // of a unit noun, and "eins" is the counting one, which never does. It is
    // the right word for a masculine or neuter noun and the wrong one for a
    // feminine — see `the gender agreement this seam cannot reach` below.
    [1, "ein"],
    [12, "zwölf"],
    [16, "sechzehn"],
    // The row `cardinalSpeller` got backwards — it wrote "zwanzig ein", wrong
    // order and wrong spacing at once.
    [21, "einundzwanzig"],
    [35, "fünfunddreißig"],
    [99, "neunundneunzig"],
    // The multiplier is always written, so "einhundert" and "zweihundert" read
    // as one convention rather than two.
    [100, "einhundert"],
    [105, "einhundertfünf"],
    [345, "dreihundertfünfundvierzig"],
    [1000, "eintausend"],
    [345_678, "dreihundertfünfundvierzigtausendsechshundertachtundsiebzig"],
    // Feminine agreement, the only place in the speller where 1 is not "ein":
    // Million, Milliarde and Billion are all feminine nouns.
    [1_000_000, "eine Million"],
    [2_000_000, "zwei Millionen"],
    [2_500_000, "zwei Millionen fünfhunderttausend"],
    [1_000_000_000, "eine Milliarde"],
  ])("%d spells as %s", (value, expected) => {
    expect(spell(value)).toBe(expected);
  });

  test("declines exactly where the tables run out", () => {
    // The same three refusals `cardinalSpeller` documents: no fractional
    // grammar in the tables, no sign in the numeral fold, and nothing above
    // 1000 x the largest declared scale (a Billiarde is real German and is not
    // in the table, so composing one would be inventing a word).
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(spell(1e15)).toBeNull();
  });

  test("the speller writes the masculine 1 and leaves agreement to the renderer", () => {
    // The division of labour `agree` exists for: a `NumeralSpeller` is handed a
    // magnitude and no noun, so `ein` is the only answer it can give. What makes
    // the rewrite possible rather than a guess is that `eine` is a declared
    // reading of 1 in the same tables, so a feminised numeral still parses.
    expect(spell(1)).toBe("ein");
    expect(CARDINALS.standalone.eine).toBe(1);
    expect(read("eine")?.value.toString()).toBe("1");
  });

  test("every spelling round-trips through the parser", () => {
    // The property the one-table-two-directions layout exists to guarantee, run
    // over a spread wide enough to reach every branch of both directions.
    const sample = [
      0, 1, 2, 9, 10, 11, 12, 13, 16, 17, 19, 20, 21, 30, 35, 40, 55, 70, 99, 100, 101,
      105, 121, 200, 345, 999, 1000, 1001, 2200, 100_000, 345_678, 999_999, 1_000_000,
      2_000_000, 2_500_000, 1_000_000_000, 1_000_000_000_000,
    ];
    const problems: string[] = [];
    for (const n of sample) {
      const written = spell(n);
      if (written === null || written === undefined) {
        problems.push(`${n} does not spell`);
        continue;
      }
      const back = read(...written.split(" "));
      if (back === null || back === undefined || !back.value.equals(n)) {
        problems.push(`${n} spelled "${written}" and read back as ${back?.value}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

/**
 * The analyzer chain, which is where the two things German stresses that no
 * other shipped language does actually live: a compound no vocabulary could
 * enumerate, and a capital on every noun.
 *
 * Asserted on the chain rather than through an engine because a `Language`
 * ships no words: what a split *resolves to* is the alias index's business, and
 * the index is built from vocabularies this file has never seen. What is
 * German's own business is which forms the chain offers and at what weight.
 */
describe("the analyzer chain", () => {
  const analyze = createAnalyzerChain(german);
  const forms = (surface: string) => analyze(surface).map((a) => a.form);

  test("identity offers the word as typed, unfolded", () => {
    // Load-bearing: without it the language cannot reach its own aliases at
    // all, and `Zentimeter` reads as the splitter's `meter` instead — a wrong
    // answer rather than an error.
    expect(forms("Zentimeter")).toContain("Zentimeter");
  });

  test("a compound is read by its head, at a penalty", () => {
    // Right-headed: `Bandmeter` is a metre, `Meterband` is a band. The
    // compound no vocabulary would list, which is the whole reason the splitter
    // is here.
    expect(forms("Bandmeter")).toContain("meter");
    expect(forms("Quadratmeter")).toContain("meter");
    // The penalty is what makes the splitter safe beside a vocabulary that
    // lists the common compounds: `Kilometer` is both an alias (offered by
    // identity at 0) and contains `meter` (offered by the split at -3), and the
    // resolver keeps the kilometre.
    const split = analyze("Kilometer").find((a) => a.form === "meter");
    expect(split?.weight).toBe(-3);
    expect(analyze("Kilometer").find((a) => a.form === "Kilometer")?.weight).toBe(0);
  });

  test("a dative plural head is listed as a head of its own", () => {
    // The chain does not iterate — every analyzer sees the same original
    // surface — so the `-n` the suffix stripper would take off never reaches
    // the splitter. `metern` is therefore a head in `COMPOUND_HEADS` and not a
    // consequence of one.
    expect(forms("Quadratmetern")).toContain("metern");
  });

  test("a word that merely starts the same way is not a compound", () => {
    // "Zentrum" is a town centre. Nothing it ends in is a measurement head, so
    // the refusal is structural rather than a special case — and it is the
    // reason `compoundSplitter` takes a vocabulary instead of a prefix list.
    expect(forms("Zentrum")).toEqual(["Zentrum"]);
  });

  test.each([
    ["Bandmeter", "meter"],
    ["bandmeter", "meter"],
    ["BANDMETER", "meter"],
    ["bAnDmEtEr", "meter"],
  ])("%s splits to %s whatever the case", (surface, head) => {
    // Every German noun is capitalised, so a unit word arrives with a capital
    // in prose and without one in a search box. The splitter folds both its
    // vocabulary and its input because it has to compare them before any form
    // exists to be folded downstream.
    expect(forms(surface)).toContain(head);
  });

  test("the suffix stripper takes the endings a unit noun actually takes", () => {
    expect(forms("Tonnen")).toContain("Tonne");
    expect(forms("Metern")).toContain("Meter");
    expect(forms("Bytes")).toContain("Byte");
    expect(forms("Grade")).toContain("Grad");
    // `minStem: 3` keeps it off the two-letter symbols German writes units
    // with, which a stripper would otherwise shred into single letters.
    expect(forms("kg")).toEqual(["kg"]);
    expect(forms("cm")).toEqual(["cm"]);
  });

  test("the heads left out stay out", () => {
    // Each of these three is an ordinary German word that a careless head list
    // turns into a measurement: -bar is the productive adjective suffix, every
    // weekday ends in -tag, and -grad ends a row of place names.
    expect(forms("wunderbar")).toEqual(["wunderbar"]);
    expect(forms("Montag")).toEqual(["Montag"]);
    expect(forms("Belgrad")).toEqual(["Belgrad"]);
  });
});

/**
 * The keyword rulings as behaviour rather than as array contents, because an
 * array says nothing about whether "geteilt durch" survives `foldWordOps` — and
 * that fold is exactly where the German division split can go wrong.
 *
 * `LENGTH_FIXTURE` is a fixture, not a shipped vocabulary: German's real words
 * for `length` belong to `@smartput/length/locale/de`, and a `Language` may not
 * contain one. Three units are enough to write a sentence in, which is all this
 * needs.
 */
describe("through a real engine", () => {
  const words = (nom: string, dat: string) => ({
    aliases: [nom.toLowerCase(), dat.toLowerCase()],
    symbol: nom === "Meter" ? "m" : nom === "Zentimeter" ? "cm" : "km",
    forms: {
      "nom-one": nom,
      "nom-other": nom,
      "dat-one": nom,
      "dat-other": dat,
    },
  });
  const LENGTH_FIXTURE = defineVocabulary({
    locale: "de",
    kind: "length",
    units: {
      m: words("Meter", "Metern"),
      cm: words("Zentimeter", "Zentimetern"),
      km: words("Kilometer", "Kilometern"),
    },
  });
  const engine = createEngine({
    locales: [composeLocale(german, [LENGTH_FIXTURE])],
    kinds: BUILTIN_KINDS,
    format: "de",
  });
  const evaluate = (input: string) => engine.evaluate(input).formatted;

  test.each([
    // The compound the vocabulary above does not list at all, read by its head.
    ["10 Bandmeter", "10 Meter"],
    // The exact alias outranks the `meter` inside it.
    ["10 Kilometer", "10 Kilometer"],
    // A dative-plural head, which reaches the index only because `metern` is a
    // head in its own right.
    ["10 Quadratmetern", "10 Meter"],
    // The group separator and the decimal comma, from `numberFormat: "intl"`.
    ["10 Kilometer in Meter", "10.000 Meter"],
    ["1,5 Meter", "1,5 Meter"],
    // German's own numerals, through the engine: one token, units before tens.
    ["einundzwanzig Meter", "21 Meter"],
    ["zwei Millionen Meter", "2.000.000 Meter"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test.each([
    ["10 Meter plus 5 Meter", "15 Meter"],
    ["10 Meter minus 2 Meter", "8 Meter"],
    ["10 Meter mal 2", "20 Meter"],
    // "geteilt durch" and "dividiert durch" are each one operator: the verb is
    // the `over` and `foldWordOps` swallows the "durch" after it, exactly as it
    // swallows English's "by" after "divided".
    ["10 Meter geteilt durch 2", "5 Meter"],
    ["10 Meter dividiert durch 2", "5 Meter"],
    ["1 Kilometer nach Meter", "1.000 Meter"],
    ["1 Kilometer zu Meter", "1.000 Meter"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test("a bare durch does not divide, which is the cost of the ruling", () => {
    // Stated rather than hidden. "durch" is claimed as `by`, and a stray `by`
    // fails at the parser — the same way English's "10 by 2" fails, and for the
    // same reason. The alternative made the commoner "geteilt durch" emit two
    // division operators in a row.
    expect(() => engine.evaluate("10 Meter durch 2")).toThrow();
  });
});

describe("renderQuantity", () => {
  const render = (parts: Parameters<NonNullable<typeof german.renderQuantity>>[0]) =>
    german.renderQuantity?.(parts);
  const base = { number: "5", kind: "mass", unit: "kg", slot: "bare" as Slot };

  test("a symbol is spaced, which is DIN 1301 and not English's tight 5kg", () => {
    expect(render({ ...base, symbol: "kg" })).toBe("5 kg");
  });

  test("a word is spaced exactly as the default already does", () => {
    expect(render({ ...base, form: "Kilogramm", symbol: "kg" })).toBe("5 Kilogramm");
    expect(render({ ...base, alias: "Kilogramm" })).toBe("5 Kilogramm");
  });

  test("a caller's own gap still wins on both branches", () => {
    // `Printer.spacing` is a typographic choice of the caller's, so it has to
    // reach a language that assembles its own quantities.
    expect(render({ ...base, symbol: "kg", gap: "" })).toBe("5kg");
    expect(render({ ...base, form: "Kilogramm", gap: " " })).toBe("5 Kilogramm");
  });

  test("with nothing to print it degrades to the unit key", () => {
    // I10's graceful degradation, unchanged: a half-translated engine renders
    // awkwardly rather than throwing.
    expect(render(base)).toBe("5 kg");
  });

  /**
   * Gender agreement, which is the other thing this override is for and the one
   * no other seam could have carried: `NumeralSpeller` gets a magnitude and no
   * noun, `selectForm` gets a count and a slot and no noun, and gender is a
   * property of the noun alone. Every row below is a word this repo actually
   * prints, so the sweep is over the real vocabularies rather than over
   * invented nouns.
   */
  describe("a spelled 1 agrees in gender with the noun", () => {
    const one = (form: string) =>
      render({ number: "ein", kind: "length", unit: "m", slot: "bare" as Slot, form });

    test.each([
      // The feminines. `-e` on the noun, `-ung` on the one derived stem.
      ["Meile", "eine Meile"],
      ["Tonne", "eine Tonne"],
      ["Unze", "eine Unze"],
      ["Gallone", "eine Gallone"],
      ["Stunde", "eine Stunde"],
      ["Minute", "eine Minute"],
      ["Millisekunde", "eine Millisekunde"],
      ["Woche", "eine Woche"],
      ["Kilowattstunde", "eine Kilowattstunde"],
      ["Kilokalorie", "eine Kilokalorie"],
      ["Pferdestärke", "eine Pferdestärke"],
      ["Umdrehung", "eine Umdrehung"],
      // Masculine and neuter, which must not move.
      ["Meter", "ein Meter"],
      ["Kilogramm", "ein Kilogramm"],
      ["Tag", "ein Tag"],
      ["Zoll", "ein Zoll"],
      ["Knoten", "ein Knoten"],
      ["Watt", "ein Watt"],
      ["Hektar", "ein Hektar"],
      ["Pica", "ein Pica"],
      // The `-e` loans that keep the neuter, which is what `NEUTER_IN_E` is
      // for and the one place the ending rule needs an exception named.
      ["Byte", "ein Byte"],
      ["Tebibyte", "ein Tebibyte"],
      ["Joule", "ein Joule"],
      ["Megajoule", "ein Megajoule"],
      ["Acre", "ein Acre"],
    ])("ein %s renders as %s", (form, expected) => {
      expect(one(form)).toBe(expected);
    });

    test("a compound numeral is never feminised, because its `ein` is infixed", () => {
      // "eineundzwanzig" is not a German word. German writes every numeral below
      // a million as one token and only a *bare* `ein` agrees, which is why the
      // guard is an equality and not a suffix test.
      const with_ = (number: string, form: string) =>
        render({ number, kind: "length", unit: "mi", slot: "bare" as Slot, form });
      expect(with_("einundzwanzig", "Meilen")).toBe("einundzwanzig Meilen");
      expect(with_("einhundert", "Meilen")).toBe("einhundert Meilen");
      expect(with_("eintausend", "Meilen")).toBe("eintausend Meilen");
      // And the case that made the suffix test wrong: `Tage` and `Grade` are
      // masculine plurals ending in `-e`, and the ending rule cannot tell them
      // from `Meile`. Restricting to the bare `ein` keeps them out of reach.
      expect(with_("einhundertein", "Tage")).toBe("einhundertein Tage");
      expect(with_("einhundertein", "Grade")).toBe("einhundertein Grade");
    });

    test("a scale noun already agrees, and digits are untouched", () => {
      const with_ = (number: string, form: string) =>
        render({ number, kind: "length", unit: "mi", slot: "bare" as Slot, form });
      // `germanSpeller` writes "eine Million" because `Million` is feminine;
      // the unit noun is behind it and has nothing left to correct.
      expect(with_("eine Million", "Meilen")).toBe("eine Million Meilen");
      // The ordinary path, byte for byte: a digit string is never the word.
      expect(with_("1", "Meile")).toBe("1 Meile");
      expect(with_("1,5", "Meilen")).toBe("1,5 Meilen");
    });

    test("an alias is not a noun this language wrote, so it is left alone", () => {
      // `form` is a word from a German `forms` table and its ending means what
      // `isFeminine` reads into it; `alias` is whatever spelling keyed the index.
      expect(
        render({
          number: "ein",
          kind: "length",
          unit: "mi",
          slot: "bare" as Slot,
          alias: "meile",
        }),
      ).toBe("ein meile");
    });
  });
});
