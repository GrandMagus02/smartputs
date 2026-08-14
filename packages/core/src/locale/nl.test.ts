import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import type { Slot } from "../types";
import { createAnalyzerChain } from "./analyze";
import { composeLocale } from "./compose";
import { dutch } from "./nl";
import { CARDINALS } from "./nl-cardinals";
import { numberSymbols } from "./number";
import { defineVocabulary } from "./vocabulary";

const form = (n: number, slot: Slot = "bare") =>
  dutch.selectForm({ count: new Decimal(n), kind: "length", unit: "m", slot });

const read = (...words: string[]) => dutch.numerals?.(words);
const spell = (n: number) => dutch.spell?.(new Decimal(n));

describe("dutch", () => {
  test("keys are the plural category alone, and there are exactly two", () => {
    expect(dutch.id).toBe("nl");
    // Dutch's CLDR grammar has two categories and no more, and nothing else
    // enters the key — so the key set is closed at two, which is the contract
    // every Dutch `Vocabulary` keys its `forms` table off.
    expect(new Intl.PluralRules("nl").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);

    const keys = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as Slot[]) {
      for (const n of [0, 1, 1.5, 2, 5, 21, 100, 1_000_000]) keys.add(form(n, slot));
      keys.add(dutch.selectForm({ kind: "length", unit: "m", slot }));
    }
    expect([...keys].sort()).toEqual(["one", "other"]);
  });

  test("count picks the key and nothing else does", () => {
    expect(form(1)).toBe("one");
    expect(form(2)).toBe("other");
    // Zero is `other` in Dutch — "0 kilometer" is marked like any other non-one
    // — unlike French, where it agrees with the singular.
    expect(form(0)).toBe("other");
    // A fraction is `other` too, which is why "1,5 meter" and "7 meter" select
    // the same row even though only one of them is a plural in any real sense.
    expect(form(1.5)).toBe("other");
  });

  test("the slot is inert, which is the German axis Dutch does not have", () => {
    // `de.ts` reads the slot because German's `in` governs the dative. Dutch
    // lost case marking on common nouns, so `in`, `naar` and `van` govern
    // nothing and a conversion target is spelled exactly like a bare quantity.
    // A key that moved with the slot here would double every table in the
    // language to hold two copies of one word.
    expect(form(1, "conversion-target")).toBe("one");
    expect(form(5, "conversion-target")).toBe("other");
    expect(form(5, "after-number")).toBe("other");
  });

  test("a count-free conversion target still names a key", () => {
    // Ruling R5: "1 km naar meter" has no magnitude to agree "meter" with, and
    // the row still has to exist. `other` is the category CLDR requires every
    // locale to define as its generic one.
    expect(
      dutch.selectForm({ kind: "length", unit: "m", slot: "conversion-target" }),
    ).toBe("other");
  });

  test("takes its number symbols from CLDR", () => {
    // Both are visible characters here, unlike Ukrainian's U+00A0 group
    // separator — so they are written as themselves. They are German's pair and
    // the exact inverse of English's, which is the fact a reader of this file
    // most needs pinned: under this language "1.500" is fifteen hundred and
    // "1,5" is three halves.
    expect(numberSymbols(dutch)).toEqual({ group: ".", decimal: "," });
  });

  test("claims the conversion keywords", () => {
    expect(dutch.keywords.in).toEqual(["in", "naar"]);
    expect(dutch.keywords.of).toEqual(["van"]);
    // Spelled out, and "min" deliberately not claimed beside it: "min" is the
    // SI symbol for the minute that `@smartput/duration`'s `units.ts` ships as a
    // language-neutral alias, and a keyword surface is consumed by `lex` before
    // any alias index is consulted — in every installed language at once, since
    // `buildKeywords` folds them into one table. See the comment on the entry.
    expect(dutch.keywords.minus).toEqual(["minus"]);
    expect(dutch.keywords.minus).not.toContain("min");
    // The arithmetic word and the spoken one, both bare multipliers.
    expect(dutch.keywords.times).toEqual(["maal", "keer"]);
    // The division split: the participle is the operator, the preposition after
    // it is the particle `foldWordOps` swallows into the same token.
    expect(dutch.keywords.over).toEqual(["gedeeld"]);
    expect(dutch.keywords.by).toEqual(["door"]);
    // Claimed by neither, on purpose: a Dutch discount needs a preposition
    // ("20% korting op 50") that a one-token keyword cannot carry.
    expect(dutch.keywords.off).toBeUndefined();
  });

  test("no surface word is claimed for two different keywords", () => {
    // The check `buildKeywords` would make at boot, made here on one language
    // alone so a conflict inside this table is a Dutch test failure rather than
    // an engine one. "door" under both `over` and `by` is the specific mistake
    // this guards.
    const seen = new Map<string, string>();
    for (const [keyword, words] of Object.entries(dutch.keywords)) {
      for (const word of words ?? []) {
        expect(seen.get(word) ?? keyword).toBe(keyword);
        seen.set(word, keyword);
      }
    }
  });
});

