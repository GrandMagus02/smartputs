import { describe, expect, test } from "bun:test";
import {
  buildRegistry,
  composeLocale,
  createEngine,
  defineLanguage,
  defineVocabulary,
  type Engine,
  type Locale,
  type Vocabulary,
} from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { ukrainian } from "@smartput/core/locale/uk";
import { BUILTIN_KINDS, length, mass } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_UK from "./locale/uk";

/**
 * Two languages in one engine (spec §9).
 *
 * The claim P4 makes is asymmetric and the asymmetry is the whole design
 * (decision I6): **recognition is many-locale, generation is exactly one.** An
 * engine handed `[en, uk]` reads a Ukrainian sentence and answers in English,
 * and the same pair with `format: "uk"` reads an English sentence and answers
 * in Ukrainian. Nothing here is about translating output — a `Result` is one
 * string in one language, never a table.
 *
 * Everything is asserted through `createEngine`, because the parts were
 * already many-locale before the whole was. `buildRegistry` has indexed every
 * installed language's aliases since P1, so a two-locale engine could read
 * "5 кг" and even "5 кг in pounds" long before P4 — those two rows pass on the
 * pre-P4 tree and prove nothing on their own. What could not be read was a
 * Ukrainian *sentence*: the connective and the spelled number went through one
 * language's tables. `reads a whole sentence in the other language` below is
 * the row that separates the trees, and it is deliberately first among the
 * additions.
 */
const en = composeLocale(english, BUILTIN_EN);
const uk = composeLocale(ukrainian, BUILTIN_UK);

/**
 * The same two languages installed both ways round, printing the other one
 * each time. Two engines rather than one because every claim in this file has
 * a mirror, and a suite that only ever put English in `format` would be
 * measuring English with extra steps.
 *
 * `format` is named explicitly on both, including where it matches the default
 * (`locales[0].id`), so that reordering `locales` in a future edit cannot
 * silently move the output language of half these tests.
 */
const both = createEngine({ locales: [en, uk], kinds: BUILTIN_KINDS, format: "en" });
const bothUk = createEngine({ locales: [uk, en], kinds: BUILTIN_KINDS, format: "uk" });

/** U+00A0, Ukrainian's thousands separator — invisible in source if written literally. */
const NBSP = "\u00A0";

describe("recognition is many-locale", () => {
  test("either language's spelling of a unit reaches the same reading", () => {
    expect(both.evaluate("5 kg").value.unit).toBe("kg");
    expect(both.evaluate("5 кг").value.unit).toBe("kg");
    expect(both.evaluate("5 кг in pounds").value.unit).toBe("lb");
  });

  /**
   * The row that fails on the pre-P4 tree, and the reason the three above are
   * not enough. `в`/`до` are Ukrainian's conversion keywords and `двадцять два`
   * is a Ukrainian spelled numeral; both are read by machinery that took a
   * single `Locale` before P4 (`lex`'s keyword scan, `foldNumerals`), so all
   * four of these threw `UnitParseError` on an engine whose format locale was
   * English. `помножити на` is the same claim for an operator keyword rather
   * than a connective.
   */
  test("reads a whole sentence in the other language", () => {
    expect(both.evaluate("5 кг в грамах").formatted).toBe("5,000 grams");
    expect(both.evaluate("5 кг до грамів").formatted).toBe("5,000 grams");
    expect(both.evaluate("двадцять два кг").formatted).toBe("22 kilograms");
    expect(both.evaluate("5 кг помножити на 2").formatted).toBe("10 kilograms");
  });

  /**
   * And the mirror, which is not the same test with the strings swapped: it is
   * the English tables being reached from an engine that prints Ukrainian, so
   * a fix that special-cased the format language into the reader would pass
   * one of these two and fail the other.
   */
  test("reads a whole sentence in the other language, the other way round", () => {
    expect(bothUk.evaluate("5 kg in grams").formatted).toBe(`5${NBSP}000 грамів`);
    expect(bothUk.evaluate("twenty two kg").formatted).toBe("22 кілограми");
  });

  /**
   * One clause from each language in a single expression — the case neither
   * mirror above covers, because each of those is monolingual input read by a
   * bilingual engine. Here the connective comes from one vocabulary and the
   * unit words from the other, in both directions.
   */
  test("a conversion crosses languages within one expression", () => {
    // Ukrainian source, English target — the plan's row, spelled out.
    expect(both.evaluate("2 кг in grams").formatted).toBe("2,000 grams");
    // English source, Ukrainian target — its mirror.
    expect(both.evaluate("2 kg в грамах").formatted).toBe("2,000 grams");
    expect(both.evaluate("5 kg в фунтах").value.unit).toBe("lb");
    // And the same pair on the engine that prints Ukrainian, since the output
    // language is the one thing that must not follow the input's.
    expect(bothUk.evaluate("2 kg в грамах").formatted).toBe(`2${NBSP}000 грамів`);
    expect(bothUk.evaluate("2 кг in grams").formatted).toBe(`2${NBSP}000 грамів`);
  });
});

