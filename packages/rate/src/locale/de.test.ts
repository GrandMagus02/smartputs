import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberDe from "@smartput/number/locale/de";
// Through the package path, not "./de": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact
// that `./locale/en` was missing from it.
import moneyDe from "@smartput/rate/locale/de";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a German word, and no more. The words are
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
  // Quoted for one row: the Krone test below evaluates "5 Kronen" to prove the
  // word is already NOK's, and an unquoted currency raises `MissingRateError`
  // before the reading is ever reported.
  NOK: 11.5,
});
const locale = composeLocale(german, [numberDe, moneyDe]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** The key `german` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  german.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

const FOUR_KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/** The currencies this file gives German words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/**
 * Every word this vocabulary adds on top of the generated table, by currency.
 *
 * Derived by subtracting the generated aliases rather than by matching a script,
 * which is where German differs from Ukrainian: `uk.test.ts` finds its own words
 * with `/[Ѐ-ӿ]/` because Cyrillic is a different alphabet, and German shares the
 * Latin one — "Euro" and "euro" are the same letters.
 */
const added: Array<[string, string]> = Object.entries(moneyDe.units).flatMap(
  ([code, words]) => {
    const generated = new Set(CURRENCIES[code]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [code, a]);
  },
);

describe("money de vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyDe.units).sort()).toEqual(units.sort());
    expect(moneyDe.locale).toBe("de");
    expect(moneyDe.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so no German word may reach
  // it. A script regex is nearly useless here — German is written in the same
  // alphabet as an ISO code — so this greps for the words themselves.
  test("the kind itself carries no German word", () => {
    const source = JSON.stringify(money);
    expect(source).not.toMatch(/[äöüß]/i);
    expect(source).not.toMatch(/pfund|franken|hrywnja|griwna|sterling/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyDe.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the German words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyDe.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyDe.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned
  // vocabulary; the words behind it are English either way. This is the
  // assertion that says so out loud, so that the day `CURRENCIES` grows
  // localized names, the file above stops being right and this stops being green
  // together.
  test('currencyVocabulary("de") is English words under a de label', () => {
    const generated = currencyVocabulary("de");
    expect(generated.locale).toBe("de");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  test("the English forms it generates are dropped, not carried", () => {
    // `one`/`other` is what `english.selectForm` produces. `german.selectForm`
    // returns neither, so keeping the generated table would leave four keys the
    // engine can only miss — and "dollars" is English besides, where German
    // counts "Dollar".
    for (const [code, words] of Object.entries(moneyDe.units)) {
      expect(Object.keys(words.forms ?? {}), code).not.toContain("one");
      expect(Object.keys(words.forms ?? {}), code).not.toContain("other");
      expect(Object.values(words.forms ?? {}), code).not.toContain("dollars");
    }
  });

  test("every translated currency carries exactly the four grammatical keys", () => {
    expect(
      Object.keys(moneyDe.units)
        .filter((code) => moneyDe.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyDe.units[code]?.forms ?? {}).sort(), code).toEqual(
        FOUR_KEYS,
      );
    }
    // And the key set is closed on the language's side too: no count and no slot
    // can produce a fifth key for the table to be missing.
    const produced = new Set(
      [undefined, 0, 1, 2, 5, 11, 21, 100, 1000, 1.5].flatMap((count) => [
        key("usd", "after-number", count),
        key("usd", "conversion-target", count),
      ]),
    );
    expect([...produced].sort()).toEqual(FOUR_KEYS);
  });

  test("the five with no single-word German name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are an
    // adjective plus the head noun USD already owns ("kanadischer Dollar"), and
    // a unit word is one token — which is why `en` omits display forms for
    // exactly these two. SEK, NOK and CZK are worse: German calls all three
    // "Krone", so the word has no reading at all.
    for (const code of UNTRANSLATED) {
      expect(moneyDe.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims a German word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach
      // them, in either language.
      expect(moneyDe.units[code]?.aliases, code).toContain(code);
    }
  });

  // The Krone collision, measured rather than asserted from the prose. German's
  // one word for three currencies is *already* an alias of `nok` in the
  // generated table — it is that currency's own Norwegian name — so claiming it
  // for `sek` would make `assertLocaleContract` fail its rival check, and the
  // German who types it gets the reading the table already gave them.
  test("the German Krone is already spoken for, and is left where it was", () => {
    expect(CURRENCIES.nok?.aliases).toContain("krone");
    expect(engine.evaluate("5 Krone").value?.unit).toBe("nok");
    // And the German plural reaches it through the suffix stripper, which is the
    // fallback working exactly as intended: "Kronen" loses its -en and lands on
    // a word the table already indexed.
    expect(engine.evaluate("5 Kronen").value?.unit).toBe("nok");
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the German suffix stripper recovers
  // it — at `weight: -2`. Asserting the containment is what keeps the two halves
  // of an entry, what it writes and what it reads, in step. The comparison is
  // case-folded because German capitalises every noun and the alias index folds:
  // the table prints "Euro" and reads "euro", and those are one word.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyDe.units)) {
      const aliases = words.aliases.map((a) => a.toLowerCase());
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form.toLowerCase());
      }
    }
  });

  test("no German word is claimed by two currencies", () => {
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
    // language can ask for is still swept for. `uk.test.ts` concluded the helper
    // could not be run against this kind at all; it can, with that one waiver
    // named.
    const skipPrintable = Object.keys(moneyDe.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so `german.selectForm`'s `other`
    // category is never reached through a fraction at all — and this kind *has*
    // a `forms` table for the sweep to index, which makes the fractional row a
    // real check here rather than the vacuous one it is next door in `percent`.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        skipPrintable,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes German money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency
    // symbol, minor units — so what the language decides here is the digits:
    // German marks the decimal with "," and groups with ".", the exact inverse
    // of English.
    expect(engine.evaluate("30 Dollar").formatted).toBe("$30,00");
    expect(engine.evaluate("30 Pfund").formatted).toBe("£30,00");
    expect(engine.evaluate("30 Franken").formatted).toBe("CHF30,00");
    expect(engine.evaluate("30 Schweizerfranken").formatted).toBe("CHF30,00");
    expect(engine.evaluate("30 Hrywnja").formatted).toBe("₴30,00");
    expect(engine.evaluate("30 Griwna").formatted).toBe("₴30,00");
    // Capitalised as German prose writes a noun, and lowercase as a search box
    // does: analyzers are handed the surface exactly as typed and the index
    // folds, so both reach the same reading.
    expect(engine.evaluate("30 pfund").formatted).toBe("£30,00");
    // A conversion, through the German keyword, whose result groups — and, as
    // German groups with ".", the grouped output is something this engine could
    // read back if the symbol were a word.
    expect(engine.evaluate("100 Dollar in Hrywnja").formatted).toBe("₴4.090,91");
    expect(engine.evaluate("100 Dollar nach Euro").formatted).toBe("€90,91");
    // A sum, and a sum that lands on a fraction: two minor units, so the second
    // rounds rather than truncating.
    expect(engine.evaluate("10 Euro plus 5 Euro").formatted).toBe("€15,00");
    expect(engine.evaluate("10 Euro geteilt durch 4").formatted).toBe("€2,50");
  });

  test("the Latin aliases still read in a German engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd in Euro").formatted).toBe("€90,91");
  });

  test("the noun does not move with the count, and that is the German rule", () => {
    // The row a `one`/`other` table would get wrong in the *opposite* direction
    // from Ukrainian's: German leaves a masculine or neuter measure noun
    // uninflected after a cardinal, so "1 Euro" and "5 Euro" are the same word
    // where "1 dollar"/"5 dollars" are not. Read off the table rather than
    // through the formatter — `money` prints "€1,50" whatever the grammar says,
    // so this is the only place the words are visible.
    const eur = moneyDe.units.eur?.forms;
    expect(eur?.[key("eur", "after-number", 1)]).toBe("Euro");
    expect(eur?.[key("eur", "after-number", 2)]).toBe("Euro");
    expect(eur?.[key("eur", "after-number", 5)]).toBe("Euro");
    // The fractional row, which every language in this repo reaches differently
    // and German reaches with the same word again.
    expect(eur?.[key("eur", "after-number", 1.5)]).toBe("Euro");
    // 21 is `one` in CLDR's German rules only if the category followed the last
    // digit — it does not; German's plural rule is `i = 1 and v = 0`, so 21 is
    // `other`. Pinned because the Ukrainian file's own 21 row goes the other way.
    expect(key("eur", "after-number", 21)).toBe("nom-other");
    expect(key("eur", "after-number", 1)).toBe("nom-one");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract. German's `in` governs the dative when it answers
    // *wo*, so a conversion target selects a `dat-*` key — and for a currency
    // noun the dative plural is suppressed by the same uninflected-after-a-
    // cardinal rule, so the word does not move. The key does, which is what this
    // asserts: the axis is live even where the word it selects is not.
    expect(key("chf", "after-number", 5)).toBe("nom-other");
    expect(key("chf", "conversion-target", 5)).toBe("dat-other");
    expect(key("chf", "conversion-target", 1)).toBe("dat-one");
    // Ruling R5: a count-free conversion target lands on `dat-other`.
    expect(key("chf", "conversion-target")).toBe("dat-other");
    const chf = moneyDe.units.chf?.forms;
    expect(chf?.[key("chf", "conversion-target")]).toBe("Franken");
    expect(chf?.[key("chf", "after-number", 1)]).toBe("Franken");
  });

  test("completion inserts a German word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    // The inserted word is capitalised, as a German noun is, and it reads back
    // because the alias index folds.
    const [first] = engine.complete("30 Fran");
    expect(first?.text).toBe("30 Franken");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("chf");
  });

  test("round-trips its own output", () => {
    // What can round-trip here is the *word* path, not the symbol path:
    // `money`'s format hook prints "€30,00", and a currency sign is an alias of
    // nothing in any language, so the printed string is display and not input.
    // The strings below are what completion inserts and what a user types, and
    // they are what has to survive the trip.
    for (const input of [
      "30 Euro",
      "1,5 Euro",
      "30 Pfund",
      "30 Franken",
      "30 Hrywnja",
      "100 Dollar in Euro",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyDe.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`${first.value?.canonical.toString()} ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does
    // not throw, which is worse than throwing and is why it is written down:
    // `lex` skips "€" as an unrecognized character, so "€30,00" comes back as
    // the bare *number* 30 with the currency silently gone. That is core's
    // lexer, identical under `en` for "$30.00", and nothing a vocabulary can
    // reach; the word path above is the one that round-trips.
    const printed = engine.evaluate("30 Euro").formatted;
    expect(printed).toBe("€30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
