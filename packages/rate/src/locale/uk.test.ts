import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberUk from "@smartput/number/locale/uk";
// Through the package path, not "./uk": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact
// that `./locale/en` was missing from it.
import moneyUk from "@smartput/rate/locale/uk";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Ukrainian word, and no more. The words are
 * checked by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of
 * rates has to cover the table of words, and a word added below with no rate
 * here fails loudly rather than going unchecked.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  UAH: 45,
  PLN: 4.3,
  JPY: 160,
  CHF: 0.94,
});
const engine = createEngine({
  locales: [composeLocale(ukrainian, [numberUk, moneyUk])],
  kinds: [number, money],
  rates,
});

const CYRILLIC = /[Ѐ-ӿ]/;

/** The key `ukrainian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  ukrainian.selectForm({
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

/** The currencies this file gives Ukrainian words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyUk.units).flatMap(
  ([code, words]) =>
    words.aliases.filter((a) => CYRILLIC.test(a)).map((a): [string, string] => [code, a]),
);

describe("money uk vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyUk.units).sort()).toEqual(units.sort());
    expect(moneyUk.locale).toBe("uk");
    expect(moneyUk.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so no script but ASCII may
  // reach it. Cyrillic in the descriptor would mean a translation had leaked
  // into the half of the package that is supposed to be language-free.
  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(money)).not.toMatch(CYRILLIC);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyUk.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language,
    // so they come through untouched and the Ukrainian words are appended after
    // them. Losing them would mean "30 usd" stops parsing the moment the format
    // locale changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyUk.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyUk.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned
  // vocabulary; the words behind it are English either way. This is the
  // assertion that says so out loud, so that the day `CURRENCIES` grows
  // localized names, the file above stops being right and this stops being
  // green together.
  test('currencyVocabulary("uk") is English words under a uk label', () => {
    const generated = currencyVocabulary("uk");
    expect(generated.locale).toBe("uk");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  test("the English forms it generates are dropped, not carried", () => {
    // `one`/`other` is what `english.selectForm` produces. `ukrainian.selectForm`
    // returns neither, so keeping the generated table would leave eight keys the
    // engine can only miss — and every word in it is English besides.
    for (const [code, words] of Object.entries(moneyUk.units)) {
      expect(Object.keys(words.forms ?? {}), code).not.toContain("one");
      expect(Object.keys(words.forms ?? {}), code).not.toContain("other");
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints a Latin word`).toMatch(CYRILLIC);
      }
    }
  });

  test("every translated currency carries all eight grammatical keys", () => {
    expect(
      Object.keys(moneyUk.units)
        .filter((code) => moneyUk.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyUk.units[code]?.forms ?? {}).sort(), code).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  test("the five with no single-word Ukrainian name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a
    // qualifier plus the head noun USD already owns ("канадський долар"), and a
    // unit word is one token — which is why `en` omits display forms for
    // exactly these two. SEK, NOK and CZK are worse: Ukrainian calls all three
    // "крона", so the word has no reading at all and is left unclaimed rather
    // than handed to whichever was written first.
    for (const code of UNTRANSLATED) {
      expect(moneyUk.units[code]?.forms, code).toBeUndefined();
      expect(
        moneyUk.units[code]?.aliases.some((a) => CYRILLIC.test(a)),
        `${code} claims a Ukrainian word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach
      // them, in either language.
      expect(moneyUk.units[code]?.aliases, code).toContain(code);
    }
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the Ukrainian suffix stripper
  // recovers it — at `weight: -2`. Asserting the containment is what keeps the
  // two halves of an entry, what it writes and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyUk.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Ukrainian word is claimed by two currencies", () => {
    // What `assertLocaleContract` would have caught, checked by hand because
    // that helper cannot be run against this kind in any language: it asserts
    // that every string a unit can print is readable back, and a currency sign
    // ("$", "₴") is readable back in no language — `money` prints through
    // `symbolOf`, not through the alias index.
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

  test("an engine built from it reads and writes Ukrainian money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency
    // symbol, minor units — so what the language decides here is the digits:
    // Ukrainian marks the decimal with "," and groups with U+00A0, written as
    // an escape because a literal NBSP is invisible in source.
    expect(engine.evaluate("30 доларів").formatted).toBe("$30,00");
    expect(engine.evaluate("30 гривень").formatted).toBe("₴30,00");
    expect(engine.evaluate("30 грн").formatted).toBe("₴30,00");
    expect(engine.evaluate("5 злотих").formatted).toBe("zł5,00");
    expect(engine.evaluate("30 баксів").formatted).toBe("$30,00");
    expect(engine.evaluate("100 доларів у гривнях").formatted).toBe("₴4 090,91");
    expect(engine.evaluate("10 гривень + 5 гривень").formatted).toBe("₴15,00");
  });

  test("the Latin aliases still read in a Ukrainian engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd в гривнях").formatted).toBe("₴4 090,91");
  });

  test("the number decides the case, and the fractional row is a singular", () => {
    // The three rows a `one`/`other` table cannot express, read off the table
    // rather than through the formatter — `money` prints "$1,50" whatever the
    // grammar says, so this is the only place the words are visible.
    const usd = moneyUk.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("долар");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("долари");
    expect(usd?.[key("usd", "after-number", 5)]).toBe("доларів");
    // 21 is `one` in CLDR's Ukrainian rules — the category follows the last
    // digit — so "21 долар" is singular where "21 dollars" is not.
    expect(usd?.[key("usd", "after-number", 21)]).toBe("долар");
    // The fractional row: genitive *singular*, and the assertion that would read
    // "доларів" if a plural had been written into `nom-other`.
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("долара");
    // The adjectival paradigm answers differently in every one of those cells,
    // which is why `pln` is not `usd` with the stem swapped.
    const pln = moneyUk.units.pln?.forms;
    expect(pln?.[key("pln", "after-number", 2)]).toBe("злоті");
    expect(pln?.[key("pln", "after-number", 5)]).toBe("злотих");
    expect(pln?.[key("pln", "after-number", 1.5)]).toBe("злотого");
    // Indeclinable: one word in all eight cells, which is a fact about the noun
    // and not a table that was left half-filled.
    expect(new Set(Object.values(moneyUk.units.eur?.forms ?? {}))).toEqual(
      new Set(["євро"]),
    );
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract: the same count picks a nominative form after a
    // number and a locative one as a conversion target, and a target with no
    // count at all lands on `loc-other` — "в гривнях", the row a
    // one-dimensional plural table had no cell for.
    const uah = moneyUk.units.uah?.forms;
    expect(uah?.[key("uah", "after-number", 5)]).toBe("гривень");
    expect(uah?.[key("uah", "conversion-target", 5)]).toBe("гривнях");
    expect(key("uah", "conversion-target")).toBe("loc-other");
    expect(uah?.[key("uah", "conversion-target")]).toBe("гривнях");
    // The masculine locative singular is its own ending, so the slot axis is not
    // one suffix applied to every stem: "в одному франку", not "в франках".
    expect(moneyUk.units.chf?.forms?.[key("chf", "conversion-target", 1)]).toBe("франку");
  });

  test("completion inserts a Ukrainian word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 гри");
    expect(first?.text).toBe("30 гривень");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
  });
});