/**
 * Dutch writes every numeral below a million as one token, ones before tens,
 * with no spaces anywhere. These are the rows `third-language.test.ts` recorded
 * as things the shared `cardinalNumerals`/`cardinalSpeller` cannot do, and they
 * pass here because Dutch ships its own tables in `nl-cardinals.ts`.
 */
describe("dutch numerals decompose a single token", () => {
  test.each([
    ["nul", 0],
    ["een", 1],
    // The accented spelling, which is what separates the numeral from the
    // identical indefinite article.
    ["één", 1],
    ["twaalf", 12],
    // The two metathesised teens: dertien and veertien, not *drietien* or
    // *viertien*.
    ["dertien", 13],
    ["veertien", 14],
    // The tens word that starts with a letter belonging to no other word in the
    // table.
    ["tachtig", 80],
    // Ones before tens, glued by an infixed "en". This is the row the shared
    // helper returns null for.
    ["eenentwintig", 21],
    // The trema, and the unaccented spelling of the same number.
    ["tweeëntwintig", 22],
    ["tweeentwintig", 22],
    ["drieëntwintig", 23],
    ["negenennegentig", 99],
    // The multiplier before "honderd" may be omitted, and in Dutch it usually
    // is, so both spellings of 100 read.
    ["honderd", 100],
    ["eenhonderd", 100],
    ["honderdvijf", 105],
    ["honderdeenentwintig", 121],
    ["tweehonderd", 200],
    // Dutch counts in hundreds well past nine, which is why the head before
    // "honderd" is a whole sub-100 value and not a single ones word.
    ["negentienhonderd", 1900],
    // "duizend" is the second multiplying morpheme, and the head before it is
    // itself a sub-1000 compound.
    ["duizend", 1000],
    ["tweeduizend", 2000],
    ["tweeduizenddriehonderd", 2300],
    ["honderdduizend", 100_000],
    ["driehonderdvijfenveertigduizendzeshonderdachtenzeventig", 345_678],
  ])("%s is %d", (word, value) => {
    expect(read(word)).toEqual({ value: new Decimal(value), consumed: 1 });
  });

  test("the infix is found from the tens word, not from the left", () => {
    // German splits `einundzwanzig` on `word.indexOf("und")` because no German
    // numeral contains `und` but `hundert`. Dutch's infix is `en`, which sits
    // inside `zeven`, `negen` and `duizend` — so the same trick would read
    // "zevenentwintig" as `zev` + `twintig` and refuse a word it reads
    // perfectly well. Anchoring on the tens word at the end cannot be fooled.
    expect(read("zevenentwintig")?.value.toString()).toBe("27");
    expect(read("negenentachtig")?.value.toString()).toBe("89");
    expect(read("duizend")?.value.toString()).toBe("1000");
  });

  test("a spaced numeral is not a Dutch numeral", () => {
    // The mirror of the row above, and the reason "en" is not declared as a
    // connector: Dutch has no spaced numerals below a million, so this claims
    // the 1 and stops rather than reading 21 out of a spelling Dutch does not
    // have.
    expect(read("een", "en", "twintig")).toEqual({ value: new Decimal(1), consumed: 1 });
    // Two compounds in a row are two numbers, not one sum: claiming both would
    // silently eat the token after every "300 2" the engine ever sees.
    expect(read("driehonderd", "twee")).toEqual({
      value: new Decimal(300),
      consumed: 1,
    });
  });

  test("nothing at all is a refusal, not a zero", () => {
    expect(read("kilometer")).toBeNull();
    expect(read("en")).toBeNull();
  });

  test("the scale nouns are the one place Dutch puts a space", () => {
    expect(read("twee", "miljoen")).toEqual({
      value: new Decimal(2_000_000),
      consumed: 2,
    });
    expect(read("één", "miljoen")).toEqual({
      value: new Decimal(1_000_000),
      consumed: 2,
    });
    expect(read("twee", "miljoen", "vijfhonderdduizend")).toEqual({
      value: new Decimal(2_500_000),
      consumed: 3,
    });
    // Invariant after a numeral, so there is one form and not German's
    // singular/plural pair: "twee miljoen", never "twee miljoenen".
    expect(read("twee", "miljoenen")).toEqual({ value: new Decimal(2), consumed: 1 });
  });

  test("biljoen is 10^12, the long scale", () => {
    // The likeliest error in a Dutch numeral table: miljard is the 10^9 English
    // calls a billion, and biljoen is a thousand times that.
    expect(read("één", "miljard")?.value.toString()).toBe("1000000000");
    expect(read("één", "biljoen")?.value.toString()).toBe("1000000000000");
    expect(CARDINALS.scales.map((s) => [s.word, s.value])).toEqual([
      ["miljoen", 1_000_000],
      ["miljard", 1_000_000_000],
      ["biljoen", 1_000_000_000_000],
    ]);
  });
});