describe("generation is single-locale", () => {
  test("the answer is in the format language whatever the input was", () => {
    expect(both.evaluate("5 кг").formatted).toBe("5 kilograms");
    expect(bothUk.evaluate("5 kg").formatted).toBe("5 кілограмів");
  });

  /**
   * `EvalOptions.locales` narrows *recognition*. It is the one option that
   * could plausibly be read as "answer me in this language", so the check that
   * it does not is worth its own test rather than an extra line above: filter
   * the reading down to Ukrainian and the answer is still English, filter it
   * down to English on the Ukrainian engine and the answer is still Ukrainian.
   */
  test("filtering recognition does not change the output language", () => {
    expect(both.evaluate("5 кг", { locales: ["uk"] }).formatted).toBe("5 kilograms");
    expect(both.evaluate("2 кг в грамах", { locales: ["uk"] }).formatted).toBe(
      "2,000 grams",
    );
    expect(bothUk.evaluate("5 kg", { locales: ["en"] }).formatted).toBe("5 кілограмів");
  });

  /**
   * The filter is on the language that *listed the spelling*, so it can refuse
   * a surface the engine can plainly read — which is the behaviour, not a
   * defect, and is what makes the test above non-trivial.
   *
   * `"кг"` is listed only by Ukrainian, so `{ locales: ["en"] }` refuses it.
   * `"kg"` is listed by *both* languages, and the alias index keeps one entry
   * per (kind, unit) tagged with the first language that reached it — locale
   * ids sorted, so `"en"` — which is why `{ locales: ["uk"] }` refuses it too.
   * Refusing a recognised surface is `DimensionMismatchError`, the same answer
   * `{ kinds: [...] }` gives, and deliberately not `NoCandidateError`: a
   * reading existed and was declined.
   */
  test("the filter is on the vocabulary, not on the reader", () => {
    expect(() => both.evaluate("5 кг", { locales: ["en"] })).toThrow();
    expect(() => both.evaluate("5 kg", { locales: ["uk"] })).toThrow();
    expect(both.explain("5 кг").candidates.map((c) => c.locale)).toEqual(["uk"]);
    expect(both.explain("5 kg").candidates.map((c) => c.locale)).toEqual(["en"]);
  });
});

/**
 * A surface two languages spell the same and read differently.
 *
 * **The built-in pair cannot produce one** — measured, in the `test.skip`
 * below, not assumed: English is Latin and Ukrainian is Cyrillic throughout,
 * and where Ukrainian reuses a Latin symbol it reuses it for the *same* unit,
 * which the alias index folds into a single entry. So the plan's search over
 * `registry.aliasIndex` finds nothing, the test built on it would assert
 * nothing, and these two languages are invented instead. They are the same
 * device `locale/compose.test.ts` uses for keyword conflicts and for the same
 * reason.
 *
 * The ids are `"aa"`/`"ab"` rather than `"a"`/`"b"`: a single-letter primary
 * subtag is not a structurally valid BCP-47 tag and `Intl` throws
 * `RangeError` before any of this code runs.
 */
const tinyLanguage = (id: string) =>
  defineLanguage({
    id,
    numberFormat: "intl",
    keywords: { in: ["in"] },
    selectForm: () => "other",
  });

const AMBIGUOUS = "zz";

const aa = composeLocale(tinyLanguage("aa"), [
  defineVocabulary({
    locale: "aa",
    kind: "mass",
    units: {
      kg: { aliases: [AMBIGUOUS], symbol: AMBIGUOUS, forms: { other: AMBIGUOUS } },
    },
  }),
]);

const ab = composeLocale(tinyLanguage("ab"), [
  defineVocabulary({
    locale: "ab",
    kind: "length",
    units: {
      m: { aliases: [AMBIGUOUS], symbol: AMBIGUOUS, forms: { other: AMBIGUOUS } },
    },
  }),
]);

const TINY_KINDS = [mass, length];

