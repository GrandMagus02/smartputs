import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberId from "@smartput/number/locale/id";
// Through the package path, not "./id": the exports map is the only route a consumer
// has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyId from "@smartput/rate/locale/id";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives an Indonesian word, and no more. The words are
 * checked by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of rates has
 * to cover the table of words, and a word added below with no rate here fails loudly
 * rather than going unchecked.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  UAH: 45,
  PLN: 4.3,
  JPY: 160,
  CHF: 0.94,
});
const locale = composeLocale(indonesian, [numberId, moneyId]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** The key `indonesian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  indonesian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The closed key set this language can produce. `en` and `nl` have two, `uk` eight. */
const ONE_KEY = ["other"];

/** The currencies this file gives Indonesian words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/**
 * Every word this vocabulary adds on top of the generated table, by currency.
 *
 * Derived by subtracting the generated aliases rather than by matching a script —
 * the only route available here, and a stricter constraint than Dutch's: `uk.test.ts`
 * finds its own words with `/[Ѐ-ӿ]/` because Cyrillic is a different alphabet, and
 * Indonesian is written in *unaccented* Latin, so it has not even a trema to grep for.
 */
const added: Array<[string, string]> = Object.entries(moneyId.units).flatMap(
  ([code, words]) => {
    const generated = new Set(CURRENCIES[code]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [code, a]);
  },
);

describe("money id vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyId.units).sort()).toEqual(units.sort());
    expect(moneyId.locale).toBe("id");
    expect(moneyId.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind is
  // ratios, ISO codes and magnitude bands, so no Indonesian word may reach it. A
  // script regex is useless here — Indonesian is unaccented Latin, the same characters
  // an ISO code is written in — so this greps for the words themselves.
  test("the kind itself carries no Indonesian word", () => {
    expect(JSON.stringify(money)).not.toMatch(/dolar|poundsterling|rupiah/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyId.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so they
    // come through untouched and the Indonesian words are appended after them. Losing
    // them would mean "30 usd" stops parsing the moment the format locale changes:
    // recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyId.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyId.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary; the
  // words behind it are English either way. This is the assertion that says so out
  // loud, so that the day `CURRENCIES` grows localized names, the file above stops
  // being right and this stops being green together.
  test('currencyVocabulary("id") is English words under an id label', () => {
    const generated = currencyVocabulary("id");
    expect(generated.locale).toBe("id");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // The trap Dutch sets that Indonesian only half sets, and the reason this file still
  // replaces the generated `forms` wholesale. `english.selectForm` and
  // `indonesian.selectForm` overlap on exactly one key — `"other"` — so an Indonesian
  // engine carrying the generated table would never miss a lookup either: the `one`
  // cell would simply go unindexed. What survives is the `other` cell, which says
  // "dollars": English, and plural besides, in a language that has no plural at all.
  // The keys are compatible; the words are not.
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyId.units)) {
      for (const english of ["dollars", "euros", "pounds", "francs", "dollar"]) {
        expect(Object.values(words.forms ?? {}), code).not.toContain(english);
      }
    }
    // And the overlap really is there, which is what makes the paragraph above a trap
    // rather than a hypothetical: `other` is a key both languages produce.
    expect(Object.keys(currencyVocabulary("en").units.usd?.forms ?? {})).toContain(
      "other",
    );
  });

  test("every translated currency carries exactly the one grammatical key", () => {
    expect(
      Object.keys(moneyId.units)
        .filter((code) => moneyId.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyId.units[code]?.forms ?? {}).sort(), code).toEqual(ONE_KEY);
    }
    // And the key set is closed on the language's side too: no count and no slot can
    // produce a second key for the table to be missing. This is the row the
    // three-type split was designed to be able to reach — `uk` writes eight cells per
    // currency here, `de` four, `en` and `nl` two — and nothing is missing from it.
    const produced = new Set(
      [undefined, 0, 1, 2, 5, 11, 21, 100, 1000, 1.5].flatMap((count) => [
        key("usd", "after-number", count),
        key("usd", "conversion-target", count),
      ]),
    );
    expect([...produced].sort()).toEqual(ONE_KEY);
    // Measured rather than asserted: CLDR gives Indonesian exactly one plural
    // category, so one row is the correct table and never a stub.
    expect(new Intl.PluralRules("id").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("the five with no single-word Indonesian name declare none", () => {
    // One reason with two shapes, deliberately not collapsed. CAD and AUD are the head
    // noun USD already owns followed by a country — "dolar Kanada", "dolar Australia"
    // — and a unit word is one token, which is why `en` omits display forms for
    // exactly these two. SEK, NOK and CZK are the same shape one level worse ("krona
    // Swedia"), and unlike Japanese — which lists カナダドル because its script writes
    // no spaces — Indonesian never closes such a phrase up.
    for (const code of UNTRANSLATED) {
      expect(moneyId.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims an Indonesian word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach them, in
      // either language.
      expect(moneyId.units[code]?.aliases, code).toContain(code);
    }
  });

  // The gap invisible to every other test here, and one this language cannot afford to
  // have: a printed form that is not a listed alias is unreachable outright, because
  // `indonesian.analyze` is a bare `identity()` with no stripper to rescue it. The
  // Dutch file's copy of this test can lean on a `-2` penalised reading; this one
  // cannot, which is why the containment is the whole safety net.
  test("every form it prints is a form it reads", () => {
    expect(indonesian.analyze?.length).toBe(1);
    for (const [unit, words] of Object.entries(moneyId.units)) {
      const aliases = words.aliases.map((a) => a.toLowerCase());
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form.toLowerCase());
      }
    }
  });

  // The two words Indonesian genuinely spells its own way, and the shape of each. The
  // EYD respelling simplifies a doubled consonant, so "dollar" is *dolar*; and
  // *poundsterling* is a lexicalised borrowing of the whole English phrase, closed up,
  // which is striking in a language that otherwise never compounds — and is exactly
  // what makes it reachable, since an alias index is keyed by one segmented word.
  test("the two respellings are listed, and nothing else is", () => {
    expect(added.map(([, alias]) => alias).sort()).toEqual(["dolar", "poundsterling"]);
    expect(engine.evaluate("30 dolar").value?.unit).toBe("usd");
    expect(engine.evaluate("30 poundsterling").value?.unit).toBe("gbp");
    // The phrase written apart is two tokens and can never be one alias, which is the
    // same limit "dolar Kanada" runs into.
    expect(() => engine.evaluate("30 pound sterling")).toThrow();
  });

  // No plural is listed anywhere, and that is structural rather than an omission:
  // Indonesian has none. Every sibling file in this package declares some — `nl` writes
  // out *ponden* and *franken* because its stripper cannot reach them, `uk` writes six
  // cells of them — and there is nothing here for them to correspond to.
  test("no plural is listed, because the language has none", () => {
    for (const [, alias] of added) expect(alias).not.toMatch(/s$/);
    // The same word after every count, read off the table rather than through the
    // formatter — `money` prints "$30,00" whatever the grammar says, so this is the
    // only place the words are visible.
    const usd = moneyId.units.usd?.forms;
    for (const count of [1, 2, 5, 21, 1.5, 1000]) {
      expect(usd?.[key("usd", "after-number", count)], `${count}`).toBe("dolar");
    }
  });

  test("no Indonesian word is claimed by two currencies", () => {
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

  // The finding this package hands upstream, written as an assertion so it fails the
  // day it is fixed instead of staying as a stale comment. The rupiah has no unit id
  // for this file to name: `CURRENCIES` is the set ECB's daily reference file quotes
  // plus the euro, IDR is not among them, and a `Vocabulary` may only name units the
  // kind declares. The repair is a row in `@smartput/currency` and a rate source that
  // quotes it, neither of which is this package.
  test("records that the rupiah has no unit to name", () => {
    expect(Object.keys(CURRENCIES)).not.toContain("idr");
    expect(Object.keys(moneyId.units)).not.toContain("idr");
    for (const [, alias] of added) expect(alias).not.toBe("rupiah");
    expect(() => engine.evaluate("30 rupiah")).toThrow();
  });

  test("satisfies the locale contract", () => {
    // One waiver, and it costs an explanation. `skipPrintable` waives only the
    // print-and-read-back half of the contract, and it is taken for every currency
    // because `money`'s format hook prints `symbolOf(code)` — "€", "CHF", "zł" — which
    // is readable back as an alias in no language, `en` included: a currency sign is
    // notation, not a word. Every alias is still asserted to resolve back to its own
    // currency, and every `forms` key the language can ask for is still swept for.
    const skipPrintable = Object.keys(moneyId.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so they never reach a fractional reading at
    // all — and this kind *has* a `forms` table for the sweep to index, which makes the
    // fractional row a real check here rather than the vacuous one it is next door in
    // `percent`. Under `id` it confirms that a fraction lands on the same single key
    // an integer does, which is the whole claim this vocabulary's shape rests on.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        skipPrintable,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Indonesian money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits: Indonesian marks
    // the decimal with "," and groups with ".", the exact inverse of English.
    expect(engine.evaluate("30 dolar").formatted).toBe("$30,00");
    expect(engine.evaluate("30 pound").formatted).toBe("£30,00");
    expect(engine.evaluate("30 franc").formatted).toBe("CHF30,00");
    expect(engine.evaluate("30 hryvnia").formatted).toBe("₴30,00");
    expect(engine.evaluate("30 poundsterling").formatted).toBe("£30,00");
    // Capitalised as a sentence-initial accident and lowercase as Indonesian writes a
    // common noun: both reach the same reading, because analyzers are handed the
    // surface exactly as typed and the index folds.
    expect(engine.evaluate("30 Dolar").formatted).toBe("$30,00");
    // A conversion, through each of this language's `in` words, whose result groups —
    // and, as Indonesian groups with ".", the grouped output is something this engine
    // could read back if the symbol were a word.
    expect(engine.evaluate("100 dolar ke hryvnia").formatted).toBe("₴4.090,91");
    expect(engine.evaluate("100 dolar dalam euro").formatted).toBe("€90,91");
    // A sum, and a sum that lands on a fraction: two minor units, so the second rounds
    // rather than truncating.
    expect(engine.evaluate("10 euro tambah 5 euro").formatted).toBe("€15,00");
    expect(engine.evaluate("10 euro bagi 4").formatted).toBe("€2,50");
  });

  test("the Latin aliases still read in an Indonesian engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    // Including the English plural, which this language has no use for and still
    // reads: recognition is many-to-one and generation is one.
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd dalam euro").formatted).toBe("€90,91");
  });

  test("the slot is read and discarded, along with everything else", () => {
    // German's copy of this test asserts that its `in` governs the dative and moves the
    // key to `dat-*`; Dutch's asserts that it has no case left to move. Indonesian has
    // no axis at all — `selectForm` ignores both arguments — so a conversion target
    // selects exactly the key a bare quantity does, and so does a count-free call
    // (ruling R5).
    expect(key("chf", "after-number", 5)).toBe("other");
    expect(key("chf", "conversion-target", 5)).toBe("other");
    expect(key("chf", "conversion-target")).toBe("other");
    const chf = moneyId.units.chf?.forms;
    expect(chf?.[key("chf", "conversion-target")]).toBe("franc");
    expect(chf?.[key("chf", "after-number", 1)]).toBe("franc");
  });

  test("completion inserts an Indonesian word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the format
    // hook prints a symbol: completion splices the count and the selected form, and the
    // result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 dola");
    expect(first?.text).toBe("30 dolar");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("usd");
  });

  test("round-trips its own output", () => {
    // What can round-trip here is the *word* path, not the symbol path: `money`'s
    // format hook prints "€30,00", and a currency sign is an alias of nothing in any
    // language, so the printed string is display and not input. The strings below are
    // what completion inserts and what a user types, and they are what has to survive
    // the trip.
    for (const input of [
      "30 euro",
      "1,5 euro",
      "30 dolar",
      "30 franc",
      "30 hryvnia",
      "100 dolar dalam euro",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyId.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`${first.value?.canonical.toString()} ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does not
    // throw, which is worse than throwing and is why it is written down: `lex` skips
    // "€" as an unrecognized character, so "€30,00" comes back as the bare *number* 30
    // with the currency silently gone. That is core's lexer, identical under `en` for
    // "$30.00", and nothing a vocabulary can reach; the word path above is the one that
    // round-trips.
    const printed = engine.evaluate("30 euro").formatted;
    expect(printed).toBe("€30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
