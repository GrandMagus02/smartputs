import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { arabic } from "@smartput/core/locale/ar";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberAr from "@smartput/number/locale/ar";
// Through the package path, not "./ar": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyAr from "@smartput/rate/locale/ar";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives an Arabic word, and no more. The words are
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
const locale = composeLocale(arabic, [numberAr, moneyAr]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/**
 * The accusative indefinite ending, as an escape: tanwīn fatḥ (U+064B) then the
 * alif that carries it. Written the way `ar.ts` next door writes it, and for the
 * same reason — U+064B renders *on top of* the letter before it, so a literal in
 * source is invisible and one careless retype from vanishing. If it vanished here
 * the `many` assertions would silently start testing the `one` row.
 */
const AN = "\u064B\u0627";

/** Arabic and Arabic Supplement, which is every letter this phase can write. */
const ARABIC = /[؀-ۿݐ-ݿ]/;

/** The key `arabic` will index a unit's `forms` with, for this count and slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  arabic.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** Exactly the six CLDR categories `arabic.selectForm` can produce, sorted. */
const SIX_KEYS = ["few", "many", "one", "other", "two", "zero"];

/** The currencies this file gives Arabic words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyAr.units).flatMap(
  ([code, words]) =>
    words.aliases.filter((a) => ARABIC.test(a)).map((a): [string, string] => [code, a]),
);

describe("money ar vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyAr.units).sort()).toEqual(units.sort());
    expect(moneyAr.locale).toBe("ar");
    expect(moneyAr.kind).toBe("money");
  });

  // The absence an Arabic reader notices first, asserted rather than explained
  // away: `CURRENCIES` holds the twelve codes ECB quotes plus the euro, and not
  // one Arab currency is among them — so the kind declares no unit for the dirham,
  // the riyal, the dinar or the Egyptian pound, and a `Vocabulary` (which names
  // units and cannot add them) has nothing to attach them to. The fix is a row in
  // `@smartput/currency` and a quote in a snapshot, both on the language-free side
  // of the split. Wider than the rouble `ru.ts` records, and the same shape.
  test("there is no Arab currency to name, because the kind declares none", () => {
    for (const code of ["aed", "sar", "egp", "kwd", "qar", "jod"]) {
      expect(CURRENCIES[code], code).toBeUndefined();
      expect(moneyAr.units[code], code).toBeUndefined();
    }
    // درهم، ريال، دينار — the three words that would be here if the kind held the
    // units. Asserted as absent so nobody adds a word for a unit that does not
    // exist and calls the gap closed.
    expect(JSON.stringify(moneyAr)).not.toMatch(/درهم|ريال|دينار/);
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyAr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is ratios, ISO codes and magnitude bands, so no script but ASCII may reach it.
  // Arabic in the descriptor would mean a translation had leaked into the half of
  // the package that is supposed to be language-free.
  test("the kind itself carries no Arabic word", () => {
    expect(JSON.stringify(money)).not.toMatch(ARABIC);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyAr.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Arabic words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyAr.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyAr.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together.
  test('currencyVocabulary("ar") is English words under an ar label', () => {
    const generated = currencyVocabulary("ar");
    expect(generated.locale).toBe("ar");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  test("the English forms it generates are dropped, not carried", () => {
    // `one`/`other` is what `english.selectForm` produces. `arabic.selectForm`
    // returns neither — its key set is the six CLDR categories — so keeping the
    // generated table would leave keys the engine can only miss, and every word in
    // it is English besides.
    for (const [code, words] of Object.entries(moneyAr.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints a Latin word`).toMatch(ARABIC);
      }
    }
    // "one" and "other" are also two of Arabic's six category names, so they
    // cannot be asserted absent by key the way `ru.test.ts` does. What separates
    // the tables is the script of the words and the shape of the key set, and both
    // are checked — here and in the test below.
    expect(moneyAr.units.usd?.forms?.one).toBe("دولار");
    expect(moneyAr.units.usd?.forms?.other).toBe("دولار");
  });

  test("every translated currency carries exactly the six keys, no more, no fewer", () => {
    expect(
      Object.keys(moneyAr.units)
        .filter((code) => moneyAr.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyAr.units[code]?.forms ?? {}).sort(), code).toEqual(
        SIX_KEYS,
      );
    }
  });

  test("the five with no single-word Arabic name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a head
    // noun USD already owns plus an adjective ("دولار كندي"), and a unit word is
    // one token — which is why `en` omits display forms for exactly these two.
    // SEK, NOK and CZK are worse: Arabic calls all three "كرونة", so the word has
    // no reading at all and is left unclaimed rather than handed to whichever was
    // written first.
    for (const code of UNTRANSLATED) {
      expect(moneyAr.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims an Arabic word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach them,
      // in either language.
      expect(moneyAr.units[code]?.aliases, code).toContain(code);
    }
    // And the Arabic word itself is claimed by nothing at all — unlike German,
    // where "Krone" is already `nok`'s own generated alias and the collision is
    // decided upstream. Nothing in the Latin table spells it, so leaving it out is
    // a choice this file makes rather than one it inherits.
    expect(added.some(([, alias]) => alias.startsWith("كرون"))).toBe(false);
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the Arabic suffix stripper recovers it
  // — at `weight: -2`. Asserting the containment is what keeps the two halves of an
  // entry, what it writes and what it reads, in step. It matters more in Arabic
  // than anywhere else in this phase, because the `many` row is spelled with a
  // combining mark that is invisible in source: if the tanwīn were dropped from
  // one side only, nothing else in this file would notice.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyAr.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Arabic word is claimed by two currencies", () => {
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
    // sign is notation, not a word. Every alias is still asserted to resolve back
    // to its own currency, and every `forms` key the language can ask for is still
    // swept for.
    const skipPrintable = Object.keys(moneyAr.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* at all — and this
    // kind *has* a `forms` table for the sweep to index, which makes the
    // fractional row a real check here rather than the vacuous one it is next door
    // in `percent`. It is also the row Arabic spells as a genitive singular where
    // French spells it plural, so getting it wrong is silent.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        skipPrintable,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Arabic money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits: Arabic marks
    // the decimal with "." and groups with ",", transcribed into
    // `arabic.numberFormat` rather than read from CLDR because the engine can only
    // emit Latin digits at all.
    expect(engine.evaluate("30 دولار").formatted).toBe("$30.00");
    expect(engine.evaluate("30 هريفنيا").formatted).toBe("₴30.00");
    expect(engine.evaluate("5 زلوتي").formatted).toBe("zł5.00");
    // The dual and the tamyīz, which are the two rows no other language in this
    // repo has.
    expect(engine.evaluate("2 دولاران").formatted).toBe("$2.00");
    expect(engine.evaluate(`11 دولار${AN}`).formatted).toBe("$11.00");
    // The clipping and the transliteration, both read and neither printed.
    expect(engine.evaluate("30 إسترليني").formatted).toBe("£30.00");
    expect(engine.evaluate("30 استرليني").formatted).toBe("£30.00");
    // A conversion, read with إلى ("to"). Grouped output uses "," — which unlike
    // Russian's U+00A0 survives `normalize()`.
    expect(engine.evaluate("100 دولار إلى هريفنيا").formatted).toBe("₴4,090.91");
    expect(engine.evaluate("10 هريفنيا زائد 5 هريفنيا").formatted).toBe("₴15.00");
    // A sum that lands on a fraction, which is where a currency's minor units and
    // the fractional grammatical row meet: 1.5 selects `other`, the genitive
    // SINGULAR "دولار" and never the plural, even though the format hook prints
    // the sign and the digits and never the word.
    expect(engine.evaluate("1 دولار زائد 0.5 دولار").formatted).toBe("$1.50");
    expect(engine.evaluate("10 يورو قسمة على 4").formatted).toBe("€2.50");
  });

  test("the Latin aliases still read in an Arabic engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30.00");
    expect(engine.evaluate("100 usd إلى هريفنيا").formatted).toBe("₴4,090.91");
  });

  test("the number picks one of six words, and two of them are traps", () => {
    // The rows a `one`/`other` table cannot express, read off the table rather than
    // through the formatter — `money` prints "$1.50" whatever the grammar says, so
    // this is the only place the words are visible.
    const usd = moneyAr.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 0)]).toBe("دولار");
    expect(usd?.[key("usd", "after-number", 1)]).toBe("دولار");
    // The DUAL: a suffixed form of the noun meaning precisely two of the thing,
    // and the one category no other language shipped here has.
    expect(usd?.[key("usd", "after-number", 2)]).toBe("دولاران");
    expect(usd?.[key("usd", "after-number", 5)]).toBe("دولارات");
    // The first trap. `many` is not a plural: "11 دولارًا" is a singular noun in
    // the accusative — the tamyīz — spelled with the alif of the tanwīn and never
    // with the plural's ـات. A table ported by renaming English columns puts the
    // plural here and is wrong for every count from 11 to 99.
    expect(usd?.[key("usd", "after-number", 11)]).toBe(`دولار${AN}`);
    expect(usd?.[key("usd", "after-number", 21)]).toBe(`دولار${AN}`);
    expect(usd?.[key("usd", "after-number", 11)]).not.toBe("دولارات");
    // The category follows n mod 100, which is why 103 goes back to the plural and
    // 111 to the tamyīz — a rule no plural/singular model can express.
    expect(usd?.[key("usd", "after-number", 103)]).toBe("دولارات");
    expect(usd?.[key("usd", "after-number", 111)]).toBe(`دولار${AN}`);
    // The second trap. The fractional row is a genitive SINGULAR — "1.5 دولار",
    // never "دولارات" — which is the opposite of French, where a bare target is
    // plural. This is the assertion that would read "دولارات" if a plural had been
    // written into `other`.
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("دولار");
    expect(usd?.[key("usd", "after-number", 100)]).toBe("دولار");
    // And the coincidence that is correct rather than lazy: zero, one and other
    // hold the same string, because they differ only in a final short vowel and
    // Arabic does not write short vowels.
    expect(
      new Set([
        usd?.[key("usd", "after-number", 0)],
        usd?.[key("usd", "after-number", 1)],
        usd?.[key("usd", "after-number", 1.5)],
      ]).size,
    ).toBe(1);
    // Indeclinable: one word in all six cells, which is a fact about the noun —
    // يورو ends in a long vowel, زلوتي in a yāʾ and هريفنيا in an alif, and Arabic
    // gives none of those three a dual or a plural — and not a table left
    // half-filled.
    for (const code of ["eur", "pln", "uah"]) {
      expect(new Set(Object.values(moneyAr.units[code]?.forms ?? {})).size, code).toBe(1);
    }
  });

  test("the slot is inert, and that is Arabic's answer rather than a gap", () => {
    // Ukrainian and Russian key `forms` on `${case}-${category}` because their
    // conversion keyword governs a case the writing system shows. Arabic's does
    // not: the case a preposition governs is marked by a final short vowel that
    // Arabic does not write, so `conversion-target` and `bare` name the same key in
    // every row. A second axis would have cost six more cells per currency and
    // encoded nothing — and the one case ending Arabic *does* write, the accusative
    // ـًا, is already carried by `many`.
    expect(key("usd", "conversion-target", 5)).toBe(key("usd", "after-number", 5));
    expect(key("usd", "conversion-target", 2)).toBe("two");
    // Ruling R5: a target with no count at all lands on the generic category, which
    // in Arabic is the genitive singular. "إلى دولار" — singular, and the opposite
    // of French.
    expect(key("usd", "conversion-target")).toBe("other");
    expect(moneyAr.units.usd?.forms?.[key("usd", "conversion-target")]).toBe("دولار");
  });

  test("completion inserts an Arabic word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`. 30 is
    // `many`, so what comes out is the tamyīz — with the tanwīn on it, which is
    // exactly why that spelling has to be a listed alias as well as a printed form.
    const [first] = engine.complete("30 دولا");
    expect(first?.text).toBe(`30 دولار${AN}`);
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("usd");
  });

  // Right-to-left, asserted so a later reader does not "fix" it. What completion
  // inserts and what a user types is in *logical* order — the number first, the
  // word second — and the Unicode Bidirectional Algorithm is what puts the number
  // on the right at display time. Reversing the parts would emit a unit followed by
  // a number, which `parse` cannot read back; bidi isolates (U+2066–2069) are
  // invisible characters `normalize()` does not strip, so they would travel into
  // the lexer.
  test("the completed quantity is logically ordered and carries no bidi controls", () => {
    const [first] = engine.complete("30 دولا");
    const text = first?.text ?? "";
    expect(text.indexOf("30")).toBeLessThan(text.indexOf("د"));
    expect(text).not.toMatch(/[‎‏⁦-⁩]/);
  });

  test("round-trips its own output", () => {
    // What can round-trip here is the *word* path, not the symbol path: `money`'s
    // format hook prints "$30.00", and a currency sign is an alias of nothing in
    // any language, so the printed string is display and not input. The strings
    // below are what completion inserts and what a user types — one per
    // grammatical row, since Arabic's six rows are up to four different words —
    // and they are what has to survive the trip.
    for (const input of [
      "1 دولار",
      "2 دولاران",
      "5 دولارات",
      `11 دولار${AN}`,
      "1.5 دولار",
      "30 هريفنيا",
      "5 زلوتي",
      "100 دولار إلى هريفنيا",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyAr.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`30 ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does not
    // throw, which is worse than throwing and is why it is written down: `lex`
    // skips "$" as an unrecognized character, so "$30.00" comes back as the bare
    // *number* 30 with the currency silently gone. That is core's lexer, identical
    // under `en`, and nothing a vocabulary can reach; the word path above is the
    // one that round-trips.
    const printed = engine.evaluate("30 دولار").formatted;
    expect(printed).toBe("$30.00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