describe("a locale: weight decides between two languages", () => {
  /**
   * The control, and the reason the two rows after it mean something: with no
   * weight at all the surface is a genuine tie and the engine refuses it. So
   * the weight is what moves the answer — not the order of `locales`, not the
   * order of the alias index, not which kind sorts first.
   */
  test("the surface really is ambiguous before any weight is applied", () => {
    const registry = buildRegistry(TINY_KINDS, [aa, ab]);
    const entries = registry.aliasIndex.get(AMBIGUOUS) ?? [];
    expect(new Set(entries.map((e) => e.locale)).size).toBe(2);
    expect(new Set(entries.map((e) => `${e.kind}:${e.unit}`)).size).toBe(2);
    expect(() =>
      createEngine({ locales: [aa, ab], kinds: TINY_KINDS }).evaluate(`5 ${AMBIGUOUS}`),
    ).toThrow();
  });

  test("a locale: weight flips a genuinely ambiguous surface", () => {
    const preferAa = createEngine({
      locales: [aa, ab],
      kinds: TINY_KINDS,
      weights: { "locale:aa": 20 },
    });
    const preferAb = createEngine({
      locales: [aa, ab],
      kinds: TINY_KINDS,
      weights: { "locale:ab": 20 },
    });
    expect(preferAa.evaluate(`5 ${AMBIGUOUS}`).kind).toBe("mass");
    expect(preferAb.evaluate(`5 ${AMBIGUOUS}`).kind).toBe("length");
    expect(preferAa.evaluate(`5 ${AMBIGUOUS}`).kind).not.toBe(
      preferAb.evaluate(`5 ${AMBIGUOUS}`).kind,
    );
  });

  /**
   * The same decision taken per call, by two different options, so that a
   * regression in either one is visible here rather than only in core's own
   * unit tests: a `locale:` weight in `EvalOptions.weights`, and the hard
   * filter `EvalOptions.locales`.
   */
  test("the same choice is available per call, by weight or by filter", () => {
    const neutral = createEngine({ locales: [aa, ab], kinds: TINY_KINDS });
    expect(
      neutral.evaluate(`5 ${AMBIGUOUS}`, { weights: { "locale:aa": 20 } }).kind,
    ).toBe("mass");
    expect(
      neutral.evaluate(`5 ${AMBIGUOUS}`, { weights: { "locale:ab": 20 } }).kind,
    ).toBe("length");
    expect(neutral.evaluate(`5 ${AMBIGUOUS}`, { locales: ["aa"] }).kind).toBe("mass");
    expect(neutral.evaluate(`5 ${AMBIGUOUS}`, { locales: ["ab"] }).kind).toBe("length");
  });
});

