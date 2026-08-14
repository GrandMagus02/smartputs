import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberNl from "@smartput/number/locale/nl";
// Through the package path, not "./nl": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyNl from "@smartput/rate/locale/nl";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Dutch word, and no more. The words are checked
 * by evaluating them, and a currency the snapshot does not quote raises
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
  // Quoted for one row: the kroon test below evaluates "5 kronen" to prove the
  // stripper lands on a word the generated table already gave NOK, and an unquoted
  // currency raises `MissingRateError` before the reading is ever reported.
  NOK: 11.5,
});
const locale = composeLocale(dutch, [numberNl, moneyNl]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** The key `dutch` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  dutch.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

const TWO_KEYS = ["one", "other"];

/** The currencies this file gives Dutch words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/**
 * Every word this vocabulary adds on top of the generated table, by currency.
 *
 * Derived by subtracting the generated aliases rather than by matching a script,
 * which is where Dutch differs from Ukrainian: `uk.test.ts` finds its own words
 * with `/[Ѐ-ӿ]/` because Cyrillic is a different alphabet, and Dutch shares the
 * Latin one — "euro" and "euro" are not merely the same letters, they are the same
 * word.
 */
const added: Array<[string, string]> = Object.entries(moneyNl.units).flatMap(
  ([code, words]) => {
    const generated = new Set(CURRENCIES[code]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [code, a]);
  },
);

describe("money nl vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyNl.units).sort()).toEqual(units.sort());
    expect(moneyNl.locale).toBe("nl");
    expect(moneyNl.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is ratios, ISO codes and magnitude bands, so no Dutch word may reach it. A
  // script regex is nearly useless here — Dutch is written in the same alphabet as
  // an ISO code — so this greps for the words themselves.
  test("the kind itself carries no Dutch word", () => {
    const source = JSON.stringify(money);
    expect(source).not.toMatch(/[ëïéèöü]/i);
    expect(source).not.toMatch(/pond|ponden|frank|franken|grivna/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyNl.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Dutch words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyNl.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyNl.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together.
  test('currencyVocabulary("nl") is English words under an nl label', () => {
    const generated = currencyVocabulary("nl");
    expect(generated.locale).toBe("nl");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // The trap Dutch sets that German could not, and the reason this file replaces
  // the generated `forms` wholesale instead of merging into them. `english.selectForm`
  // and `dutch.selectForm` produce the *same two keys*, so a Dutch engine carrying
  // the generated table would never miss a lookup and every structural check would
  // stay green — while printing "dollars", which is English. The keys match; the
  // words do not.
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyNl.units)) {
      expect(Object.values(words.forms ?? {}), code).not.toContain("dollars");
      expect(Object.values(words.forms ?? {}), code).not.toContain("euros");
      expect(Object.values(words.forms ?? {}), code).not.toContain("pounds");
      expect(Object.values(words.forms ?? {}), code).not.toContain("francs");
    }
    // And the keys really are the same two, which is what makes the paragraph above
    // a trap rather than a hypothetical.
    expect(Object.keys(currencyVocabulary("en").units.usd?.forms ?? {}).sort()).toEqual(
      TWO_KEYS,
    );
  });

  test("every translated currency carries exactly the two grammatical keys", () => {
    expect(
      Object.keys(moneyNl.units)
        .filter((code) => moneyNl.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyNl.units[code]?.forms ?? {}).sort(), code).toEqual(
        TWO_KEYS,
      );
    }
    // And the key set is closed on the language's side too: no count and no slot can
    // produce a third key for the table to be missing.
    const produced = new Set(
      [undefined, 0, 1, 2, 5, 11, 21, 100, 1000, 1.5].flatMap((count) => [
        key("usd", "after-number", count),
        key("usd", "conversion-target", count),
      ]),
    );
    expect([...produced].sort()).toEqual(TWO_KEYS);
  });

  test("the five with no single-word Dutch name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are an
    // adjective plus the head noun USD already owns ("Canadese dollar"), and a unit
    // word is one token — which is why `en` omits display forms for exactly these
    // two. SEK, NOK and CZK are worse: Dutch calls all three "kroon", so the word
    // has no reading at all.
    for (const code of UNTRANSLATED) {
      expect(moneyNl.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims a Dutch word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach them,
      // in either language.
      expect(moneyNl.units[code]?.aliases, code).toContain(code);
    }
  });

  // The kroon collision, and the way it differs from German's without changing the
  // conclusion. German's "Krone" was already NOK's own Norwegian name in the
  // generated table, so claiming it for SEK would have failed the contract's rival
  // check outright. Dutch's "kroon" has two o's and collides with nothing — it is
  // free, and it is still left unclaimed, because a word three units of one kind
  // would answer to is not a reading whatever the index says.
  test("the Dutch kroon is free and is still left unclaimed", () => {
    expect(CURRENCIES.nok?.aliases).toContain("krone");
    expect(CURRENCIES.sek?.aliases).not.toContain("kroon");
    for (const [, alias] of added) expect(alias).not.toBe("kroon");
    expect(() => engine.evaluate("5 kroon")).toThrow();
    // What a Dutch reader typing the plural gets instead, by the same route German's
    // reader does: the language's `n` stripper takes "kronen" to "krone", which the
    // generated table already indexed as NOK.
    expect(engine.evaluate("5 kronen").value?.unit).toBe("nok");
  });

  // The gap invisible to every other test here: a printed form that is not a listed
  // alias still round-trips, because the Dutch suffix stripper recovers it — at
  // `weight: -2`. Asserting the containment is what keeps the two halves of an
  // entry, what it writes and what it reads, in step. The comparison is case-folded
  // for parity with the German file, though Dutch capitalises nothing and the two
  // sides are already identical.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyNl.units)) {
      const aliases = words.aliases.map((a) => a.toLowerCase());
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form.toLowerCase());
      }
    }
  });

  // Rule 5's Dutch shape, and the one place this file has to do more work than
  // `de.ts` did: `dutch.analyze` does not strip `en`, because the main Dutch plural
  // shortens an open syllable or doubles a consonant, so every `-en` plural a reader
  // may type has to be declared. The `'s` plural is the opposite case — the stripper
  // was given that suffix precisely for vowel-final nouns — so "euro's" is
  // deliberately *not* listed and is proved reachable instead.
  test("the -en plurals are listed and the 's plural is not", () => {
    const aliases = (code: string) => moneyNl.units[code]?.aliases ?? [];
    expect(aliases("gbp")).toContain("ponden");
    expect(aliases("chf")).toContain("franken");
    expect(aliases("eur")).not.toContain("euro's");
    expect(engine.evaluate("30 ponden").value?.unit).toBe("gbp");
    expect(engine.evaluate("30 franken").value?.unit).toBe("chf");
    expect(engine.evaluate("30 euro's").value?.unit).toBe("eur");
  });

  test("no Dutch word is claimed by two currencies", () => {
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
    // print-and-read-back half of the contract, and it is taken for every currency
    // because `money`'s format hook prints `symbolOf(code)` — "€", "CHF", "zł" —
    // which is readable back as an alias in no language, `en` included: a currency
    // sign is notation, not a word. Every alias is still asserted to resolve back to
    // its own currency, and every `forms` key the language can ask for is still
    // swept for.
    const skipPrintable = Object.keys(moneyNl.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so `dutch.selectForm`'s `other` category
    // is never reached through a fraction at all — and this kind *has* a `forms`
    // table for the sweep to index, which makes the fractional row a real check here
    // rather than the vacuous one it is next door in `percent`.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        skipPrintable,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Dutch money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits: Dutch marks the
    // decimal with "," and groups with ".", the exact inverse of English.
    expect(engine.evaluate("30 dollar").formatted).toBe("$30,00");
    expect(engine.evaluate("30 pond").formatted).toBe("£30,00");
    expect(engine.evaluate("30 frank").formatted).toBe("CHF30,00");
    expect(engine.evaluate("30 hryvnia").formatted).toBe("₴30,00");
    expect(engine.evaluate("30 grivna").formatted).toBe("₴30,00");
    // Capitalised as a sentence-initial accident, and lowercase as Dutch actually
    // writes a common noun — this language capitalises none, which is the one German
    // stress it does not share. Both reach the same reading, because analyzers are
    // handed the surface exactly as typed and the index folds.
    expect(engine.evaluate("30 Pond").formatted).toBe("£30,00");
    // A conversion, through each of Dutch's `in` words, whose result groups — and,
    // as Dutch groups with ".", the grouped output is something this engine could
    // read back if the symbol were a word.
    expect(engine.evaluate("100 dollar in hryvnia").formatted).toBe("₴4.090,91");
    expect(engine.evaluate("100 dollar naar euro").formatted).toBe("€90,91");
    // A sum, and a sum that lands on a fraction: two minor units, so the second
    // rounds rather than truncating.
    expect(engine.evaluate("10 euro plus 5 euro").formatted).toBe("€15,00");
    expect(engine.evaluate("10 euro gedeeld door 4").formatted).toBe("€2,50");
  });

  test("the Latin aliases still read in a Dutch engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd in euro").formatted).toBe("€90,91");
  });

  test("the noun does not move with the count, and that is the Dutch rule", () => {
    // The row a naive `one`/`other` table would get wrong in the *same* direction
    // German's would: Dutch keeps a currency noun singular after a numeral, so "1
    // euro" and "5 euro" are the same word where "1 dollar"/"5 dollars" are not.
    // Read off the table rather than through the formatter — `money` prints "€1,50"
    // whatever the grammar says, so this is the only place the words are visible.
    const eur = moneyNl.units.eur?.forms;
    expect(eur?.[key("eur", "after-number", 1)]).toBe("euro");
    expect(eur?.[key("eur", "after-number", 2)]).toBe("euro");
    expect(eur?.[key("eur", "after-number", 5)]).toBe("euro");
    // The fractional row, which every language in this repo reaches differently and
    // Dutch reaches with the same word again.
    expect(eur?.[key("eur", "after-number", 1.5)]).toBe("euro");
    // 21 is `other` in CLDR's Dutch rules, as it is in German's: the category is not
    // read off the last digit, and the rule is `i = 1 and v = 0`. Pinned because the
    // Ukrainian file's own 21 row goes the other way.
    expect(key("eur", "after-number", 21)).toBe("other");
    expect(key("eur", "after-number", 1)).toBe("one");
  });

  test("the slot is read and discarded, which is where Dutch stops being German", () => {
    // German's copy of this test asserts that its `in` governs the dative and moves
    // the key to `dat-*`. Dutch lost its case marking on common nouns centuries ago,
    // so a conversion target selects exactly the key a bare quantity does — the
    // single reason a Dutch `forms` table is two cells rather than four.
    expect(key("chf", "after-number", 5)).toBe("other");
    expect(key("chf", "conversion-target", 5)).toBe("other");
    expect(key("chf", "conversion-target", 1)).toBe("one");
    // Ruling R5: a count-free conversion target lands on `other`.
    expect(key("chf", "conversion-target")).toBe("other");
    const chf = moneyNl.units.chf?.forms;
    expect(chf?.[key("chf", "conversion-target")]).toBe("frank");
    expect(chf?.[key("chf", "after-number", 1)]).toBe("frank");
  });

  test("completion inserts a Dutch word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the format
    // hook prints a symbol: completion splices the count and the selected form, and
    // the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 fran");
    expect(first?.text).toBe("30 frank");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("chf");
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
      "30 pond",
      "30 frank",
      "30 hryvnia",
      "100 dollar in euro",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyNl.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`${first.value?.canonical.toString()} ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does not
    // throw, which is worse than throwing and is why it is written down: `lex` skips
    // "€" as an unrecognized character, so "€30,00" comes back as the bare *number*
    // 30 with the currency silently gone. That is core's lexer, identical under `en`
    // for "$30.00", and nothing a vocabulary can reach; the word path above is the
    // one that round-trips.
    const printed = engine.evaluate("30 euro").formatted;
    expect(printed).toBe("€30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
