import { describe, expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { ukrainian } from "@smartput/core/locale/uk";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_UK from "@smartput/kinds/locale/uk";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { KeywordConflictError, NoCandidateError } from "../errors";
import { buildRegistry } from "../kind/registry";
import { createResolver } from "../parse/candidates";
import type { NumberToken } from "../parse/lex";
import { Normalizer } from "../parse/normalize";
import { Parser } from "../parse/program";
import { Tokenizer } from "../parse/tokenizer";
import { Printer } from "../print/print";
import { Solver } from "../solve/solver-class";
import { createAnalyzerChain } from "./analyze";
import { buildKeywords, composeLocale } from "./compose";
import { compoundSplitter } from "./compound-splitter";
import { defineLanguage } from "./define";
import { cardinalNumerals, cardinalSpeller, identity } from "./helpers";
import { defineVocabulary } from "./vocabulary";

/**
 * The third language, as a proof rather than a product.
 *
 * Spec §13 puts every language beyond `en`/`uk` out of scope, so nothing here
 * is shipped: the German below is built inside this file and installed only
 * into the engines this file constructs. What it is for is the one claim the
 * first two languages cannot make on their own. English and Ukrainian were
 * built *while* the seams were being cut, so every seam fits them by
 * construction; two points always lie on a line. A third language written
 * against the finished seams, by someone who may not touch them, is the first
 * evidence that the shape generalises — and where it does not, this file says
 * so out loud rather than trimming German until it fits (see the two
 * `deliberately cannot` tests at the end).
 *
 * German was chosen because it stresses three things neither built-in does:
 *
 * - **Compounding.** `Zentimeter`, `Bandmeter`, `Quadratmeter` are single
 *   tokens the lexer cannot cut and no vocabulary can enumerate, which is what
 *   `compoundSplitter` exists for. English writes "square metre" as two words;
 *   Ukrainian inflects rather than compounds.
 * - **Capitals.** Every German noun is capitalised, so every unit word arrives
 *   with a capital in ordinary text — and analyzers are handed the surface
 *   exactly as typed (`parse/candidates.ts` folds the *form* on the way out,
 *   not the surface on the way in). English and Ukrainian unit words are
 *   lowercase in ordinary text, so this path was never load-bearing before.
 * - **A `forms` table keyed on two axes with different contents than
 *   Ukrainian's.** German's noun plural is frequently *identical* to its
 *   singular (`Meter`/`Meter`, `Kilometer`/`Kilometer`) while its dative
 *   plural is not (`Metern`), which is the mirror image of English (plural
 *   always marked, case never) and a different two-axis shape from Ukrainian's
 *   case × four-category grid.
 */

/** The forms `compoundSplitter` may find at the head of a compound. */
const LENGTHS = ["meter", "zentimeter", "kilometer", "meile"];

const plural = new Intl.PluralRules("de");

/**
 * German's numerals, for `spell` only.
 *
 * Deliberately not handed to `Language.numerals`: see
 * `cardinalNumerals cannot express a German compound numeral` at the bottom of
 * this file. `spell` is here because the `conversion-target` slot is only ever
 * reached through a spelled print (`print.ts`'s `renderTarget` passes
 * `SLOT_TARGET` only when `ctx.spell` is set), and that slot is the axis this
 * language exists to exercise.
 */
const GERMAN_CARDINALS = {
  units: {
    null: 0,
    ein: 1,
    zwei: 2,
    drei: 3,
    vier: 4,
    fünf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,
    zehn: 10,
    elf: 11,
    zwölf: 12,
  },
  tens: { zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50 },
  scales: { hundert: 100, tausend: 1000 },
};

const german = defineLanguage({
  id: "de",
  numberFormat: "intl",
  // `identity()` is *required*, not decorative: the resolver looks a surface up
  // only through the forms some analyzer produced, so a chain without it never
  // offers the word as typed and `Zentimeter` reads as the split's `meter`.
  // Order within the list does not matter — `createAnalyzerChain` pools every
  // analyzer's output by form and keeps the highest weight for each — so this
  // reads first for the reader's sake, not the resolver's. See
  // `a language's own aliases are not reachable without its own identity()`.
  analyze: [identity(), compoundSplitter({ vocabulary: LENGTHS, minPart: 3 })],
  keywords: { in: ["in"] },
  spell: cardinalSpeller(GERMAN_CARDINALS),
  /**
   * Two axes, like Ukrainian's, but a different pair: grammatical case comes
   * from the slot (`in` governs the dative in this reading), and the category
   * comes from CLDR. The engine never learns what `"dat"` means — it asks for
   * a key and indexes `forms` with it, which is the whole point of
   * `selectForm` returning an opaque string.
   */
  selectForm: ({ count, slot }) => {
    const grammaticalCase = slot === "conversion-target" ? "dat" : "nom";
    const category = count === undefined ? "other" : plural.select(count.toNumber());
    return `${grammaticalCase}-${category}`;
  },
});

/**
 * Four length units.
 *
 * Every string this table can put in front of a user is also listed among its
 * `aliases`, which is a rule the shape does not enforce and the sweep below
 * does: the dative plurals (`Metern`) because a language that prints a word it
 * cannot read back is exactly the defect P3 shipped, and the `symbol`s because
 * `symbol` is a *display* field — `buildRegistry` indexes `aliases` and
 * nothing else, so an unlisted symbol makes a `symbols: true` print
 * unreadable. Every English vocabulary in the repo satisfies this the same
 * way, by deriving its aliases from a table the symbol is already in.
 */
const GERMAN_LENGTH = defineVocabulary({
  locale: "de",
  kind: "length",
  units: {
    m: {
      aliases: ["meter", "metern", "m"],
      symbol: "m",
      forms: {
        "nom-one": "Meter",
        "nom-other": "Meter",
        "dat-one": "Meter",
        "dat-other": "Metern",
      },
    },
    cm: {
      aliases: ["zentimeter", "zentimetern", "cm"],
      symbol: "cm",
      forms: {
        "nom-one": "Zentimeter",
        "nom-other": "Zentimeter",
        "dat-one": "Zentimeter",
        "dat-other": "Zentimetern",
      },
    },
    km: {
      aliases: ["kilometer", "kilometern", "km"],
      symbol: "km",
      forms: {
        "nom-one": "Kilometer",
        "nom-other": "Kilometer",
        "dat-one": "Kilometer",
        "dat-other": "Kilometern",
      },
    },
    // The one unit whose plural is marked, so the `one`/`other` axis is
    // measured against a word that actually changes: a language whose every
    // plural equalled its singular would pass a plural test that asserted
    // nothing.
    mi: {
      aliases: ["meile", "meilen", "mi"],
      symbol: "mi",
      forms: {
        "nom-one": "Meile",
        "nom-other": "Meilen",
        "dat-one": "Meile",
        "dat-other": "Meilen",
      },
    },
  },
});

const de = composeLocale(german, [GERMAN_LENGTH]);
const en = composeLocale(english, BUILTIN_EN);
const uk = composeLocale(ukrainian, BUILTIN_UK);

/**
 * The first three-language engine in the repo. English is `format`, so every
 * assertion below that does not name a format is measuring German *reading*
 * with English writing — the many-to-one split spec §9 specifies.
 */
const three = createEngine({ locales: [en, uk, de], kinds: BUILTIN_KINDS, format: "en" });

// --- Task 21's two rows -------------------------------------------------

describe("the compound a vocabulary cannot enumerate", () => {
  /**
   * The plan's row. It reaches `cm` and not `m`, which is the whole contract:
   * German's own vocabulary lists `zentimeter` at weight 0, the splitter finds
   * `meter` inside the same word at -3, and the alias wins. Flip the splitter's
   * default weight positive and this answers 10 metres with every unit test in
   * `compound-splitter.test.ts` still green.
   */
  test("10 Zentimeter is ten centimetres", () => {
    const result = three.evaluate("10 Zentimeter");
    expect(result.value.unit).toBe("cm");
    expect(result.formatted).toBe("10 centimetres");
  });

  /**
   * The plan's other row, and the reason the helper takes a vocabulary rather
   * than a prefix list. "Zentrum" is a town centre; it merely *starts* the way
   * "Zentimeter" does, and nothing it ends in is a length. The refusal is
   * structural — there is no split to make — not a special case, and it
   * survives the fuzzy-correction pass, which is the part only an end-to-end
   * run can show.
   */
  test("Zentrum merely starts the same way and is not a length", () => {
    expect(() => three.evaluate("10 Zentrum")).toThrow(NoCandidateError);
  });

  /** The compound no vocabulary would list, which is what the split is for. */
  test("Bandmeter is a metre, by its head", () => {
    expect(three.evaluate("10 Bandmeter").value.unit).toBe("m");
  });

  /** The same penalty from the other side: `Kilometer` contains `meter`. */
  test("an exact alias outranks the split inside it", () => {
    expect(three.evaluate("10 Kilometer").value.unit).toBe("km");
  });
});

// --- capitals -----------------------------------------------------------

/**
 * German capitalises every noun, so a unit word arrives with a capital in
 * ordinary prose and without one in a search box. Both must read, and neither
 * language shipped so far made that path load-bearing: English and Ukrainian
 * unit words are lowercase in running text, so a case bug in the analyzer seam
 * would have cost them a sentence-initial word at most.
 *
 * The two halves reach the alias index by different routes, which is why both
 * are asserted: `identity()` hands the surface back unchanged and
 * `parse/candidates.ts` folds the *form* before the lookup, while
 * `compoundSplitter` folds its own vocabulary and its own input because it has
 * to compare them to each other before any form exists to be folded.
 */
describe("a capitalised noun and a lowercase one are the same word", () => {
  test.each([
    ["10 Zentimeter", "cm"],
    ["10 zentimeter", "cm"],
    ["10 ZENTIMETER", "cm"],
    ["10 zEnTiMeTeR", "cm"],
    // Through the splitter rather than the alias index, so the fold under test
    // is `compoundSplitter`'s own rather than the resolver's.
    ["10 Bandmeter", "m"],
    ["10 bandmeter", "m"],
    ["10 BANDMETER", "m"],
  ])("%s reads as %s", (input, unit) => {
    expect(three.evaluate(input).value.unit).toBe(unit);
  });
});

// --- the forms table ----------------------------------------------------

/**
 * A third `selectForm` shape, printed. English keys on count alone; Ukrainian
 * on case × four categories; German on case × two, where the *number* axis is
 * frequently inert and the *case* axis is not — which is the arrangement that
 * catches a printer quietly ignoring one of the two.
 */
describe("German's forms print", () => {
  const printsDe = (input: string) => three.evaluate(input, { format: "de" }).formatted;

  test.each([
    // `one` and `other` on a unit whose plural is marked.
    ["1 Meile", "1 Meile"],
    ["2 Meilen", "2 Meilen"],
    // CLDR `other` at zero, which German marks like any other plural.
    ["0 Meilen", "0 Meilen"],
    // The invariant plural, which is the German rule and not an omission:
    // `nom-one` and `nom-other` are the same string on purpose.
    ["1 Meter", "1 Meter"],
    ["7 Meter", "7 Meter"],
    // A fraction is CLDR `other` in German as in English, and the decimal
    // comma comes from `numberFormat: "intl"` under the `de` tag — the format
    // locale's number grammar, not the reading one's. English digits beside an
    // English word, printed German, is the row that says so.
    ["1.5 miles", "1,5 Meilen"],
    // The same fraction typed in German. Both halves are written in it on
    // purpose: since number readings became solver slots, `Meilen` is a word
    // only German spells, so the German reading of the digits takes the
    // agreement bonus and beats the engine's `grammar:en` point (ruling R-A1)
    // — "1.5 Meilen" is fifteen miles on this engine, not one and a half.
    ["1,5 Meilen", "1,5 Meilen"],
    // The group separator German writes, which is neither English's `,` nor
    // Ukrainian's U+00A0.
    ["10 Kilometer in Meter", "10.000 Meter"],
  ])("%s prints as %s", (input, expected) => {
    expect(printsDe(input)).toBe(expected);
  });

  /**
   * The case axis, which no `evaluate` can show: a `Result` is a bare value,
   * so `formatValue` always passes `"bare"` and the dative row is unreachable
   * from there. `conversion-target` is a *printer* position — the target word
   * of `X in Y`, chosen with no count in hand at all — and `print.ts` passes
   * it only on a spelled print. So the whole stage stack is built here rather
   * than borrowed from `createEngine`, the way `print.test.ts` does.
   *
   * `ein Kilometer in Metern` is one string carrying both axes at once:
   * `nom-one` on the operand, `dat-other` on the target, from one `selectForm`
   * that the engine understands not one word of.
   */
  const registry = buildRegistry(BUILTIN_KINDS, [de, en]);
  const resolver = createResolver({
    registry,
    locales: [de, en],
    format: de,
    layers: [],
  });
  const normalizer = new Normalizer();
  const tokenizer = new Tokenizer({ locale: de, registry });
  const parser = new Parser({ resolver });
  const solver = new Solver({ registry });
  const printer = new Printer({ registry, locale: de });

  const spelledDe = (input: string) => {
    const program = parser.run(tokenizer.run(normalizer.run(input)));
    return printer.print(program, {
      mode: "resolved",
      resolution: solver.best(program),
      spelled: true,
    });
  };

  test.each([
    // nominative singular operand, dative plural target.
    ["1 Kilometer in Metern", "ein Kilometer in Metern"],
    // nominative plural operand, and a target whose dative equals its
    // nominative — the row that proves the case axis is not simply "append n".
    ["5 Meilen in Kilometern", "fünf Meilen in Kilometern"],
    // The target's own case does not follow how the writer spelled it: the
    // nominative `Meter` is accepted on the way in and the dative `Metern` is
    // what comes back, because the slot decides and not the surface.
    ["1 Kilometer in Meter", "ein Kilometer in Metern"],
  ])("%s spells as %s", (input, expected) => {
    expect(spelledDe(input)).toBe(expected);
  });
});

/**
 * P3's lesson, applied to the third language before it can repeat: a
 * vocabulary is not correct because its aliases resolve, it is correct because
 * every string it can *print* reads back. Four kinds shipped Ukrainian words
 * no analyzer could read with the whole suite green, and this is the sweep
 * that would have caught them.
 *
 * **Through the index and the chain, not through `evaluate` — and that
 * distinction is the whole test.** Writing this sweep the obvious way (print
 * with the engine, feed the string back to the engine) passes for a word that
 * is *not* readable, because the fuzzy-correction pass rescues it: strip
 * `"metern"` from `m`'s aliases and `evaluate("3 Metern")` still answers
 * metres, having quietly corrected the word at a distance of 1.02. That is a
 * fine thing for a user typing a typo and a useless thing for a contract,
 * since it says the vocabulary is one edit away from being right rather than
 * right. `assertLocaleContract` takes the strict route for exactly this
 * reason; this mirrors it, and then runs the engine round trip beside it so
 * both claims are on the record.
 */
test("every German word the printer can emit is readable without a correction", () => {
  const registry = buildRegistry(BUILTIN_KINDS, [de]);
  const analyze = createAnalyzerChain(german);
  /** `assertLocaleContract`'s `readable`, over one vocabulary. */
  const readable = (surface: string, unit: string) =>
    [surface, ...analyze(surface).map((a) => a.form)].some((form) =>
      (registry.aliasIndex.get(form.toLocaleLowerCase("de")) ?? []).some(
        (e) => e.kind === "length" && e.unit === unit,
      ),
    );

  const problems: string[] = [];
  for (const [unit, words] of Object.entries(GERMAN_LENGTH.units)) {
    for (const alias of words.aliases) {
      if (!readable(alias, unit))
        problems.push(`${unit}: alias ${alias} does not resolve back`);
    }
    // Every string `selectForm` can select — including the dative rows, which
    // never appear in a `Result` at all and are therefore precisely the words
    // a sweep over `evaluate` alone would never even try.
    for (const form of Object.values(words.forms ?? {})) {
      if (!readable(form, unit))
        problems.push(`${unit}: form ${form} does not resolve back`);
    }
    if (words.symbol !== undefined && !readable(words.symbol, unit)) {
      problems.push(`${unit}: symbol ${words.symbol} does not resolve back`);
    }
  }
  expect(problems).toEqual([]);
});

/** The same vocabulary through the real engine, which is the claim users see. */
test("the round trip holds through a real German engine", () => {
  const deFirst = createEngine({ locales: [de, en], kinds: BUILTIN_KINDS, format: "de" });
  const problems: string[] = [];
  for (const [unit, words] of Object.entries(GERMAN_LENGTH.units)) {
    for (const count of [0, 1, 2, 5, 100]) {
      const printed = deFirst.evaluate(`${count} ${words.aliases[0]}`).formatted;
      try {
        const back = deFirst.evaluate(printed);
        if (back.value.unit !== unit) {
          problems.push(
            `${unit}: ${JSON.stringify(printed)} read back as ${back.value.unit}`,
          );
        }
      } catch (err) {
        problems.push(`${unit}: ${JSON.stringify(printed)} does not read back — ${err}`);
      }
    }
  }
  expect(problems).toEqual([]);
});

// --- three languages in one engine --------------------------------------

/**
 * P4 made recognition many-locale and generation single. It was measured on a
 * pair, and a pair is where an accidental two-way special case hides. Three is
 * the first number that cannot.
 */
describe("three languages in one engine", () => {
  test("all three read, on one engine, into the same reading", () => {
    expect(three.evaluate("10 Zentimeter").value.unit).toBe("cm");
    expect(three.evaluate("10 сантиметрів").value.unit).toBe("cm");
    expect(three.evaluate("10 centimetres").value.unit).toBe("cm");
  });

  test("a whole sentence in each language, on the engine that prints a fourth reading", () => {
    expect(three.evaluate("2 kg in grams").formatted).toBe("2,000 grams");
    expect(three.evaluate("2 кг в грамах").formatted).toBe("2,000 grams");
    expect(three.evaluate("1 Kilometer in Metern").formatted).toBe("1,000 metres");
  });

  /**
   * Generation follows `format` and nothing else — not the language the input
   * was written in, not the order `locales` were installed in. One German
   * input, three output languages, one engine.
   */
  test.each([
    ["en", "10 centimetres"],
    ["uk", "10 сантиметрів"],
    ["de", "10 Zentimeter"],
  ])("format %s writes %s", (format, expected) => {
    expect(three.evaluate("10 Zentimeter", { format }).formatted).toBe(expected);
  });

  /**
   * The mirror, so the row above is not just German reading German. A
   * Ukrainian input prints in whichever of the three `format` names.
   */
  test.each([
    ["en", "5 kilograms"],
    ["uk", "5 кілограмів"],
  ])("a Ukrainian input under format %s writes %s", (format, expected) => {
    expect(three.evaluate("5 кг", { format }).formatted).toBe(expected);
  });

  /**
   * And the cost of single-locale generation, stated rather than hidden.
   * German here has a vocabulary for `length` and for nothing else, so a mass
   * result printed under `format: "de"` has no word to print and degrades to
   * the registry's unit key. That is `unitWord`'s documented fallback working,
   * not a bug — but it is what "one language writes" means when that language
   * is only partly translated, and a reader who has just seen the three rows
   * above should see this one immediately after them.
   */
  test("a format locale with no vocabulary for the kind prints the unit key", () => {
    expect(three.evaluate("5 кг", { format: "de" }).formatted).toBe("5 kg");
  });

  /**
   * The same degradation on the *other* generation path, which is the one that
   * has already been wrong once.
   *
   * P4 found `complete()` offering the language it read rather than the one it
   * writes, and fixed the case where the format language ships words for the
   * unit but not this spelling of it. What it could not see is the case below,
   * because a two-language engine cannot produce it: both built-ins ship all
   * fifteen vocabularies, so `wordsFor(format, …)` came back `undefined` only
   * for a kind *neither* language had spoken for, where the alias that keyed
   * the index is the unit key and falling through to it is right. A third
   * language translated for one kind is the first engine where "the format
   * language has no word for this unit" and "nobody has a word for this unit"
   * come apart — and there the alias is some *other* language's word.
   *
   * So the floor is the registry unit key, exactly as `unit-word.ts` has it:
   * the two generation paths must degrade to the same string, or an engine
   * answers `5 mb` and offers `5 megabyte` in the same breath.
   */
  test("a completion under a format locale with no vocabulary offers the unit key", () => {
    // `complete` writes in the engine's `format` and takes no per-call one, so
    // the German-writing engine is built rather than borrowed.
    const writesGerman = createEngine({
      locales: [en, uk, de],
      kinds: BUILTIN_KINDS,
      format: "de",
    });
    const datasize = writesGerman.complete("5 me").filter((o) => o.kind === "datasize");
    expect(datasize.length).toBeGreaterThan(0);
    expect(datasize.map((o) => o.text)).toEqual(datasize.map((o) => `5 ${o.unit}`));
  });

  /**
   * `EvalOptions.locales` filters on the language that *listed the spelling*,
   * so it separates the three by vocabulary rather than by reader. Refusing
   * every reading of a slot is `DimensionMismatchError` — the surface was
   * recognised and then filtered away, which is not `NoCandidateError`'s "no
   * reading exists".
   */
  test("a reading can be narrowed to the language that spells it", () => {
    expect(three.evaluate("10 Zentimeter", { locales: ["de"] }).value.unit).toBe("cm");
    expect(() => three.evaluate("10 Zentimeter", { locales: ["en"] })).toThrow();
    expect(() => three.evaluate("5 kg", { locales: ["de"] })).toThrow();
  });

  /**
   * The boot check, at three. German's `in` is English's `in` — the same
   * surface word, the same `Keyword` — so `buildKeywords` folds them into one
   * entry and three languages install cleanly. What it refuses is two
   * languages *disagreeing* about a word, which is asserted beside it so the
   * row above is a fact about the check rather than about it being lenient.
   */
  test("three languages fold into one keyword table, and a disagreement still throws", () => {
    expect(buildKeywords([en, uk, de]).get("in")).toBe("in");
    const disagrees = composeLocale(
      defineLanguage({
        id: "xx",
        numberFormat: "intl",
        keywords: { of: ["in"] },
        selectForm: () => "other",
      }),
    );
    expect(() => buildKeywords([en, uk, de, disagrees])).toThrow(KeywordConflictError);
  });

  /**
   * Installing a third language must move neither of the first two. The
   * splitter runs over every word this engine sees, English and Ukrainian
   * included, and a helper that claimed an English compound would be a
   * regression no German test could catch.
   */
  test("installing German moves no English or Ukrainian reading", () => {
    expect(three.evaluate("10 kilometers").formatted).toBe("10 kilometres");
    expect(three.evaluate("10 metres").formatted).toBe("10 metres");
    expect(three.evaluate("2 кг в грамах", { format: "uk" }).formatted).toBe(
      "2 000 грамів",
    );
  });
});

// --- what the seams do not take -----------------------------------------

/**
 * Two things German asks for that the shipped helpers deliberately do not
 * give it. Both are findings, written as tests so that the day a helper grows
 * to cover them the test fails and is rewritten, rather than quietly staying
 * true and telling a reader the limit is still there.
 */
describe("what a third language exposes that the helpers do not cover", () => {
  /**
   * The coupling a third language is what surfaced, and the reason `german`
   * above carries `identity()` even though its every unit word is a listed
   * alias.
   *
   * `createResolver` pools *every* installed language's chain over one shared
   * alias index, and looks a surface up only through the forms those chains
   * produced — there is no unconditional lookup of the raw word. So a language
   * whose `analyze` omits `identity()` cannot reach its own aliases *alone*,
   * and reaches all of them the moment any other installed language supplies
   * one, because the reading belongs to whoever *listed* the alias and not to
   * whoever produced the form. Both built-ins carry `identity()`, so a
   * two-language engine can never show this: English's chain silently covers
   * the gap, which is exactly what it does for German here.
   *
   * Left as a measurement rather than a fix. Making the resolver always try
   * the bare surface would be the obvious change and it is a behaviour change,
   * not a cleanup: `identity()` would stop being removable, and a language
   * that omits it today is opting out of exact matching on purpose (a
   * script-segmented language whose surfaces are never alias-shaped, say).
   * The finding a language author needs is the smaller one — **declare
   * `identity()`** — and the failure it prevents is silent, since the engine
   * answers a *different unit* rather than throwing.
   */
  test("a language's own aliases are not reachable without its own identity()", () => {
    const chainless = defineLanguage({
      ...german,
      analyze: [compoundSplitter({ vocabulary: LENGTHS, minPart: 3 })],
    });
    const alone = composeLocale(chainless, [GERMAN_LENGTH]);

    // Alone, the alias `zentimeter` is unreachable and the split's `meter`
    // wins by default — a wrong answer, not an error.
    const deOnly = createEngine({ locales: [alone], kinds: BUILTIN_KINDS, format: "de" });
    expect(deOnly.evaluate("10 Zentimeter").value.unit).toBe("m");

    // Install English beside it and the same broken chain answers correctly,
    // on English's `identity()`. This is the row that makes the bug invisible.
    const deAndEn = createEngine({
      locales: [alone, en],
      kinds: BUILTIN_KINDS,
      format: "de",
    });
    expect(deAndEn.evaluate("10 Zentimeter").value.unit).toBe("cm");
  });

  /**
   * `cardinalNumerals` reads a *run of words* and German writes a numeral as
   * one word: "einundzwanzig" is 21, units before tens, joined by "und", with
   * no spaces anywhere. English ("twenty two") and Ukrainian ("двадцять два")
   * both space their numerals, so both fit the run-of-words model and neither
   * exposed the assumption.
   *
   * The fix is not a bigger table — 21 through 99 are ninety words of pure
   * composition — it is a numeral *parser* that decomposes a single token,
   * which is a different function shape than `NumeralParser`'s
   * `(words) => …`. A German language ships its own `numerals`, which is why
   * this one declares none.
   */
  test("cardinalNumerals cannot express a German compound numeral", () => {
    const read = cardinalNumerals(GERMAN_CARDINALS);
    expect(read(["einundzwanzig"])).toBeNull();
    // Spaced out, it parses — as 1, stopping at "und", which is not a
    // connector for it. Not a near miss: the wrong number, not a refusal.
    expect(read(["ein", "und", "zwanzig"])?.value.toString()).toBe("1");
  });

  /**
   * The same assumption seen from the writing side, and the reason `spell`
   * above is used only for values under twenty. `cardinalSpeller` composes
   * with spaces, so it writes "zwanzig ein" where German writes
   * "einundzwanzig" — wrong order *and* wrong spacing, since the two tables
   * are the same tables read backwards and the parser's word order is what
   * gets inverted.
   */
  test("cardinalSpeller composes with spaces, which German does not", () => {
    const spell = cardinalSpeller(GERMAN_CARDINALS);
    expect(spell(new Decimal(12))).toBe("zwölf");
    expect(spell(new Decimal(21))).toBe("zwanzig ein");
    expect(spell(new Decimal(100))).toBe("ein hundert");
  });
});

/**
 * Three languages, three thousands-and-decimal spellings, one engine.
 *
 * This is the claim §A of the second-pass spec exists to make, and it needs a
 * third language to make it: with `en` and `uk` alone the two grammars share
 * no character, so a run that one reads the other stops at and the ranking
 * never has to happen. German's `(".", ",")` overlaps both — its group is
 * English's decimal, its decimal is Ukrainian's — so each of these three runs
 * is readable by more than one installed grammar and every one of them has to
 * come out as the value its writer meant.
 *
 * At the lexer, not at `evaluate`: which of several readings wins is the
 * solver's ranking, and that is Task 12's test. What is asserted here is that
 * the reading exists at all — before this, digits were read under the *format*
 * locale's grammar and nothing else, so a German word next to a German number
 * produced an English number at full confidence.
 */
test("an en+uk+de engine reads each thousand-and-decimal spelling to its intended value", () => {
  const locales = [en, uk, de];
  const tokenizer = new Tokenizer({
    locale: en,
    locales,
    registry: buildRegistry(BUILTIN_KINDS, locales),
  });
  const values = (input: string) =>
    ((tokenizer.run(input).tokens[0] as NumberToken).readings ?? []).map((r) =>
      r.value.toFixed(),
    );

  // Ukrainian: a group separator that `normalize()` has folded to a plain space.
  expect(values("1 000,5 кг")).toContain("1000.5");
  // German: the group separator English reads as a decimal point.
  expect(values("1.000,5 kg")).toContain("1000.5");
  // English: the group separator German reads as a decimal comma.
  expect(values("1,000.5 kg")).toContain("1000.5");
});