describe("the built-in pair's alias index", () => {
  /**
   * The plan's search, kept verbatim and kept skipped, because what it
   * documents is a fact about the built-in set rather than a property of the
   * engine: today no surface in `aliasIndex` carries entries from two
   * languages with two different (kind, unit) pairs, so this body would fail
   * on `expect(ambiguous).toBeDefined()`. Unskip it the day a third language
   * — or a Latin-script one beside English — makes it findable, and delete the
   * invented pair above at the same time.
   */
  test.skip("a real cross-language ambiguous surface exists", () => {
    const registry = buildRegistry(BUILTIN_KINDS, [en, uk]);
    const ambiguous = [...registry.aliasIndex.entries()].find(
      ([, es]) =>
        new Set(es.map((e) => e.locale)).size > 1 &&
        new Set(es.map((e) => `${e.kind}:${e.unit}`)).size > 1,
    );
    expect(ambiguous).toBeDefined();
  });

  /**
   * The live half of the pair above: the search finds *nothing*, asserted so
   * that the skipped test cannot quietly become wrong. If a future vocabulary
   * introduces a cross-language collision this fails and names it, which is
   * the moment to unskip the test above and reconsider the fixture.
   */
  test("has no cross-language ambiguous surface, and names any that appears", () => {
    const registry = buildRegistry(BUILTIN_KINDS, [en, uk]);
    const ambiguous = [...registry.aliasIndex.entries()]
      .filter(
        ([, es]) =>
          new Set(es.map((e) => e.locale)).size > 1 &&
          new Set(es.map((e) => `${e.kind}:${e.unit}`)).size > 1,
      )
      .map(
        ([surface, es]) =>
          `${surface}: ${es.map((e) => `${e.locale}/${e.kind}:${e.unit}`).join(", ")}`,
      );
    expect(ambiguous).toEqual([]);
    // Not vacuous for the trivial reason: the index is not empty.
    expect(registry.aliasIndex.size).toBeGreaterThan(500);
  });

  /**
   * Spec §9's isolation clause: *within* one language, a surface must not
   * resolve to two readings. Cross-language ambiguity is a ranking problem a
   * `locale:` weight can settle; ambiguity a single vocabulary creates on its
   * own is a vocabulary bug, and the two must not be allowed to look alike.
   * The registry is built per language rather than from the pair, so an
   * English word colliding with a Ukrainian one could never be mistaken for
   * one language contradicting itself.
   *
   * **The clause is not literally true of the built-in set, and the two
   * exceptions predate this plan entirely.** The plan's version of this test
   * asserted `distinct.size < 2` outright; run against the real index it fails
   * on 12 English surfaces and 32 Ukrainian ones, and every one of them is a
   * homograph two *kinds* declared on purpose:
   *
   * - `temperature` and `tempdelta` share every degree name in both languages
   *   ("5 °C" the reading and "5 °C" the difference are written the same), and
   *   `@smartput/temperature` ships them as one package for that reason.
   * - `"m"` is a metre and a minute. `ukrainian.test.ts` already names this
   *   one and calls it "the ambiguity machinery working": both readings are
   *   real, so the engine refuses "1 m" rather than guessing.
   *
   * Ukrainian collides on the same Latin surfaces because its temperature
   * vocabulary reuses the Latin aliases rather than retyping them, and adds
   * its own Cyrillic inflections on top — which is why its count is larger and
   * not why it is different.
   *
   * So the assertion is on the *pairs of kinds* that share a word, compared
   * exactly. A new word colliding inside one of these two pairs is the design
   * repeating itself and passes; a collision between any other two kinds — or
   * a surface claimed by three — fails and is named.
   */
  const DELIBERATE_HOMOGRAPHS = ["duration+length", "tempdelta+temperature"];

  test("alias isolation holds within a language, but for two declared homographs", () => {
    for (const locale of [en, uk]) {
      const registry = buildRegistry(BUILTIN_KINDS, [locale]);
      const collisions: string[] = [];
      const pairs = new Set<string>();
      for (const [surface, entries] of registry.aliasIndex) {
        const within = entries.filter((e) => e.locale === locale.id);
        const distinct = [...new Set(within.map((e) => `${e.kind}:${e.unit}`))].sort();
        if (distinct.length < 2) continue;
        collisions.push(`${locale.id}: ${surface} resolves to ${distinct.join(", ")}`);
        pairs.add([...new Set(distinct.map((d) => d.split(":")[0]))].sort().join("+"));
      }
      expect([...pairs].sort(), collisions.join("\n")).toEqual(DELIBERATE_HOMOGRAPHS);
      // Both exceptions are cross-*kind*, never two units of one kind: that
      // would be a single vocabulary contradicting itself, which is the bug
      // this clause is actually about and which no locale has.
      for (const line of collisions) {
        const kinds = new Set(
          line
            .split("resolves to ")[1]
            ?.split(", ")
            .map((d) => d.split(":")[0]),
        );
        expect(kinds.size, line).toBe(2);
      }
    }
  });
});

/**
 * The one alias whose reading a second language legitimately changes, named
 * here rather than filtered out of the sweep by a rule.
 *
 * `number:one`'s alias is the Latin self-alias `"one"` — machinery, not a word
 * either language's readers type: `formatNumber` emits "7.25one" and strict
 * `parseNumber` reads it back, in any locale, so it stays in the Ukrainian
 * table unchanged (`@smartput/number/locale/uk` explains it at length). On an
 * engine that speaks only Ukrainian nothing claims the Latin word, so "5 one"
 * resolves through the alias. Install English beside it and English's own
 * cardinal parser eats "one" first, exactly as it does on a monolingual
 * English engine, and "5 one" becomes two adjacent numbers. That is not a
 * dedupe regression; it is one language's numerals claiming a word the other
 * left free, and it is the only place in 1,037 aliases where installing a
 * second language moves an answer.
 */
const CLAIMED_BY_THE_OTHER_LANGUAGE = new Set(["uk number:one one"]);

