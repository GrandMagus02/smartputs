import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { buildRegistry } from "../kind/registry";
import { createResolver } from "../parse/candidates";
import { Normalizer } from "../parse/normalize";
import { Parser } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Printer } from "../print/print";
import { Solver } from "../solve/solver-class";
import type { Slot } from "../types";
import { createAnalyzerChain } from "./analyze";
import { composeLocale } from "./compose";
import { numberSymbols } from "./number";
import { polish } from "./pl";
import { CARDINALS } from "./pl-cardinals";
import { defineVocabulary } from "./vocabulary";

const form = (n: number, slot: Slot = "bare") =>
  polish.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

const read = (...words: string[]) => polish.numerals?.(words);
const spell = (n: number) => polish.spell?.(new Decimal(n));

describe("polish", () => {
  test("keys are case x plural category, and there are exactly eight", () => {
    expect(polish.id).toBe("pl");
    // Polish's CLDR grammar declares four categories, so two slots' cases times
    // those four closes the key set at eight — the contract every Polish
    // `Vocabulary` keys its `forms` table off.
    expect(new Intl.PluralRules("pl").resolvedOptions().pluralCategories.sort()).toEqual([
      "few",
      "many",
      "one",
      "other",
    ]);

    const keys = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as Slot[]) {
      for (const n of [0, 1, 1.5, 2, 5, 12, 21, 22, 102, 112, 1000, 1_000_000]) {
        keys.add(form(n, slot));
      }
      keys.add(polish.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    expect([...keys].sort()).toEqual([
      "loc-few",
      "loc-many",
      "loc-one",
      "loc-other",
      "nom-few",
      "nom-many",
      "nom-one",
      "nom-other",
    ]);
  });

  test("count picks the category, and 21 is where Polish leaves Ukrainian", () => {
    expect(form(1)).toBe("nom-one");
    expect(form(2)).toBe("nom-few");
    expect(form(4)).toBe("nom-few");
    expect(form(5)).toBe("nom-many");
    // Zero is `many` in Polish — "0 kilogramów", the genitive plural — not the
    // `other` an English reader expects and not a category of its own.
    expect(form(0)).toBe("nom-many");
    // The 12–14 band, which suspends the "ends in 2–4" rule: 12 agrees like 5,
    // and 22 goes back to agreeing like 2.
    expect(form(12)).toBe("nom-many");
    expect(form(14)).toBe("nom-many");
    expect(form(22)).toBe("nom-few");
    expect(form(112)).toBe("nom-many");
    expect(form(102)).toBe("nom-few");
    // **The row this language exists beside Ukrainian to pin.** Polish counts 21
    // by its final 1 the way it counts 5 — "dwadzieścia jeden kilogramów",
    // genitive plural — where `uk.test.ts` asserts "nom-one" for the same
    // number. Every -1 above twenty goes the same way.
    expect(form(21)).toBe("nom-many");
    expect(form(101)).toBe("nom-many");
    expect(form(1001)).toBe("nom-many");
    // …and 1 itself is still `one`, so the rule is genuinely about the compound
    // and not about the final digit alone.
    expect(form(1)).toBe("nom-one");
    // Round thousands and millions are `many` too: nothing about magnitude
    // rescues a number from the genitive plural.
    expect(form(1000)).toBe("nom-many");
    expect(form(1_000_000)).toBe("nom-many");
    // Fractional. `other` here is a genitive *singular* — "1,5 kilograma" — not
    // a plural of any kind, which is the row a vocabulary is likeliest to get
    // wrong because the key is named after neither.
    expect(form(1.5)).toBe("nom-other");
    expect(form(0.5)).toBe("nom-other");
  });

  test("slot picks the case, because w governs the locative", () => {
    // "w 5 kilogramach", never "w 5 kilogramów". No `evaluate` can reach this
    // axis: a `Result` is a bare value, so `formatValue` always passes "bare"
    // and only a spelled print ever asks for a conversion target.
    expect(form(1, "conversion-target")).toBe("loc-one");
    expect(form(2, "conversion-target")).toBe("loc-few");
    expect(form(5, "conversion-target")).toBe("loc-many");
    // "after-number" is not a case of its own — nothing governs a quantity
    // standing beside its own number — so it takes the nominative like "bare".
    expect(form(5, "after-number")).toBe("nom-many");
  });

  test("a count-free conversion target still names a key", () => {
    // Ruling R5: "1 kg w gramach" has no magnitude to agree "gramach" with, and
    // the row still has to exist. `other` is the category CLDR requires every
    // locale to define as its generic one, so this is where a bare target lands
    // — and in Polish it is the *only* way `loc-other` is ever reached, since
    // nothing passes a fraction into a target slot.
    expect(
      polish.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("loc-other");
  });

  test("takes its number symbols from CLDR, and they are Ukrainian's pair", () => {
    // An escape, not a literal: U+00A0 is invisible in source and degrades to a
    // plain space the moment anyone retypes the line, which is the same point
    // `parseNumber` makes about the same character. Polish groups the way
    // Ukrainian does and not the way German does, which is the fact a reader of
    // this file most needs pinned.
    expect(numberSymbols(polish)).toEqual({ group: "\u00A0", decimal: "," });
  });

  test("claims the conversion keywords, and w is the one generation writes", () => {
    expect(polish.keywords.in).toEqual(["w", "we", "na", "do"]);
    // Load-bearing rather than cosmetic: `Printer` writes `keywords.in[0]`, and
    // `selectForm`'s locative is the case that one word governs. Reorder this
    // array and the printed preposition stops agreeing with the printed noun.
    expect(polish.keywords.in?.[0]).toBe("w");
    expect(polish.keywords.of).toEqual(["z"]);
    expect(polish.keywords.times).toContain("razy");
    expect(polish.keywords.over).toEqual(["podzielić"]);
    expect(polish.keywords.by).toEqual(["przez"]);
    // Claimed by nothing, on purpose: a Polish discount needs a preposition
    // ("20% zniżki na 50") that a one-token keyword cannot carry — and the
    // preposition it needs is already claimed above as `in`.
    expect(polish.keywords.off).toBeUndefined();
  });

  test("no surface word is claimed for two different keywords", () => {
    // The check `buildKeywords` would make at boot, made here on one language
    // alone so a conflict inside this table is a Polish test failure rather than
    // an engine one. "przez" under both `over` and `by` is the specific mistake
    // this guards.
    const seen = new Map<string, string>();
    for (const [keyword, words] of Object.entries(polish.keywords)) {
      for (const word of words ?? []) {
        expect(seen.get(word) ?? keyword).toBe(keyword);
        seen.set(word, keyword);
      }
    }
  });
});

/**
 * Polish spaces its numerals, so unlike German it fits the run-of-words model
 * `NumeralParser` is shaped for. What it does not fit is the shared
 * `cardinalSpeller`, which is why `pl-cardinals.ts` exists — see the two facts
 * pinned at the bottom of this block.
 */
describe("polish numerals", () => {
  test.each([
    [["zero"], 0],
    [["jeden"], 1],
    // Feminine and neuter agreement, extra keys on the same values: "jedna
    // tona", "dwie godziny".
    [["jedna"], 1],
    [["dwie"], 2],
    [["dwanaście"], 12],
    [["dwadzieścia"], 20],
    [["dwadzieścia", "dwa"], 22],
    [["dziewięćdziesiąt", "dziewięć"], 99],
    // The fused hundreds, which add rather than multiply: dwieście is not "dwa
    // sto" and pięćset is one word whose first half is no longer a free numeral.
    [["sto"], 100],
    [["sto", "pięć"], 105],
    [["dwieście"], 200],
    [["dwieście", "trzydzieści", "cztery"], 234],
    [["pięćset"], 500],
    // A scale noun multiplies the group in front of it, in any of its three
    // agreement forms.
    [["tysiąc"], 1000],
    [["dwa", "tysiące"], 2000],
    [["pięć", "tysięcy"], 5000],
    [["dwadzieścia", "jeden", "tysięcy"], 21_000],
    [["sto", "tysięcy"], 100_000],
    [["dwa", "miliony", "pięćset", "tysięcy"], 2_500_000],
  ])("%p is %d", (words, value) => {
    expect(read(...words)).toEqual({ value: new Decimal(value), consumed: words.length });
  });

  test("no connector is declared, because Polish has none", () => {
    // English writes "two hundred and five"; Polish writes "dwieście pięć" with
    // nothing between the parts. The obvious candidate "i" is a plain
    // conjunction, so claiming it would make "5 i 3" read as 8 — the claim stops
    // at the first word instead.
    expect(read("pięć", "i", "trzy")).toEqual({ value: new Decimal(5), consumed: 1 });
  });

  test("nothing at all is a refusal, not a zero", () => {
    expect(read("kilogram")).toBeNull();
    expect(read("i")).toBeNull();
  });

  test("bilion is 10^12, the long scale", () => {
    // The single likeliest error in a Polish numeral table, and the same one
    // German's carries: miliard is the 10^9 English calls a billion, and bilion
    // is a thousand times that.
    expect(read("miliard")?.value.toString()).toBe("1000000000");
    expect(read("bilion")?.value.toString()).toBe("1000000000000");
    expect(CARDINALS.scales.map((s) => [s.one, s.value])).toEqual([
      ["tysiąc", 1_000],
      ["milion", 1_000_000],
      ["miliard", 1_000_000_000],
      ["bilion", 1_000_000_000_000],
    ]);
  });
});

describe("polish spells back through the same tables", () => {
  test.each([
    [0, "zero"],
    [1, "jeden"],
    [12, "dwanaście"],
    [21, "dwadzieścia jeden"],
    [45, "czterdzieści pięć"],
    // The rows the shared `cardinalSpeller` gets wrong. It composes a
    // sub-thousand value as "multiplier + hundred word", so 234 would come back
    // as "dwa sto trzydzieści cztery"; here the fused hundreds word is a whole
    // value of its own and the number is a three-part sum.
    [100, "sto"],
    [105, "sto pięć"],
    [234, "dwieście trzydzieści cztery"],
    [999, "dziewięćset dziewięćdziesiąt dziewięć"],
    // The other row it gets wrong: a scale noun agrees with its multiplier, and
    // the multiplier one is dropped entirely.
    [1000, "tysiąc"],
    [2000, "dwa tysiące"],
    [5000, "pięć tysięcy"],
    // 12 and 21 select `many` while 22 selects `few`, so the noun after them
    // changes even though the head barely does.
    [12_000, "dwanaście tysięcy"],
    [21_000, "dwadzieścia jeden tysięcy"],
    [22_000, "dwadzieścia dwa tysiące"],
    [100_000, "sto tysięcy"],
    [345_678, "trzysta czterdzieści pięć tysięcy sześćset siedemdziesiąt osiem"],
    [1_000_000, "milion"],
    [2_000_000, "dwa miliony"],
    [2_500_000, "dwa miliony pięćset tysięcy"],
    [1_000_000_000, "miliard"],
  ])("%d spells as %s", (value, expected) => {
    expect(spell(value)).toBe(expected);
  });

  test("declines exactly where the tables run out", () => {
    // The same three refusals `cardinalSpeller` documents: no fractional grammar
    // in the tables, no sign in the numeral fold, and nothing at or above 1000 x
    // the largest declared scale — a Polish biliard (10^15) is a real word, is
    // not in the table, and composing "tysiąc bilionów" for it would be
    // inventing a spelling out of a word that is not there.
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(spell(1e15)).toBeNull();
  });

  test("every spelling round-trips through the parser", () => {
    // The property the one-table-two-directions layout exists to guarantee, over
    // a spread wide enough to reach every branch of both directions.
    const sample = [
      0, 1, 2, 5, 9, 12, 15, 19, 20, 21, 22, 30, 45, 99, 100, 101, 105, 121, 200, 234,
      345, 500, 999, 1000, 1001, 2000, 2200, 5000, 12_000, 21_000, 22_000, 100_000,
      345_678, 999_999, 1_000_000, 2_000_000, 2_500_000, 1_000_000_000, 1_000_000_000_000,
    ];
    const problems: string[] = [];
    for (const n of sample) {
      const written = spell(n);
      if (written === null || written === undefined) {
        problems.push(`${n} does not spell`);
        continue;
      }
      const words = written.split(" ");
      const back = read(...words);
      if (back === null || back === undefined || !back.value.equals(n)) {
        problems.push(`${n} spelled "${written}" and read back as ${back?.value}`);
      } else if (back.consumed !== words.length) {
        problems.push(
          `${n} spelled "${written}" and only ${back.consumed} words claimed`,
        );
      }
    }
    expect(problems).toEqual([]);
  });
});

/**
 * The analyzer chain, asserted on the chain rather than through an engine
 * because a `Language` ships no words: what a stripped stem *resolves to* is the
 * alias index's business, and the index is built from vocabularies this file has
 * never seen. What is Polish's own business is which forms the chain offers.
 */
describe("the analyzer chain", () => {
  const analyze = createAnalyzerChain(polish);
  const forms = (surface: string) => analyze(surface).map((a) => a.form);

  test("identity offers the word as typed", () => {
    // Load-bearing: without it the language cannot reach its own aliases at all,
    // and every reading would have to arrive through a penalised stem.
    expect(forms("kilogramach")).toContain("kilogramach");
  });

  test.each([
    // The masculine paradigm, one row per case the printer can emit.
    ["kilogramy", "kilogram"], // nominative plural, the 2–4 row
    ["kilogramów", "kilogram"], // genitive plural, the 5+ row
    ["kilograma", "kilogram"], // genitive singular, the 1,5 row
    ["kilogramie", "kilogram"], // locative singular
    ["kilogramach", "kilogram"], // locative plural, the "w …" row
    ["kilogramem", "kilogram"], // instrumental singular
    ["kilogramami", "kilogram"], // instrumental plural
    ["kilogramowi", "kilogram"], // dative singular
    ["kilogramom", "kilogram"], // dative plural
    // The feminine paradigm, which strips to the bare stem rather than to the
    // nominative — "ton", which is also the genitive plural Polish writes after
    // five ("5 ton").
    ["tona", "ton"],
    ["tony", "ton"],
    ["tonie", "ton"],
    ["tonach", "ton"],
    ["tonami", "ton"],
    // The two nasal vowels, which are why `ę` and `ą` are listed as characters
    // of their own: a stripper that knew only the plain `e`/`a` would leave a
    // stem ending in a nasal that matches no alias.
    ["tonę", "ton"],
    ["toną", "ton"],
  ])("%s strips to %s", (surface, stem) => {
    expect(forms(surface)).toContain(stem);
  });

  test("minStem keeps the stripper off the symbols", () => {
    // Polish writes its units with the same two-letter symbols everyone else
    // does, and a stripper let loose on them hands the resolver stems of one
    // letter.
    expect(forms("kg")).toEqual(["kg"]);
    expect(forms("ha")).toEqual(["ha"]);
    expect(forms("ml")).toEqual(["ml"]);
  });
});

/**
 * Polish through a real engine.
 *
 * `MASS_FIXTURE` is a fixture, not a shipped vocabulary: Polish's real words for
 * `mass` belong to `@smartput/mass/locale/pl`, and a `Language` may not contain
 * one. Three units are enough to write a sentence in, and they are chosen to
 * cover both genders — the masculine `kilogram`, whose genitive plural takes
 * -ów, and the feminine `tona`, whose genitive plural is the bare stem `ton`.
 *
 * Every string this table can print is also one of its aliases, which is the
 * rule the shape does not enforce and `assertLocaleContract` does: a printer
 * that cannot read its own output is the exact defect four Ukrainian kinds
 * shipped past a green suite.
 */
describe("through a real engine", () => {
  const MASS_FIXTURE = defineVocabulary({
    locale: "pl",
    kind: "mass",
    units: {
      kg: {
        aliases: [
          "kg",
          "kilogram",
          "kilogramy",
          "kilogramów",
          "kilograma",
          "kilogramie",
          "kilogramach",
        ],
        symbol: "kg",
        forms: {
          "nom-one": "kilogram",
          "nom-few": "kilogramy",
          "nom-many": "kilogramów",
          // Genitive singular, not a plural: "1,5 kilograma".
          "nom-other": "kilograma",
          "loc-one": "kilogramie",
          "loc-few": "kilogramach",
          "loc-many": "kilogramach",
          // The count-free conversion target — "w kilogramach" — which is the
          // only position this key is ever reached from, since nothing passes a
          // fractional count into a target slot. So it is the locative *plural*
          // and not the genitive singular `nom-other` holds, even though both
          // rows are named `other`.
          "loc-other": "kilogramach",
        },
      },
      g: {
        aliases: ["g", "gram", "gramy", "gramów", "grama", "gramie", "gramach"],
        symbol: "g",
        forms: {
          "nom-one": "gram",
          "nom-few": "gramy",
          "nom-many": "gramów",
          "nom-other": "grama",
          "loc-one": "gramie",
          "loc-few": "gramach",
          "loc-many": "gramach",
          "loc-other": "gramach",
        },
      },
      t: {
        aliases: ["t", "tona", "tony", "ton", "tonie", "tonach"],
        symbol: "t",
        forms: {
          "nom-one": "tona",
          "nom-few": "tony",
          // The bare stem, with no ending at all where the masculine takes -ów.
          // Nothing can strip its way to this form, so a feminine vocabulary has
          // to list it or the printer emits a word it cannot read back.
          "nom-many": "ton",
          "nom-other": "tony",
          "loc-one": "tonie",
          "loc-few": "tonach",
          "loc-many": "tonach",
          "loc-other": "tonach",
        },
      },
    },
  });

  const pl = composeLocale(polish, [MASS_FIXTURE]);
  const engine = createEngine({ locales: [pl], kinds: BUILTIN_KINDS, format: "pl" });
  const evaluate = (input: string) => engine.evaluate(input).formatted;

  test.each([
    // The four nominative rows, in the order a reader meets them.
    ["1 kg", "1 kilogram"],
    ["2 kg", "2 kilogramy"],
    ["5 kg", "5 kilogramów"],
    ["1,5 kg", "1,5 kilograma"],
    // Zero is `many`, which is the row an English reader gets wrong.
    ["0 kg", "0 kilogramów"],
    // The 12–14 band and the compounds around it.
    ["12 kg", "12 kilogramów"],
    ["21 kg", "21 kilogramów"],
    ["22 kg", "22 kilogramy"],
    // The feminine, whose `many` row is a bare stem.
    ["1 t", "1 tona"],
    ["2 t", "2 tony"],
    ["5 t", "5 ton"],
    // An inflected surface the vocabulary lists, read straight out of the index.
    ["5 kilogramów", "5 kilogramów"],
    // …and one it does not, recovered by the suffix stripper at a penalty.
    ["5 kilogramami", "5 kilogramów"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test("the group separator is the invisible one, and it reads back", () => {
    // Written as an escape rather than typed, for the same reason `pl.ts` says
    // the separators are read from CLDR: U+00A0 is invisible in source and
    // degrades to a plain space the moment anyone retypes the line.
    expect(evaluate("2 kg w gramach")).toBe("2\u00A0000 gramów");
    expect(evaluate("1000 kg")).toBe("1\u00A0000 kilogramów");
    // The round trip that separator would otherwise break. `normalize` folds
    // every whitespace run before `lex` runs, so this language's own printed
    // output arrives back with a plain space in it — and `parseNumber` accepts
    // it precisely because Polish's declared separator is space-like. Under `en`
    // the same string must stay unparseable, which is why that acceptance is
    // gated on the separator rather than being unconditional.
    expect(evaluate("1\u00A0000 kg")).toBe("1\u00A0000 kilogramów");
    expect(evaluate("1 000 kg")).toBe("1\u00A0000 kilogramów");
  });

  test.each([
    // All four conversion prepositions, one meaning.
    ["1 kg w gramach", "1\u00A0000 gramów"],
    ["1 kg na gramy", "1\u00A0000 gramów"],
    ["1 kg do gramów", "1\u00A0000 gramów"],
    ["2 kg plus 3 kg", "5 kilogramów"],
    ["5 kg minus 3 kg", "2 kilogramy"],
    ["10 kg razy 2", "20 kilogramów"],
    // "podzielić przez" and "pomnożyć przez" are each one operator: the verb is
    // the op and `foldWordOps` swallows the "przez" after it, exactly as it
    // swallows English's "by" after "divided".
    ["10 kg podzielić przez 2", "5 kilogramów"],
    ["10 kg pomnożyć przez 2", "20 kilogramów"],
    // Polish's own numerals, through the engine.
    ["dwadzieścia jeden kilogramów", "21 kilogramów"],
    ["dwa tysiące kilogramów", "2\u00A0000 kilogramów"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test("a bare przez does not divide, which is the cost of the ruling", () => {
    // Stated rather than hidden. "przez" is claimed as `by`, and a stray `by`
    // fails at the parser — the same way English's "10 by 2" fails, and for the
    // same reason. The alternative made the commoner "podzielić przez" emit two
    // division operators in a row.
    expect(() => engine.evaluate("10 kg przez 2")).toThrow();
  });

  /**
   * The locative axis, which no `evaluate` can show: a `Result` is a bare value,
   * so `formatValue` always passes `"bare"` and the `loc-*` rows are unreachable
   * from there. `conversion-target` is a *printer* position — the target word of
   * "X w Y", chosen with no count in hand at all — and `print.ts` passes it only
   * on a spelled print. So the whole stage stack is built here rather than
   * borrowed from `createEngine`, the way `third-language.test.ts` does.
   */
  describe("a spelled print reaches the locative", () => {
    const registry = buildRegistry(BUILTIN_KINDS, [pl]);
    const resolver = createResolver({ registry, locales: [pl], format: pl, layers: [] });
    const normalizer = new Normalizer();
    const tokenizer = new Tokenizer({ locale: pl, registry });
    const parser = new Parser({ resolver });
    const solver = new Solver({ registry });
    const printer = new Printer({ registry, locale: pl });

    const spelled = (input: string) => {
      const program = parser.run(tokenizer.run(normalizer.run(input)));
      return printer.print(program, {
        mode: "resolved",
        resolution: solver.best(program),
        spelled: true,
      });
    };

    test.each([
      // Both axes in one string: `nom-one` on the operand and `loc-other` on the
      // target, from one `selectForm` the engine understands not one word of.
      ["1 kg w gramach", "jeden kilogram w gramach"],
      // The nominative `many` on the operand, and a target whose locative is the
      // same word as the one above — the case does not follow the count.
      ["5 kg w gramach", "pięć kilogramów w gramach"],
      // The target's case does not follow how the writer spelled it either: the
      // accusative "na gramy" is accepted on the way in, and what comes back is
      // "w gramach", because the printer writes `keywords.in[0]` and the slot
      // picks the case that word governs.
      ["5 kg na gramy", "pięć kilogramów w gramach"],
      // The feminine target, so the locative row is measured against a word that
      // is not simply the masculine one with a different ending.
      ["2 kg w tonach", "dwa kilogramy w tonach"],
    ])("%s spells as %s", (input, expected) => {
      expect(spelled(input)).toBe(expected);
    });

    /**
     * The one thing this stage gets wrong about Polish, pinned rather than left
     * to be rediscovered — every case above puts the count in front of a
     * *masculine* unit noun, which is exactly where the defect hides.
     *
     * Polish agrees the numerals 1 and 2 with the gender of the noun after them:
     * "jedna godzina" and "dwie tony", never the masculine "jeden"/"dwa".
     * `NumeralSpeller` is handed a magnitude and nothing else, so the speller
     * cannot know which noun its word will land in front of, and the gender it
     * would need lives in a `Vocabulary` a `Language` must never see.
     * `pl-cardinals.ts` argues that at length; this records what it costs.
     *
     * The blast radius is exactly 1, 2 and their compounds: from 5 up the noun
     * is a genitive plural and `pięć` is invariant, and 21 keeps an uninflected
     * `jeden` in "dwadzieścia jeden godzin", which is already correct. `uk`
     * carries the identical defect for the identical reason, so these are
     * assertions about the current signature rather than about Polish.
     *
     * Written as exact strings on purpose: the day a gender-aware speller lands,
     * these two fail and say so, instead of quietly improving under a suite that
     * had only ever asserted a shape.
     */
    test.each([
      ["1 t", "jeden tona", "jedna tona"],
      ["2 t", "dwa tony", "dwie tony"],
      ["2 t w kilogramach", "dwa tony w kilogramach", "dwie tony w kilogramach"],
    ])("%s spells as %s, where Polish wants %s", (input, current) => {
      expect(spelled(input)).toBe(current);
    });

    test("the counts around the defect are already correct", () => {
      // 5 and up: the noun is a genitive plural and `pięć` does not inflect for
      // gender, so the feminine unit comes out right without any agreement.
      expect(spelled("5 t")).toBe("pięć ton");
      // 21 is `many` too, and the trailing `jeden` of a compound stays
      // uninflected in front of a genitive plural — "dwadzieścia jeden ton" is
      // what Polish writes, whatever the noun's gender.
      expect(spelled("21 t")).toBe("dwadzieścia jeden ton");
      // The masculine unit nouns, which the agreement rule never touches, and
      // which is why every other case in this block reads as correct Polish.
      expect(spelled("1 kg")).toBe("jeden kilogram");
      expect(spelled("2 kg")).toBe("dwa kilogramy");
    });
  });

  /**
   * P3's lesson applied before it can repeat: a vocabulary is not correct
   * because its aliases resolve, it is correct because every string it can
   * *print* reads back. Through the index and the chain rather than through
   * `evaluate`, because the fuzzy-correction pass rescues a word that is one
   * edit away from an alias and would report a merely-nearly-right table as
   * right — `assertLocaleContract` takes the strict route for exactly this
   * reason, and this mirrors it over the fixture.
   */
  test("every Polish word the printer can emit is readable without a correction", () => {
    const registry = buildRegistry(BUILTIN_KINDS, [pl]);
    const analyze = createAnalyzerChain(polish);
    const readable = (surface: string, unit: string) =>
      [surface, ...analyze(surface).map((a) => a.form)].some((f) =>
        (registry.aliasIndex.get(f.toLocaleLowerCase("pl")) ?? []).some(
          (e) => e.kind === "mass" && e.unit === unit,
        ),
      );

    const problems: string[] = [];
    for (const [unit, words] of Object.entries(MASS_FIXTURE.units)) {
      for (const alias of words.aliases) {
        if (!readable(alias, unit))
          problems.push(`${unit}: alias ${alias} does not read`);
      }
      // Every string `selectForm` can select — including the `loc-*` rows, which
      // never appear in a `Result` at all and are therefore precisely the words
      // a sweep over `evaluate` alone would never even try.
      for (const f of Object.values(words.forms ?? {})) {
        if (!readable(f, unit)) problems.push(`${unit}: form ${f} does not read`);
      }
      if (words.symbol !== undefined && !readable(words.symbol, unit)) {
        problems.push(`${unit}: symbol ${words.symbol} does not read`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("renderQuantity", () => {
  const render = (parts: Parameters<NonNullable<typeof polish.renderQuantity>>[0]) =>
    polish.renderQuantity?.(parts);
  const base = { number: "5", kind: "mass", unit: "kg", slot: "bare" as Slot };

  test("a symbol is spaced, which is PN-EN ISO 80000 and not English's tight 5kg", () => {
    expect(render({ ...base, symbol: "kg" })).toBe("5 kg");
  });

  test("a word is spaced exactly as the default already does", () => {
    expect(render({ ...base, form: "kilogramów", symbol: "kg" })).toBe("5 kilogramów");
    expect(render({ ...base, alias: "kilogramów" })).toBe("5 kilogramów");
  });

  test("a caller's own gap still wins on both branches", () => {
    // `Printer.spacing` is a typographic choice of the caller's, so it has to
    // reach a language that assembles its own quantities.
    expect(render({ ...base, symbol: "kg", gap: "" })).toBe("5kg");
    expect(render({ ...base, form: "kilogramów", gap: " " })).toBe("5 kilogramów");
  });

  test("with nothing to print it degrades to the unit key", () => {
    // I10's graceful degradation, unchanged: a half-translated engine renders
    // awkwardly rather than throwing.
    expect(render(base)).toBe("5 kg");
  });
});