describe("dutch spells back through the same tables", () => {
  test.each([
    [0, "nul"],
    // The accented one, and the only magnitude whose spelling depends on
    // standing alone: every number this speller produces sits in front of a
    // unit noun, which is exactly the position the accents exist for.
    [1, "één"],
    [12, "twaalf"],
    [21, "eenentwintig"],
    // The trema goes on the infix after a vowel-final ones word, and only
    // there.
    [22, "tweeëntwintig"],
    [23, "drieëntwintig"],
    [45, "vijfenveertig"],
    [80, "tachtig"],
    [99, "negenennegentig"],
    // The multiplier one is dropped, which is the opposite of German's always-
    // written "einhundert" — a printed "eenhonderd" would read as a translation
    // rather than as Dutch.
    [100, "honderd"],
    [105, "honderdvijf"],
    [121, "honderdeenentwintig"],
    [345, "driehonderdvijfenveertig"],
    [1000, "duizend"],
    [1001, "duizendeen"],
    [2300, "tweeduizenddriehonderd"],
    [100_000, "honderdduizend"],
    [345_678, "driehonderdvijfenveertigduizendzeshonderdachtenzeventig"],
    // The scale nouns, which are the one place a space appears — and the one
    // place the accented "één" comes back, because there the multiplier is a
    // free word again.
    [1_000_000, "één miljoen"],
    [2_000_000, "twee miljoen"],
    [2_500_000, "twee miljoen vijfhonderdduizend"],
    [1_000_000_000, "één miljard"],
  ])("%d spells as %s", (value, expected) => {
    expect(spell(value)).toBe(expected);
  });

  test("declines exactly where the tables run out", () => {
    // The same three refusals `cardinalSpeller` documents: no fractional
    // grammar in the tables, no sign in the numeral fold, and nothing above
    // 1000 x the largest declared scale (a biljard is real Dutch and is not in
    // the table, so composing one would be inventing a word).
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(spell(1e15)).toBeNull();
  });

  test("every spelling round-trips through the parser", () => {
    // The property the one-table-two-directions layout exists to guarantee, run
    // over a spread wide enough to reach every branch of both directions.
    const sample = [
      0, 1, 2, 9, 10, 11, 12, 13, 14, 16, 19, 20, 21, 22, 23, 30, 45, 70, 80, 99, 100,
      101, 105, 121, 200, 345, 999, 1000, 1001, 2300, 100_000, 345_678, 999_999,
      1_000_000, 2_000_000, 2_500_000, 1_000_000_000, 1_000_000_000_000,
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
 * The analyzer chain, which is where the one German stress Dutch shares lives: a
 * compound no vocabulary could enumerate.
 *
 * Asserted on the chain rather than through an engine because a `Language` ships
 * no words: what a split *resolves to* is the alias index's business, and the
 * index is built from vocabularies this file has never seen. What is Dutch's own
 * business is which forms the chain offers and at what weight.
 */
describe("the analyzer chain", () => {
  const analyze = createAnalyzerChain(dutch);
  const forms = (surface: string) => analyze(surface).map((a) => a.form);

  test("identity offers the word as typed", () => {
    // Load-bearing: without it the language cannot reach its own aliases at all,
    // and `kilometer` reads as the splitter's `meter` instead — a wrong answer
    // rather than an error.
    expect(forms("kilometer")).toContain("kilometer");
  });

  test("a compound is read by its head, at a penalty", () => {
    // Right-headed: `bandmeter` is a metre, `meterband` is a tape. The compound
    // no vocabulary would list, which is the whole reason the splitter is here.
    expect(forms("bandmeter")).toContain("meter");
    expect(forms("vierkantemeter")).toContain("meter");
    expect(forms("kubiekemeter")).toContain("meter");
    expect(forms("zeemijl")).toContain("mijl");
    // The penalty is what makes the splitter safe beside a vocabulary that
    // lists the common compounds: `kilometer` is both an alias (offered by
    // identity at 0) and contains `meter` (offered by the split at -3), and the
    // resolver keeps the kilometre.
    expect(analyze("kilometer").find((a) => a.form === "meter")?.weight).toBe(-3);
    expect(analyze("kilometer").find((a) => a.form === "kilometer")?.weight).toBe(0);
  });

  test("a counted plural head is listed as a head of its own", () => {
    // The chain does not iterate — every analyzer sees the same original
    // surface — so the `-s` the suffix stripper would take off never reaches the
    // splitter. `meters` is therefore a head in `COMPOUND_HEADS` and not a
    // consequence of one.
    expect(forms("vierkantemeters")).toContain("meters");
  });

  test("no capital is needed anywhere, because Dutch capitalises no noun", () => {
    // The German stress this language does not share, asserted rather than
    // assumed: a Dutch unit word is lowercase in prose and in a search box
    // alike. The splitter folds both sides anyway, so a shouted input still
    // reads — but nothing here depends on it the way `de.test.ts` does.
    expect(forms("BANDMETER")).toContain("meter");
    expect(forms("BandMeter")).toContain("meter");
  });

  test("the heads left out stay out", () => {
    // Each of these is an ordinary Dutch word that a careless head list turns
    // into a measurement. `zaterdag` is German's weekday problem intact;
    // `temperatuur` is the -tuur class that costs Dutch its hour; `beton` is
    // blocked by `minPart` rather than by the list, its head being two letters.
    expect(forms("zaterdag")).not.toContain("dag");
    expect(forms("temperatuur")).not.toContain("uur");
    expect(forms("beton")).not.toContain("ton");
  });

  test("the heads German leaves out that Dutch keeps do not collide here", () => {
    // German excludes `bar` because `-bar` is its adjective suffix. Dutch spells
    // that suffix `-baar`, so the collision cannot occur — which is why the
    // pressure unit is a head in this language and not in that one.
    expect(forms("zichtbaar")).not.toContain("bar");
    expect(forms("millibar")).toContain("bar");
    // The same argument for `graad`: the `-grad` place names German avoids are
    // spelled with a short vowel and the unit with a long one.
    expect(forms("celsiusgraad")).toContain("graad");
  });

  test("the suffix stripper takes the endings a Dutch unit noun actually takes", () => {
    expect(forms("meters")).toContain("meter");
    expect(forms("seconden")).toContain("seconde");
    // The apostrophe plural of a vowel-final noun, which no other language here
    // has to strip.
    expect(forms("kilo's")).toContain("kilo");
    // `minStem: 3` keeps it off the two-letter symbols Dutch writes units with,
    // which a stripper would otherwise shred into single letters.
    expect(forms("kg")).toEqual(["kg"]);
    expect(forms("cm")).toEqual(["cm"]);
  });

  test("the -en plural is deliberately not stripped", () => {
    // The Dutch-specific finding: `-en` looks like a suffix and is not one. It
    // shortens an open syllable (jaar -> jaren, uur -> uren) or doubles a
    // consonant (ton -> tonnen), so stripping it yields a stem that is not the
    // singular in exactly the cases the rule would be needed for. Those plurals
    // are compound heads and vocabulary aliases instead.
    expect(forms("jaren")).not.toContain("jar");
    expect(forms("tonnen")).not.toContain("tonn");
  });
});

/**
 * The keyword and numeral rulings as behaviour rather than as array contents,
 * because an array says nothing about whether "gedeeld door" survives
 * `foldWordOps` — and that fold is exactly where the Dutch division split can go
 * wrong.
 *
 * `LENGTH_FIXTURE` is a fixture, not a shipped vocabulary: Dutch's real words
 * for `length` belong to `@smartput/length/locale/nl`, and a `Language` may not
 * contain one. Three units are enough to write a sentence in, which is all this
 * needs.
 */
describe("through a real engine", () => {
  const LENGTH_FIXTURE = defineVocabulary({
    locale: "nl",
    kind: "length",
    units: {
      // Every measure noun here is invariant after a numeral — "tien meter",
      // never "tien meters" — so `one` and `other` carry the same word. That is
      // the Dutch rule and not a table stopping halfway; a unit whose plural is
      // actually marked (minuut/minuten) would fill the two rows differently.
      m: {
        aliases: ["meter", "meters", "m"],
        symbol: "m",
        forms: { one: "meter", other: "meter" },
      },
      cm: {
        aliases: ["centimeter", "centimeters", "cm"],
        symbol: "cm",
        forms: { one: "centimeter", other: "centimeter" },
      },
      km: {
        aliases: ["kilometer", "kilometers", "km"],
        symbol: "km",
        forms: { one: "kilometer", other: "kilometer" },
      },
    },
  });
  const engine = createEngine({
    locales: [composeLocale(dutch, [LENGTH_FIXTURE])],
    kinds: BUILTIN_KINDS,
    format: "nl",
  });
  const evaluate = (input: string) => engine.evaluate(input).formatted;

  test.each([
    // The compound the vocabulary above does not list at all, read by its head.
    ["10 bandmeter", "10 meter"],
    ["10 vierkantemeter", "10 meter"],
    // The exact alias outranks the `meter` inside it.
    ["10 kilometer", "10 kilometer"],
    // A counted plural head, which reaches the index only because `meters` is a
    // head in its own right.
    ["10 vierkantemeters", "10 meter"],
    // The group separator and the decimal comma, from `numberFormat: "intl"`.
    ["10 kilometer in meter", "10.000 meter"],
    ["1,5 meter", "1,5 meter"],
    // Dutch's own numerals, through the engine: one token, ones before tens.
    ["eenentwintig meter", "21 meter"],
    ["tweeëntwintig meter", "22 meter"],
    ["twee miljoen meter", "2.000.000 meter"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test.each([
    ["10 meter plus 5 meter", "15 meter"],
    ["10 meter minus 2 meter", "8 meter"],
    ["10 meter maal 2", "20 meter"],
    ["10 meter keer 2", "20 meter"],
    // "gedeeld door" is one operator: the participle is the `over` and
    // `foldWordOps` swallows the "door" after it, exactly as it swallows
    // English's "by" after "divided".
    ["10 meter gedeeld door 2", "5 meter"],
    ["1 kilometer naar meter", "1.000 meter"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test("a bare door does not divide, which is the cost of the ruling", () => {
    // Stated rather than hidden. "door" is claimed as `by`, and a stray `by`
    // fails at the parser — the same way English's "10 by 2" fails, and for the
    // same reason. The alternative made the commoner "gedeeld door" emit two
    // division operators in a row.
    expect(() => engine.evaluate("10 meter door 2")).toThrow();
  });
});

describe("renderQuantity", () => {
  const render = (parts: Parameters<NonNullable<typeof dutch.renderQuantity>>[0]) =>
    dutch.renderQuantity?.(parts);
  const base = { number: "5", kind: "mass", unit: "kg", slot: "bare" as Slot };

  test("a symbol is spaced, which is SI and not English's tight 5kg", () => {
    expect(render({ ...base, symbol: "kg" })).toBe("5 kg");
  });

  test("a word is spaced exactly as the default already does", () => {
    expect(render({ ...base, form: "kilogram", symbol: "kg" })).toBe("5 kilogram");
    expect(render({ ...base, alias: "kilogram" })).toBe("5 kilogram");
  });

  test("a caller's own gap still wins on both branches", () => {
    // `Printer.spacing` is a typographic choice of the caller's, so it has to
    // reach a language that assembles its own quantities.
    expect(render({ ...base, symbol: "kg", gap: "" })).toBe("5kg");
    expect(render({ ...base, form: "kilogram", gap: " " })).toBe("5 kilogram");
  });

  test("with nothing to print it degrades to the unit key", () => {
    // I10's graceful degradation, unchanged: a half-translated engine renders
    // awkwardly rather than throwing.
    expect(render(base)).toBe("5 kg");
  });
});