/**
 * Every alias of every unit of every kind, in both languages, read three ways.
 *
 * This is the sweep P3 argues for. P3 shipped four kinds that printed strings
 * they could not read back, with a green suite, because every test asserted
 * what the code did rather than what a user needs — and the specific shape of
 * that mistake was sampling one kind (mass) and generalising. So the assertion
 * here is not "mass works in both languages"; it is that **installing a second
 * language changes no reading at all**, over the whole roster.
 *
 * The oracle is the single-locale engine, which is what makes the sweep
 * meaningful without a skip list. Comparing against the declared (kind, unit)
 * would need one: `"m"` is ambiguous between `length:m` and `duration:min`,
 * `"цельсій"` resolves to `temperature:c` rather than `tempdelta:c`, `"°"` is
 * not a word token at all, and `"кВт·год"` is read as a product and comes back
 * in the kind's canonical unit. Every one of those is true of a monolingual
 * engine too, so comparing engine to engine holds them all fixed and leaves
 * exactly the multi-locale question. Throwing counts as an answer — the error
 * class has to match as well — because "used to throw, now silently reads as
 * something else" is the failure this is looking for.
 *
 * The third engine is the pair installed in the opposite order and printing
 * the other language, which pins the second half of the claim: *which*
 * readings exist is a property of the set of installed languages, never of
 * their order or of which one won the `format` slot.
 */
const reading = (engine: Engine, input: string): string => {
  try {
    const { kind, unit } = engine.evaluate(input).value;
    return `${kind}:${unit}`;
  } catch (error) {
    return (error as Error).constructor.name;
  }
};

describe("installing a second language changes no reading", () => {
  test("every alias of every unit reads the same as it does alone", () => {
    const disagreements: string[] = [];
    let swept = 0;
    for (const [locale, vocabularies] of [
      [en, BUILTIN_EN],
      [uk, BUILTIN_UK],
    ] as ReadonlyArray<readonly [Locale, readonly Vocabulary[]]>) {
      const alone = createEngine({ locales: [locale], kinds: BUILTIN_KINDS });
      for (const vocabulary of vocabularies) {
        for (const [unit, words] of Object.entries(vocabulary.units)) {
          for (const alias of words?.aliases ?? []) {
            const label = `${locale.id} ${vocabulary.kind}:${unit} ${alias}`;
            if (CLAIMED_BY_THE_OTHER_LANGUAGE.has(label)) continue;
            swept++;
            const input = `5 ${alias}`;
            const solo = reading(alone, input);
            const pair = reading(both, input);
            const reversed = reading(bothUk, input);
            if (solo !== pair || solo !== reversed) {
              disagreements.push(
                `${label}: alone=${solo} [en,uk]=${pair} [uk,en]=${reversed}`,
              );
            }
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
    // The loop is the assertion, so its size is one too: a barrel that lost a
    // vocabulary would make every check above pass over fewer words and say
    // nothing. 1,037 aliases today, minus the one named above.
    expect(swept).toBeGreaterThan(1000);
  });

  /**
   * And the exception itself, asserted rather than merely excluded — a skip
   * nobody checks is how a real regression hides behind a documented one.
   */
  test("the one exception is English's numerals claiming a Latin word", () => {
    const ukAlone = createEngine({ locales: [uk], kinds: BUILTIN_KINDS });
    expect(ukAlone.evaluate("5 one").value.kind).toBe("number");
    expect(() => both.evaluate("5 one")).toThrow();
    // The same refusal a monolingual English engine gives, which is the point:
    // the two-locale engine is not doing anything English does not already do.
    expect(() =>
      createEngine({ locales: [en], kinds: BUILTIN_KINDS }).evaluate("5 one"),
    ).toThrow();
  });
});

/**
 * English is frozen (spec §11). `parity.test.ts` in core is the corpus-wide
 * net and it runs a single-locale engine; this is the same claim made about a
 * *two*-locale one, which parity cannot see. A change that moved English only
 * when Ukrainian was installed beside it would pass every other net in the
 * repo.
 */
describe("English has not moved", () => {
  test("a two-locale engine prints what a one-locale engine prints", () => {
    const enAlone = createEngine({ locales: [en], kinds: BUILTIN_KINDS });
    for (const input of [
      "5 kg",
      "1 kilogram",
      "2 kg in grams",
      "twenty two kg",
      "1.5 kilograms",
      "100 km in miles",
      "2 kw * 3 h",
    ]) {
      expect(both.evaluate(input).formatted, input).toBe(
        enAlone.evaluate(input).formatted,
      );
    }
  });

  test("the bytes themselves, so a shared regression cannot look like agreement", () => {
    expect(both.evaluate("5 kg").formatted).toBe("5 kilograms");
    expect(both.evaluate("2 kg in grams").formatted).toBe("2,000 grams");
    expect(both.evaluate("twenty two kg").formatted).toBe("22 kilograms");
  });
});
