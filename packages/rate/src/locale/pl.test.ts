import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberPl from "@smartput/number/locale/pl";
// Through the package path, not "./pl": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyPl from "@smartput/rate/locale/pl";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Polish word, and no more. The words are
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
const locale = composeLocale(polish, [numberPl, moneyPl]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** The key `polish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  polish.selectForm({
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

/** The currencies this file gives Polish words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/**
 * Every word this vocabulary adds on top of the generated table, by currency.
 *
 * Derived by subtracting the generated aliases rather than by matching a script,
 * which is where Polish sides with German and not with Russian: Cyrillic is a
 * different alphabet and "доллар" can never be confused with "dollar", while
 * "dolar" and "dollar" differ by one letter.
 */
const added: Array<[string, string]> = Object.entries(moneyPl.units).flatMap(
  ([code, words]) => {
    const generated = new Set(CURRENCIES[code]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [code, a]);
  },
);

describe("money pl vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyPl.units).sort()).toEqual(units.sort());
    expect(moneyPl.locale).toBe("pl");
    expect(moneyPl.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is ratios, ISO codes and magnitude bands, so no word from any language may
  // reach it. A script regex is nearly useless here — Polish is written in the
  // same alphabet as the ISO codes — so this greps for the words themselves,
  // diacritics included.
  test("the kind itself carries no Polish word", () => {
    const source = JSON.stringify(money);
    expect(source).not.toMatch(/[ąćęłńóśźż]/i);
    expect(source).not.toMatch(/dolar|złoty|hrywna|frank|szterling|jenów/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyPl.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Polish words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyPl.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyPl.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
    // And nothing is indexed twice. This is the one translation in the phase that
    // needed the dedupe: Polish spells the euro exactly as the generated table
    // does, so `eur`'s two halves overlap where no other row's do.
    for (const [code, words] of Object.entries(moneyPl.units)) {
      expect(words.aliases.length, code).toBe(new Set(words.aliases).size);
    }
    expect(added.filter(([code]) => code === "eur")).toEqual([]);
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together.
  test('currencyVocabulary("pl") is English words under a pl label', () => {
    const generated = currencyVocabulary("pl");
    expect(generated.locale).toBe("pl");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  test("the English forms it generates are dropped, not carried", () => {
    // `one`/`other` is what `english.selectForm` produces. `polish.selectForm`
    // returns neither, so keeping the generated table would leave eight keys the
    // engine can only miss — and every word in it is English besides.
    for (const [code, words] of Object.entries(moneyPl.units)) {
      expect(Object.keys(words.forms ?? {}), code).not.toContain("one");
      expect(Object.keys(words.forms ?? {}), code).not.toContain("other");
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints an English word`).not.toMatch(
          /dollar|pound|yen|franc|zloty|hryvnia|krona|krone|koruna/,
        );
      }
    }
  });

  test("every translated currency carries all eight grammatical keys", () => {
    expect(
      Object.keys(moneyPl.units)
        .filter((code) => moneyPl.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyPl.units[code]?.forms ?? {}).sort(), code).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  test("the five with no single-word Polish name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a
    // qualifier plus the head noun USD already owns ("dolar kanadyjski"), and a
    // unit word is one token — which is why `en` omits display forms for exactly
    // these two. SEK, NOK and CZK are worse: Polish calls all three "korona", so
    // the word has no reading at all and is left unclaimed rather than handed to
    // whichever was written first.
    for (const code of UNTRANSLATED) {
      expect(moneyPl.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims a Polish word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach
      // them, in either language.
      expect(moneyPl.units[code]?.aliases, code).toContain(code);
    }
    // And the Polish word itself is claimed by nothing at all — unlike German,
    // where "Krone" is already `nok`'s own generated alias and the collision is
    // decided upstream. Nothing in the Latin table spells "korona", so leaving it
    // out is a choice this file makes rather than one it inherits.
    expect(added.some(([, alias]) => alias.startsWith("koron"))).toBe(false);
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the Polish suffix stripper recovers it
  // — at `weight: -2`. Asserting the containment is what keeps the two halves of
  // an entry, what it writes and what it reads, in step. It has teeth in this
  // language: "hrywien" has a fill vowel no stripper can put back, and "złotych"
  // is an adjectival ending that is not in the stripper's list at all.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyPl.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Polish word is claimed by two currencies", () => {
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
    // sign is notation, not a word. (Polish is the near miss: "zł" *is* readable
    // here, because this file lists it as an alias — but "zł5,00" is the sign
    // welded to the digits, and that is what the waiver is really about.) Every
    // alias is still asserted to resolve back to its own currency, and every
    // `forms` key the language can ask for is still swept for.
    const skipPrintable = Object.keys(moneyPl.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so `polish.selectForm`'s `other`
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

  test("an engine built from it reads and writes Polish money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits: Polish marks
    // the decimal with "," and groups with U+00A0, written as an escape because a
    // literal NBSP is invisible in source.
    expect(engine.evaluate("30 dolarów").formatted).toBe("$30,00");
    expect(engine.evaluate("30 hrywien").formatted).toBe("₴30,00");
    expect(engine.evaluate("5 złotych").formatted).toBe("zł5,00");
    // The abbreviation on every price tag in the country. It is an alias rather
    // than the symbol — the generated symbol already *is* "zł" — and without that
    // line this string would not parse at all.
    expect(engine.evaluate("5 zł").formatted).toBe("zł5,00");
    expect(engine.evaluate("30 baksów").formatted).toBe("$30,00");
    // The one currency whose Polish word is a different *gender* from its Russian
    // one: "jen" is masculine here and "иена" feminine there, so the four rows
    // differ in every cell.
    expect(engine.evaluate("5 jenów").formatted).toBe("¥5");
    expect(engine.evaluate("100 dolarów w hrywnach").formatted).toBe("₴4\u00A0090,91");
    expect(engine.evaluate("10 hrywien + 5 hrywien").formatted).toBe("₴15,00");
    // A sum that lands on a fraction, which is where a currency's minor units and
    // the fractional grammatical row meet: 1,5 selects `nom-other`, the genitive
    // singular "dolara", even though the format hook prints the sign and the digits
    // and never the word.
    expect(engine.evaluate("1 dolar + 0,5 dolara").formatted).toBe("$1,50");
    // Division through the Polish spelling, which is two keywords folded into one
    // operator — "podzielić" is `over` and "przez" the `by` particle it swallows,
    // exactly as English's "divided by".
    expect(engine.evaluate("10 euro podzielić przez 4").formatted).toBe("€2,50");
  });

  test("the Latin aliases still read in a Polish engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd w hrywnach").formatted).toBe("₴4\u00A0090,91");
  });

  test("the number decides the case, and the fractional row is a singular", () => {
    // The rows a `one`/`other` table cannot express, read off the table rather
    // than through the formatter — `money` prints "$1,50" whatever the grammar
    // says, so this is the only place the words are visible.
    const usd = moneyPl.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("dolar");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("dolary");
    expect(usd?.[key("usd", "after-number", 5)]).toBe("dolarów");
    // 21 is `many` in CLDR's Polish rules — every -1 above twenty counts by its
    // final digit the way 5 does — so "21 dolarów" is a genitive plural where
    // Ukrainian's "двадцять один долар" is a nominative singular. This is the one
    // assertion a table ported from `uk` fails.
    expect(usd?.[key("usd", "after-number", 21)]).toBe("dolarów");
    expect(usd?.[key("usd", "after-number", 22)]).toBe("dolary");
    // The fractional row: genitive *singular*, and a different word from the 2/3/4
    // row above — which is the assertion a table ported from `ru` fails, since
    // Russian spells those two rows alike.
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("dolara");
    expect(usd?.[key("usd", "after-number", 1.5)]).not.toBe(
      usd?.[key("usd", "after-number", 2)],
    );
    // The adjectival paradigm answers differently in every one of those cells,
    // which is why `pln` is not `usd` with the stem swapped: its 2/3/4 row ends in
    // -e rather than -y, and its fractional row is the adjectival genitive -ego.
    const pln = moneyPl.units.pln?.forms;
    expect(pln?.[key("pln", "after-number", 2)]).toBe("złote");
    expect(pln?.[key("pln", "after-number", 5)]).toBe("złotych");
    expect(pln?.[key("pln", "after-number", 1.5)]).toBe("złotego");
    // Feminine hard: the genitive plural is a bare stem with a fill vowel dropped
    // into the cluster it leaves — "5 hrywien", not the "hrywn" a stripper would
    // produce.
    expect(moneyPl.units.uah?.forms?.[key("uah", "after-number", 5)]).toBe("hrywien");
    // Indeclinable: one word in all eight cells, which is a fact about the noun and
    // not a table that was left half-filled.
    expect(new Set(Object.values(moneyPl.units.eur?.forms ?? {}))).toEqual(
      new Set(["euro"]),
    );
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract: the same count picks a nominative form after a number
    // and a locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "w hrywnach", the row a one-dimensional plural table
    // had no cell for.
    const uah = moneyPl.units.uah?.forms;
    expect(uah?.[key("uah", "after-number", 5)]).toBe("hrywien");
    expect(uah?.[key("uah", "conversion-target", 5)]).toBe("hrywnach");
    expect(key("uah", "conversion-target")).toBe("loc-other");
    expect(uah?.[key("uah", "conversion-target")]).toBe("hrywnach");
    // The locative singular is its own ending in every paradigm, so the slot axis
    // is not one suffix applied to every stem — and the three Slavic tables
    // disagree about this exact cell. A velar stem takes -u with no alternation
    // ("we franku"), where Russian has "франке" and Ukrainian "франку"; the dollar
    // runs r→rz and the pound t→c to reach theirs.
    expect(moneyPl.units.chf?.forms?.[key("chf", "conversion-target", 1)]).toBe("franku");
    expect(moneyPl.units.usd?.forms?.[key("usd", "conversion-target", 1)]).toBe(
      "dolarze",
    );
    expect(moneyPl.units.gbp?.forms?.[key("gbp", "conversion-target", 1)]).toBe("funcie");
  });

  test("completion inserts a Polish word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 hryw");
    expect(first?.text).toBe("30 hrywien");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
    // And the adjectival one, where the inserted word is not the alias that was
    // typed towards: "złote" is what matched, "złotych" is what 5 selects.
    const [zloty] = engine.complete("5 zło");
    expect(zloty?.text).toBe("5 złotych");
    expect(engine.evaluate(zloty?.text ?? "").value?.unit).toBe("pln");
  });

  test("round-trips its own output", () => {
    // What can round-trip here is the *word* path, not the symbol path: `money`'s
    // format hook prints "$30,00", and a currency sign is an alias of nothing in
    // any language, so the printed string is display and not input. The strings
    // below are what completion inserts and what a user types — one per
    // grammatical row, since Polish's four rows are four different words — and
    // they are what has to survive the trip.
    for (const input of [
      "1 dolar",
      "2 dolary",
      "5 dolarów",
      "21 dolarów",
      "1,5 dolara",
      "30 hrywien",
      "5 złotych",
      "100 dolarów w hrywnach",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyPl.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`30 ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does not
    // throw, which is worse than throwing and is why it is written down: `lex`
    // skips "$" as an unrecognized character, so "$30,00" comes back as the bare
    // *number* 30 with the currency silently gone. That is core's lexer, identical
    // under `en` for "$30.00", and nothing a vocabulary can reach; the word path
    // above is the one that round-trips.
    const printed = engine.evaluate("30 dolarów").formatted;
    expect(printed).toBe("$30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
