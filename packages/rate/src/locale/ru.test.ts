import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberRu from "@smartput/number/locale/ru";
// Through the package path, not "./ru": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyRu from "@smartput/rate/locale/ru";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Russian word, and no more. The words are
 * checked by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of rates
 * has to cover the table of words, and a word added below with no rate here
 * fails loudly rather than going unchecked.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  UAH: 45,
  PLN: 4.3,
  JPY: 160,
  CHF: 0.94,
});
const locale = composeLocale(russian, [numberRu, moneyRu]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

const CYRILLIC = /[Ѐ-ӿ]/;

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

/** The currencies this file gives Russian words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyRu.units).flatMap(
  ([code, words]) =>
    words.aliases.filter((a) => CYRILLIC.test(a)).map((a): [string, string] => [code, a]),
);

describe("money ru vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyRu.units).sort()).toEqual(units.sort());
    expect(moneyRu.locale).toBe("ru");
    expect(moneyRu.kind).toBe("money");
  });

  // The absence a Russian reader notices first, asserted rather than explained
  // away: `CURRENCIES` holds no `rub`, so the kind declares no unit for the
  // rouble and a `Vocabulary` — which names units and cannot add them — has
  // nothing to attach "рубль" to. The fix is a row in `@smartput/currency` and a
  // quote in a snapshot, both on the language-free side of the split.
  test("there is no rouble to name, because the kind declares none", () => {
    expect(CURRENCIES.rub).toBeUndefined();
    expect(moneyRu.units.rub).toBeUndefined();
    expect(JSON.stringify(moneyRu)).not.toMatch(/рубл/);
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so no script but ASCII may
  // reach it. Cyrillic in the descriptor would mean a translation had leaked into
  // the half of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(money)).not.toMatch(CYRILLIC);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyRu.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Russian words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyRu.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyRu.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned
  // vocabulary; the words behind it are English either way. This is the assertion
  // that says so out loud, so that the day `CURRENCIES` grows localized names,
  // the file above stops being right and this stops being green together.
  test('currencyVocabulary("ru") is English words under a ru label', () => {
    const generated = currencyVocabulary("ru");
    expect(generated.locale).toBe("ru");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  test("the English forms it generates are dropped, not carried", () => {
    // `one`/`other` is what `english.selectForm` produces. `russian.selectForm`
    // returns neither, so keeping the generated table would leave eight keys the
    // engine can only miss — and every word in it is English besides.
    for (const [code, words] of Object.entries(moneyRu.units)) {
      expect(Object.keys(words.forms ?? {}), code).not.toContain("one");
      expect(Object.keys(words.forms ?? {}), code).not.toContain("other");
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints a Latin word`).toMatch(CYRILLIC);
      }
    }
  });

  test("every translated currency carries all eight grammatical keys", () => {
    expect(
      Object.keys(moneyRu.units)
        .filter((code) => moneyRu.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyRu.units[code]?.forms ?? {}).sort(), code).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  test("the five with no single-word Russian name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a
    // qualifier plus the head noun USD already owns ("канадский доллар"), and a
    // unit word is one token — which is why `en` omits display forms for exactly
    // these two. SEK, NOK and CZK are worse: Russian calls all three "крона", so
    // the word has no reading at all and is left unclaimed rather than handed to
    // whichever was written first.
    for (const code of UNTRANSLATED) {
      expect(moneyRu.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims a Russian word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach
      // them, in either language.
      expect(moneyRu.units[code]?.aliases, code).toContain(code);
    }
    // And the Cyrillic word itself is claimed by nothing at all — unlike German,
    // where "Krone" is already `nok`'s own generated alias and the collision is
    // decided upstream. Nothing in the Latin table spells it, so leaving it out
    // is a choice this file makes rather than one it inherits.
    expect(added.some(([, alias]) => alias.startsWith("крон"))).toBe(false);
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the Russian suffix stripper recovers
  // it — at `weight: -2`. Asserting the containment is what keeps the two halves
  // of an entry, what it writes and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyRu.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Russian word is claimed by two currencies", () => {
    const owner = new Map<string, string>();
    for (const [code, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two currencies`).toBeUndefined();
      owner.set(alias, code);
    }
  });

  test("every word it adds resolves back to its own currency", () => {
    for (const [code, alias] of added) {
      expect(engine.evaluate(`30 ${alias}`).value?.unit, alias).toBe(code);
    }
  });

  test("satisfies the locale contract", () => {
    // One waiver, and it costs an explanation. `skipPrintable` waives only the
    // print-and-read-back half of the contract, and it is taken for every
    // currency because `money`'s format hook prints `symbolOf(code)` — "€",
    // "CHF", "zł" — which is readable back as an alias in no language, `en`
    // included: a currency sign is notation, not a word. Every alias is still
    // asserted to resolve back to its own currency, and every `forms` key the
    // language can ask for is still swept for.
    const skipPrintable = Object.keys(moneyRu.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so `russian.selectForm`'s `other`
    // category is never reached through a fraction at all — and this kind *has* a
    // `forms` table for the sweep to index, which makes the fractional row a real
    // check here rather than the vacuous one it is next door in `percent`.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        skipPrintable,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Russian money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency
    // symbol, minor units — so what the language decides here is the digits:
    // Russian marks the decimal with "," and groups with U+00A0, written as an
    // escape because a literal NBSP is invisible in source.
    expect(engine.evaluate("30 долларов").formatted).toBe("$30,00");
    expect(engine.evaluate("30 гривен").formatted).toBe("₴30,00");
    expect(engine.evaluate("30 грн").formatted).toBe("₴30,00");
    expect(engine.evaluate("5 злотых").formatted).toBe("zł5,00");
    expect(engine.evaluate("30 баксов").formatted).toBe("$30,00");
    // The Ukrainian shape of the hryvnia, which Russian writing about Ukraine
    // quotes: it reads, and it is never printed.
    expect(engine.evaluate("30 гривень").formatted).toBe("₴30,00");
    expect(engine.evaluate("100 долларов в гривнах").formatted).toBe("₴4\u00A0090,91");
    expect(engine.evaluate("10 гривен + 5 гривен").formatted).toBe("₴15,00");
    // A sum that lands on a fraction, which is where a currency's minor units and
    // the fractional grammatical row meet: 1,5 selects `nom-other`, the genitive
    // singular "доллара", even though the format hook prints the sign and the
    // digits and never the word.
    expect(engine.evaluate("1 доллар + 0,5 доллара").formatted).toBe("$1,50");
    expect(engine.evaluate("10 евро разделить на 4").formatted).toBe("€2,50");
  });

  test("the Latin aliases still read in a Russian engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd в гривнах").formatted).toBe("₴4\u00A0090,91");
  });

  test("the number decides the case, and the fractional row is a singular", () => {
    // The rows a `one`/`other` table cannot express, read off the table rather
    // than through the formatter — `money` prints "$1,50" whatever the grammar
    // says, so this is the only place the words are visible.
    const usd = moneyRu.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("доллар");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("доллара");
    expect(usd?.[key("usd", "after-number", 5)]).toBe("долларов");
    // 21 is `one` in CLDR's Russian rules — the category follows the last digit —
    // so "21 доллар" is singular where "21 dollars" is not.
    expect(usd?.[key("usd", "after-number", 21)]).toBe("доллар");
    // The fractional row: genitive *singular*, and the assertion that would read
    // "долларов" if a plural had been written into `nom-other`.
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("доллара");
    // And the Russian coincidence a `uk` port breaks: the 2/3/4 row and the
    // fractional row are the same word, for two different grammatical reasons —
    // the old dual and the genitive a fraction governs. Ukrainian's are two
    // different words ("2 долари" against "1,5 долара"), so a table copied across
    // and restemmed would print "2 доллары" here and pass every shape-based check
    // in this file.
    expect(usd?.[key("usd", "after-number", 2)]).toBe(
      usd?.[key("usd", "after-number", 1.5)],
    );
    // The adjectival paradigm answers differently in every one of those cells,
    // which is why `pln` is not `usd` with the stem swapped — and its 2/3/4 row is
    // a genitive *plural*, which is what an adjectival noun takes.
    const pln = moneyRu.units.pln?.forms;
    expect(pln?.[key("pln", "after-number", 2)]).toBe("злотых");
    expect(pln?.[key("pln", "after-number", 5)]).toBe("злотых");
    expect(pln?.[key("pln", "after-number", 1.5)]).toBe("злотого");
    // Feminine hard: the genitive plural is a bare stem, "5 иен", with no ending
    // at all.
    expect(moneyRu.units.jpy?.forms?.[key("jpy", "after-number", 5)]).toBe("иен");
    // Indeclinable: one word in all eight cells, which is a fact about the noun
    // and not a table that was left half-filled.
    expect(new Set(Object.values(moneyRu.units.eur?.forms ?? {}))).toEqual(
      new Set(["евро"]),
    );
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract: the same count picks a nominative form after a
    // number and a prepositional one as a conversion target, and a target with no
    // count at all lands on `loc-other` — "в гривнах", the row a one-dimensional
    // plural table had no cell for.
    const uah = moneyRu.units.uah?.forms;
    expect(uah?.[key("uah", "after-number", 5)]).toBe("гривен");
    expect(uah?.[key("uah", "conversion-target", 5)]).toBe("гривнах");
    expect(key("uah", "conversion-target")).toBe("loc-other");
    expect(uah?.[key("uah", "conversion-target")]).toBe("гривнах");
    // The masculine prepositional singular is its own ending, so the slot axis is
    // not one suffix applied to every stem: "в одном франке", not "в франках" —
    // and it is -е where Ukrainian's is -у, which is the kind of difference a
    // port loses silently.
    expect(moneyRu.units.chf?.forms?.[key("chf", "conversion-target", 1)]).toBe("франке");
  });

  test("completion inserts a Russian word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 грив");
    expect(first?.text).toBe("30 гривен");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
  });

  test("round-trips its own output", () => {
    // What can round-trip here is the *word* path, not the symbol path:
    // `money`'s format hook prints "$30,00", and a currency sign is an alias of
    // nothing in any language, so the printed string is display and not input.
    // The strings below are what completion inserts and what a user types — one
    // per grammatical row, since Russian's four rows are four different words —
    // and they are what has to survive the trip.
    for (const input of [
      "1 доллар",
      "2 доллара",
      "5 долларов",
      "1,5 доллара",
      "30 гривен",
      "5 злотых",
      "100 долларов в гривнах",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyRu.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`30 ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does
    // not throw, which is worse than throwing and is why it is written down:
    // `lex` skips "$" as an unrecognized character, so "$30,00" comes back as the
    // bare *number* 30 with the currency silently gone. That is core's lexer,
    // identical under `en` for "$30.00", and nothing a vocabulary can reach; the
    // word path above is the one that round-trips.
    const printed = engine.evaluate("30 долларов").formatted;
    expect(printed).toBe("$30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
