import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberTr from "@smartput/number/locale/tr";
// Through the package path, not "./tr": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyTr from "@smartput/rate/locale/tr";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Turkish word, and no more. The words are
 * checked by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of rates
 * has to cover the table of words, and a word added below with no rate here fails
 * loudly rather than going unchecked.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  UAH: 45,
  PLN: 4.3,
  JPY: 160,
  CHF: 0.94,
});
const locale = composeLocale(turkish, [numberTr, moneyTr]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** The key `turkish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  turkish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The closed key set this language can produce. `en` and `nl` have two, `uk` eight. */
const ONE_KEY = ["other"];

/** The currencies this file gives Turkish words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/**
 * Every word this vocabulary adds on top of the generated table, by currency.
 *
 * Derived by subtracting the generated aliases rather than by matching a script
 * — the only route available here: `uk.test.ts` finds its own words with
 * `/[Ѐ-ӿ]/` because Cyrillic is a different alphabet, and every Turkish word
 * below happens to be spelled in unaccented Latin, so there is not even a cedilla
 * to grep for.
 */
const added: Array<[string, string]> = Object.entries(moneyTr.units).flatMap(
  ([code, words]) => {
    const generated = new Set(CURRENCIES[code]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [code, a]);
  },
);

describe("money tr vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyTr.units).sort()).toEqual(units.sort());
    expect(moneyTr.locale).toBe("tr");
    expect(moneyTr.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so no Turkish word may reach
  // it. A script regex is useless here — Turkish is Latin, the same characters an
  // ISO code is written in — so this greps for the words themselves.
  test("the kind itself carries no Turkish word", () => {
    expect(JSON.stringify(money)).not.toMatch(/dolar|sterlin|grivna|zloti|avro|lira/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyTr.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Turkish words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyTr.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyTr.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together. It is the one finding
  // this package hands upstream about the generator rather than about the
  // language.
  test('currencyVocabulary("tr") is English words under a tr label', () => {
    const generated = currencyVocabulary("tr");
    expect(generated.locale).toBe("tr");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // The trap Dutch sets that Turkish only half sets, and the reason this file
  // still replaces the generated `forms` wholesale. `english.selectForm` and
  // `turkish.selectForm` overlap on exactly one key — `"other"` — so a Turkish
  // engine carrying the generated table would never miss a lookup either: the
  // `one` cell would simply go unindexed. What survives is the `other` cell, which
  // says "dollars": English, and plural besides, in a language where a counted
  // noun is never plural. The keys are compatible; the words are not.
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyTr.units)) {
      for (const english of ["dollars", "euros", "pounds", "francs", "dollar"]) {
        expect(Object.values(words.forms ?? {}), code).not.toContain(english);
      }
    }
    // And the overlap really is there, which is what makes the paragraph above a
    // trap rather than a hypothetical: `other` is a key both languages produce.
    expect(Object.keys(currencyVocabulary("en").units.usd?.forms ?? {})).toContain(
      "other",
    );
  });

  test("every translated currency carries exactly the one grammatical key", () => {
    expect(
      Object.keys(moneyTr.units)
        .filter((code) => moneyTr.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyTr.units[code]?.forms ?? {}).sort(), code).toEqual(ONE_KEY);
    }
    // And the key set is closed on the language's side too: no count and no slot
    // can produce a second key for the table to be missing. This is the row the
    // three-type split was designed to be able to reach — `uk` writes eight cells
    // per currency here, `de` four, `en` and `nl` two — and nothing is missing
    // from it.
    const produced = new Set(
      [undefined, 0, 1, 2, 5, 11, 21, 100, 1000, 1.5].flatMap((count) => [
        key("usd", "after-number", count),
        key("usd", "conversion-target", count),
      ]),
    );
    expect([...produced].sort()).toEqual(ONE_KEY);
    // Turkish reaches the one-key table *against* CLDR rather than with it, which
    // is what distinguishes it from `id`, `ja` and `zh`: CLDR declares two
    // categories for this language and `@smartput/core/locale/tr` declines to route
    // through them, because a two-row table would hold the same string twice and
    // hide a typo in the row that only fires at 1.
    expect(new Intl.PluralRules("tr").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);
    expect(new Intl.PluralRules("tr").select(1)).toBe("one");
    expect(key("usd", "after-number", 1)).toBe("other");
  });

  test("the five with no single-word Turkish name declare none", () => {
    // One reason with two shapes, deliberately not collapsed. CAD and AUD are the
    // country followed by the head noun USD already owns — "Kanada doları",
    // "Avustralya doları" — and the head is not even the bare word in them, since
    // the possessive suffix turns *dolar* into *doları*. SEK, NOK and CZK are the
    // same shape one level worse, and their shared head is checked below.
    for (const code of UNTRANSLATED) {
      expect(moneyTr.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims a Turkish word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach them,
      // in either language.
      expect(moneyTr.units[code]?.aliases, code).toContain(code);
    }
    // *Kron* is not merely half a phrase, it is a word two of these currencies
    // share, so claiming it would be rejected outright by `assertLocaleContract` —
    // "does not resolve back — money:nok claims it too". Recorded as a live
    // assertion because that is the check catching exactly the mistake it was
    // written for.
    for (const [, alias] of added) expect(alias).not.toBe("kron");
    expect(() => engine.evaluate("30 kron")).toThrow();
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias is reachable, if at all, only through the penalised suffix
  // stripper — and a word reached that way is one this vocabulary is guessing at
  // rather than declaring.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyTr.units)) {
      const aliases = words.aliases.map((a) => a.toLowerCase());
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form.toLowerCase());
      }
    }
  });

  // The words Turkish genuinely spells its own way, and the shape of each. The
  // 1928 alphabet reform made spelling phonemic and loanwords were rewritten to
  // match how they are said, so a currency name arrives with different letters
  // rather than the same ones — which is why this file earns more lines than any
  // other Latin-alphabet sibling in the package.
  test("the respellings are listed, and nothing else is", () => {
    expect(added.map(([, alias]) => alias).sort()).toEqual([
      "avro",
      "dolar",
      "frank",
      "grivna",
      "sterlin",
      "zloti",
    ]);
    expect(engine.evaluate("30 dolar").value?.unit).toBe("usd");
    expect(engine.evaluate("30 sterlin").value?.unit).toBe("gbp");
    expect(engine.evaluate("30 frank").value?.unit).toBe("chf");
    expect(engine.evaluate("30 zloti").value?.unit).toBe("pln");
    expect(engine.evaluate("30 grivna").value?.unit).toBe("uah");
    // The qualified names are phrases, and in this language the head takes a
    // suffix inside them besides — "İsviçre frangı", where a final `k` voices to
    // `ğ` — so neither an alias nor a suffix list can reach them.
    expect(() => engine.evaluate("30 İsviçre frangı")).toThrow();
    expect(() => engine.evaluate("30 Kanada doları")).toThrow();
  });

  // The euro has two live spellings and only one of them prints. TDK coined
  // *avro* in 1998 on the model of the other Turkified names and the Central Bank
  // writes it that way; ordinary Turkish writing kept *euro*, which is also the
  // table's own word. An alias is read and never printed, so listing the second
  // costs one index slot and loses no reader.
  test("both spellings of the euro read, and the everyday one prints", () => {
    expect(engine.evaluate("30 avro").value?.unit).toBe("eur");
    expect(engine.evaluate("30 euro").value?.unit).toBe("eur");
    expect(moneyTr.units.eur?.forms?.other).toBe("euro");
    expect(moneyTr.units.eur?.aliases).toContain("avro");
  });

  // No plural is listed anywhere, and that is structural rather than an omission.
  // Every sibling file in this package declares some — `nl` writes out *ponden*
  // and *franken* because its stripper cannot reach them, `uk` writes six cells of
  // them. Turkish has a plural and it is ungrammatical after a count: the numeral
  // has already said how many, so the noun does not repeat it.
  test("no plural is listed, because a counted Turkish noun is bare", () => {
    // Checked as "no listed word is another listed word plus `-ler`/`-lar`"
    // rather than as an ending, because an ending would be wrong: *dolar* ends in
    // the plural suffix and is a singular noun, which is the collision the next
    // test is about.
    const all = new Set(added.map(([, alias]) => alias));
    for (const alias of all) {
      for (const plural of [`${alias}ler`, `${alias}lar`]) {
        expect(all, `${plural} is listed beside ${alias}`).not.toContain(plural);
      }
    }
    // The same word after every count, read off the table rather than through the
    // formatter — `money` prints "$30,00" whatever the grammar says, so this is
    // the only place the words are visible.
    const usd = moneyTr.units.usd?.forms;
    for (const count of [1, 2, 5, 21, 1.5, 1000]) {
      expect(usd?.[key("usd", "after-number", count)], `${count}`).toBe("dolar");
    }
  });

  // *Dolar* ends in `-lar`, which is the Turkish plural suffix, so a stripper with
  // a lower floor would have offered "do" as its stem and this vocabulary's own
  // word would have decomposed. `@smartput/core/locale/tr` sets `minStem: 3` and
  // says the floor is load-bearing; this is the row in this package that depends
  // on it.
  test("dolar survives the plural stripper, because the floor is 3", () => {
    expect(engine.evaluate("30 dolar").value?.unit).toBe("usd");
    // And the genuine plural still reads, penalised, which is what the stripper is
    // for — it is simply never a form anything prints.
    expect(engine.evaluate("30 dolarlar").value?.unit).toBe("usd");
  });

  test("no Turkish word is claimed by two currencies", () => {
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

  // The finding this package hands upstream, written as an assertion so it fails
  // the day it is fixed instead of staying as a stale comment. The Turkish lira
  // has no unit id for this file to name: `CURRENCIES` is the set ECB's daily
  // reference file quotes plus the euro, TRY is not among them, and a
  // `Vocabulary` may only name units the kind declares. The repair is a row in
  // `@smartput/currency` and a rate source that quotes it, neither of which is
  // this package.
  test("records that the Turkish lira has no unit to name", () => {
    expect(Object.keys(CURRENCIES)).not.toContain("try");
    expect(Object.keys(moneyTr.units)).not.toContain("try");
    for (const [, alias] of added) expect(["lira", "tl"]).not.toContain(alias);
    expect(() => engine.evaluate("30 lira")).toThrow();
    expect(() => engine.evaluate("30 tl")).toThrow();
  });

  test("satisfies the locale contract", () => {
    // One waiver, and it costs an explanation. `skipPrintable` waives only the
    // print-and-read-back half of the contract, and it is taken for every currency
    // because `money`'s format hook prints `symbolOf(code)` — "€", "CHF", "zł" —
    // which is readable back as an alias in no language, `en` included: a currency
    // sign is notation, not a word. Every alias is still asserted to resolve back
    // to its own currency, and every `forms` key the language can ask for is still
    // swept for.
    const skipPrintable = Object.keys(moneyTr.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all — and this kind *has* a `forms` table for the sweep to index,
    // which makes the fractional row a real check here rather than the vacuous one
    // it is next door in `percent`. Under `tr` it confirms that a fraction lands on
    // the same single key an integer does, which is the whole claim this
    // vocabulary's shape rests on.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        skipPrintable,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Turkish money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits: Turkish marks
    // the decimal with "," and groups with ".", the exact inverse of English.
    expect(engine.evaluate("30 dolar").formatted).toBe("$30,00");
    expect(engine.evaluate("30 sterlin").formatted).toBe("£30,00");
    expect(engine.evaluate("30 frank").formatted).toBe("CHF30,00");
    expect(engine.evaluate("30 grivna").formatted).toBe("₴30,00");
    expect(engine.evaluate("30 avro").formatted).toBe("€30,00");
    // Capitalised as a sentence-initial accident, and in the all-caps a heading is
    // set in — the second of which reaches the alias only through
    // `@smartput/core/locale/tr`'s two-way i fold, since a Turkish fold of "DOLAR"
    // is "dolar" but a Turkish fold of an I-bearing word is not what an ASCII
    // keyboard meant.
    expect(engine.evaluate("30 Dolar").formatted).toBe("$30,00");
    expect(engine.evaluate("30 STERLIN").formatted).toBe("£30,00");
    // A conversion, through each of this language's conversion keywords, whose
    // result groups — and, as Turkish groups with ".", the grouped output is
    // something this engine could read back if the symbol were a word.
    expect(engine.evaluate("100 dolar çevir grivna").formatted).toBe("₴4.090,91");
    expect(engine.evaluate("100 dolar cevir euro").formatted).toBe("€90,91");
    expect(engine.evaluate("100 dolar to euro").formatted).toBe("€90,91");
    // A sum, and a sum that lands on a fraction: two minor units, so the second
    // rounds rather than truncating.
    expect(engine.evaluate("10 euro artı 5 euro").formatted).toBe("€15,00");
    expect(engine.evaluate("10 euro bölü 4").formatted).toBe("€2,50");
  });

  test("the Latin aliases still read in a Turkish engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    // Including the English plural, which this language has no use for and still
    // reads: recognition is many-to-one and generation is one.
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd çevir euro").formatted).toBe("€90,91");
  });

  test("the slot is read and discarded, along with everything else", () => {
    // German's copy of this test asserts that its `in` governs the dative and
    // moves the key to `dat-*`; Dutch's asserts that it has no case left to move.
    // Turkish governs a dative too — "grama çevir" — and
    // `@smartput/core/locale/tr` still declines the axis, because the ending is
    // mechanically derivable by vowel harmony and, on a symbol target, is glued on
    // with an apostrophe ("kg'a") that no `forms` cell can hold. So a conversion
    // target selects exactly the key a bare quantity does, and so does a
    // count-free call (ruling R5).
    expect(key("chf", "after-number", 5)).toBe("other");
    expect(key("chf", "conversion-target", 5)).toBe("other");
    expect(key("chf", "conversion-target")).toBe("other");
    const chf = moneyTr.units.chf?.forms;
    expect(chf?.[key("chf", "conversion-target")]).toBe("frank");
    expect(chf?.[key("chf", "after-number", 1)]).toBe("frank");
  });

  test("completion inserts a Turkish word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 dola");
    expect(first?.text).toBe("30 dolar");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("usd");
  });

  test("round-trips its own output", () => {
    // What can round-trip here is the *word* path, not the symbol path: `money`'s
    // format hook prints "€30,00", and a currency sign is an alias of nothing in
    // any language, so the printed string is display and not input. The strings
    // below are what completion inserts and what a user types, and they are what
    // has to survive the trip.
    for (const input of [
      "30 euro",
      "1,5 euro",
      "30 dolar",
      "30 frank",
      "30 grivna",
      "30 sterlin",
      "100 dolar çevir euro",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyTr.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`${first.value?.canonical.toString()} ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does
    // not throw, which is worse than throwing and is why it is written down: `lex`
    // skips "€" as an unrecognized character, so "€30,00" comes back as the bare
    // *number* 30 with the currency silently gone. That is core's lexer, identical
    // under `en` for "$30.00", and nothing a vocabulary can reach; the word path
    // above is the one that round-trips.
    const printed = engine.evaluate("30 euro").formatted;
    expect(printed).toBe("€30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
