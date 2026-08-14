import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberIt from "@smartput/number/locale/it";
// Through the package path, not "./it": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyIt from "@smartput/rate/locale/it";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives an Italian word, and no more. The words are
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
const locale = composeLocale(italian, [numberIt, moneyIt]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** Anything only Italian would write — the five accented vowels it uses. */
const ITALIAN = /[àèéìòù]/i;

/** The key `italian` will index a unit's `forms` with, for this count and slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  italian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The currencies this file gives Italian forms, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/** The three whose Italian plural is the singular — the invariant class. */
const INVARIANT = ["eur", "jpy", "pln"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyIt.units).flatMap(
  ([code, words]) => {
    const generated = new Set(CURRENCIES[code]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [code, a]);
  },
);

/**
 * The currencies whose printed *symbol* the alias index cannot read back, which
 * is every one whose sign is not also one of its words. Only "CHF" and "NOK" are
 * — both are the ISO code doing symbol duty — so ten of the twelve are named
 * here.
 *
 * This is not an Italian problem and not a `forms` problem: a currency sign is
 * never read through the alias index in any language ("$30" lexes as a bare
 * number, in `en` too, and `money`'s own literal path is what claims it
 * elsewhere), and the *words* are still checked by the contract for the two
 * currencies not on this list and by "every form it prints is a form it reads"
 * below for all seven that have them. Naming the list is what keeps it from
 * quietly growing.
 */
const UNREADABLE_SYMBOLS = [
  "eur",
  "usd",
  "gbp",
  "jpy",
  "pln",
  "uah",
  "cad",
  "aud",
  "sek",
  "czk",
];

const contractOptions = {
  skipPrintable: UNREADABLE_SYMBOLS.map((code) => `money:${code}`),
};

describe("money it vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyIt.units).sort()).toEqual(units.sort());
    expect(moneyIt.locale).toBe("it");
    expect(moneyIt.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so nothing a language wrote
  // may reach it. Italian shares the Latin script with the ISO codes, so the
  // grep is for what only Italian writes — the accents — plus the words this
  // file adds.
  test("the kind itself carries no Italian word", () => {
    const source = JSON.stringify(money);
    expect(source).not.toMatch(ITALIAN);
    expect(source).not.toMatch(/dollar[oi]|sterlin[ae]|grivni[ae]|franchi/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyIt.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Italian words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyIt.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyIt.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned
  // vocabulary; the words behind it are English either way. This is the
  // assertion that says so out loud, so that the day `CURRENCIES` grows
  // localized names, the file above stops being right and this stops being green
  // together.
  test('currencyVocabulary("it") is English words under an it label', () => {
    const generated = currencyVocabulary("it");
    expect(generated.locale).toBe("it");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // Where Ukrainian could leave the generated `one`/`other` rows in place
  // harmlessly — `ukrainian.selectForm` returns neither key, so they were merely
  // unreachable — Italian returns exactly those two. The generated table *fits*
  // here, so a row left standing would print an English word out of an Italian
  // engine, and this is the assertion that says none did.
  //
  // The match has to be on the whole string and not on a substring, which is a
  // point about this language rather than about the test: "dollaro" *contains*
  // "dollar", and Spanish's version of this check (a bare `/dollar|pound|…/`)
  // fails on the correct Italian word. Italian borrows its currency nouns from
  // the same Latin stems English does, so the two languages are separated by
  // their endings and nothing else.
  const ENGLISH_ONLY =
    /^(dollars?|pounds?|krona|kronor|krone|kroner|koruna|korunas|hryvnias?|zlotys|euros)$/i;
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyIt.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints an English word`).not.toMatch(ENGLISH_ONLY);
        expect(words.aliases, `${code} prints a word it cannot read`).toContain(form);
      }
    }
    // The stronger half, which the pattern above cannot state: no translated
    // currency's table is the generated one. `jpy` is the single exception and
    // it is a coincidence rather than an oversight — the yen is invariant in
    // both languages, so "yen"/"yen" is what a correct Italian row and a correct
    // English row both hold, and there is no string that could tell them apart.
    for (const code of TRANSLATED.filter((c) => c !== "jpy")) {
      expect(moneyIt.units[code]?.forms, code).not.toEqual(
        currencyVocabulary("it").units[code]?.forms ?? {},
      );
    }
    expect(moneyIt.units.jpy?.forms).toEqual({ one: "yen", other: "yen" });
    expect(currencyVocabulary("it").units.jpy?.forms).toEqual({
      one: "yen",
      other: "yen",
    });
    // The five with no Italian word fall back to the symbol, which is only
    // possible because the generated rows were dropped: "kronor" would otherwise
    // have printed for `sek`.
    for (const code of UNTRANSLATED) {
      expect(moneyIt.units[code]?.forms, code).toBeUndefined();
    }
  });

  test("every translated currency carries exactly the two keys it can ask for", () => {
    expect(
      Object.keys(moneyIt.units)
        .filter((code) => moneyIt.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      // No more and no fewer (rule 6). `italian.selectForm` folds CLDR's `many`
      // into `other`, so a third row would be a word no count could select.
      expect(Object.keys(moneyIt.units[code]?.forms ?? {}).sort(), code).toEqual([
        "one",
        "other",
      ]);
    }
  });

  // The Italian finding, and the one this vocabulary would be wrong without: a
  // two-row table whose rows hold the same string is not a table someone forgot
  // to finish. "yen" and "zloty" end in a consonant, which is the shape Italian
  // never inflects, and "euro" is invariant by decree — the Crusca fixes the
  // plural as "euro" because the word is a clipping of "Europa", which is why
  // "5 euri" is wrong however regular it looks. The other four do inflect, and
  // asserting both halves is what keeps a later editor from "fixing" either.
  test("the invariant class prints one word for both rows, and the rest do not", () => {
    for (const code of INVARIANT) {
      const forms = moneyIt.units[code]?.forms;
      expect(forms?.one, code).toBe(forms?.other ?? "");
    }
    for (const code of TRANSLATED.filter((c) => !INVARIANT.includes(c))) {
      const forms = moneyIt.units[code]?.forms;
      expect(forms?.one, code).not.toBe(forms?.other ?? "");
    }
    // And the row that proves the invariance is Italian rather than inherited:
    // the generated English table pluralizes both of these, and only the `other`
    // row separates the two languages.
    expect(moneyIt.units.eur?.forms).toEqual({ one: "euro", other: "euro" });
    expect(currencyVocabulary("it").units.eur?.forms).toEqual({
      one: "euro",
      other: "euros",
    });
    expect(moneyIt.units.pln?.forms).toEqual({ one: "zloty", other: "zloty" });
    expect(currencyVocabulary("it").units.pln?.forms).toEqual({
      one: "zloty",
      other: "zlotys",
    });
  });

  test("the five with no single-word Italian name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a
    // qualifier plus the head noun USD already owns ("dollaro canadese"), and a
    // unit word is one token — which is why `en` omits display forms for exactly
    // these two. SEK, NOK and CZK are worse: Italian calls all three "corona",
    // so the word has no reading at all and `assertLocaleContract`'s rival check
    // would refuse it outright.
    for (const code of UNTRANSLATED) {
      expect(
        added.filter(([c]) => c === code),
        code,
      ).toEqual([]);
      // They stay typeable, because the ISO code always was the way to reach
      // them, in either language.
      expect(moneyIt.units[code]?.aliases, code).toContain(code);
    }
    // And the word itself is claimed by nobody, which is the point: three units
    // of one kind cannot share a reading.
    for (const words of Object.values(moneyIt.units)) {
      expect(words.aliases).not.toContain("corona");
      expect(words.aliases).not.toContain("corone");
    }
  });

  // The plural classes this language actually uses, read off the table rather
  // than through the formatter, since `money`'s format hook prints a sign and
  // these words are otherwise invisible. Each row names the fold in `it.ts` it
  // belongs to, because a copy-pasted stem would have written "francos" or
  // "sterlinas" and nothing else here would have caught it.
  test("each inflecting currency takes the plural its own class takes", () => {
    // The ordinary masculine, `i → o`.
    expect(moneyIt.units.usd?.forms).toEqual({ one: "dollaro", other: "dollari" });
    // The same class with the velar preserved in spelling, `chi → co`.
    expect(moneyIt.units.chf?.forms).toEqual({ one: "franco", other: "franchi" });
    // The ordinary feminine, `e → a`.
    expect(moneyIt.units.gbp?.forms).toEqual({ one: "sterlina", other: "sterline" });
    expect(moneyIt.units.uah?.forms).toEqual({ one: "grivnia", other: "grivnie" });
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the Italian plural fold recovers it
  // — at `weight: -2`. Asserting the containment is what keeps the two halves of
  // an entry, what it writes and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyIt.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Italian word is claimed by two currencies", () => {
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
    expect(() =>
      assertLocaleContract(locale, [money, number], contractOptions),
    ).not.toThrow();
    // The default counts are all integers, so the `other` category is never
    // reached through a *fraction* at all — and a fractional amount of money is
    // the ordinary case rather than an edge one. Adding 1,5 is what proves
    // "1,5 dollari" selects a row that exists.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        ...contractOptions,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Italian money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency
    // symbol, minor units — so what the language decides here is the digits:
    // Italian marks the decimal with "," and groups with ".".
    expect(engine.evaluate("30 dollari").formatted).toBe("$30,00");
    expect(engine.evaluate("1 dollaro").formatted).toBe("$1,00");
    expect(engine.evaluate("5 sterline").formatted).toBe("£5,00");
    expect(engine.evaluate("100 yen").formatted).toBe("¥100");
    expect(engine.evaluate("5 franchi").formatted).toBe("CHF5,00");
    expect(engine.evaluate("5 zloty").formatted).toBe("zł5,00");
    expect(engine.evaluate("30 grivnie").formatted).toBe("₴30,00");
    // The invariant plural, which is the row an Italian reader would notice if
    // it were wrong: five of them is "5 euro", never "5 euri".
    expect(engine.evaluate("5 euro").formatted).toBe("€5,00");
    // A conversion through each of Italian's two `in` keywords, and a grouped
    // result: "." between the thousands, "," before the cents.
    expect(engine.evaluate("100 dollari in grivnie").formatted).toBe("₴4.090,91");
    expect(engine.evaluate("5 sterline a euro").formatted).toBe("€5,94");
    // A sum that lands on a fraction, and a division that does — both stay in
    // the currency they were typed in, and both connectives are Italian's own
    // ("diviso" is a complete operator, with no "per" after it).
    expect(engine.evaluate("1 dollaro + 0,5 dollari").formatted).toBe("$1,50");
    expect(engine.evaluate("10 dollari diviso 4").formatted).toBe("$2,50");
  });

  test("the Latin aliases still read in an Italian engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd in grivnie").formatted).toBe("₴4.090,91");
  });

  test("the count decides the row, and the fractional row is the plural one", () => {
    // Read off the table rather than through the formatter — `money` prints
    // "$1,50" whatever the grammar says, so this is the only place the words are
    // visible.
    const usd = moneyIt.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("dollaro");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("dollari");
    // 21 is `other` in Italian where it is `one` in Ukrainian — CLDR's Italian
    // rules count exactly 1 and nothing else as singular — and 0 is `other` too,
    // which is the row "0 dollari" needs.
    expect(usd?.[key("usd", "after-number", 21)]).toBe("dollari");
    expect(usd?.[key("usd", "after-number", 0)]).toBe("dollari");
    // The fractional row. Italian agrees with the count as written, so "1,5
    // dollari" is a plural — unlike Ukrainian, where the same count takes a
    // genitive *singular*.
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("dollari");
    // The velar plural, which is where a stem-swapped copy of `usd` would have
    // written "franci" and quietly changed the consonant.
    expect(moneyIt.units.chf?.forms?.[key("chf", "after-number", 5)]).toBe("franchi");
    // A million is CLDR's `many` category for Italian, folded into `other` by
    // `italian.selectForm`; the row it lands on is the one every other plural
    // count lands on, which is why no third key exists. `it.ts` argues this at
    // length: `many` exists for the compact "un milione di euro", which this
    // engine never prints.
    expect(usd?.[key("usd", "after-number", 1_000_000)]).toBe("dollari");
  });

  test("the slot is not an axis, and a target with no count still resolves", () => {
    // Ukrainian's two-axis contract has no counterpart here: Italian does not
    // inflect a noun for its position in the sentence, so the same count answers
    // the same word in either slot. A conversion target with no count at all
    // (ruling R5) lands on `other` — "in dollari", which is the plural Italian
    // writes there.
    expect(key("uah", "after-number", 5)).toBe(key("uah", "conversion-target", 5));
    expect(key("usd", "conversion-target")).toBe("other");
    expect(moneyIt.units.usd?.forms?.[key("usd", "conversion-target")]).toBe("dollari");
  });

  test("completion inserts an Italian word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 gri");
    expect(first?.text).toBe("30 grivnie");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
    // The singular row, reached by the count rather than by the fragment.
    const [singular] = engine.complete("1 doll");
    expect(singular?.text).toBe("1 dollaro");
    expect(engine.evaluate(singular?.text ?? "").formatted).toBe("$1,00");
  });

  test("round-trips the words it prints, and records that its output cannot", () => {
    // The round trip this kind actually has: what completion inserts is what a
    // user hands back, so every form of every translated currency is re-read at
    // the count that selects it.
    for (const code of TRANSLATED) {
      for (const [count, expected] of [
        [1, "one"],
        [5, "other"],
        [1.5, "other"],
      ] as const) {
        const form = moneyIt.units[code]?.forms?.[expected];
        expect(key(code, "after-number", count), code).toBe(expected);
        const again = engine.evaluate(`${String(count).replace(".", ",")} ${form}`);
        expect(again.value?.unit, `${code} ${form}`).toBe(code);
      }
    }
    // What cannot be round-tripped, in this language or in English: `money`'s
    // format hook prints a currency *sign*, and no lexer reads one — "$30,00"
    // comes back as the bare number 30, exactly as "$30.00" does out of an
    // English engine. It is a property of the kind's own output path, not of
    // this vocabulary, which is why the ten signs above are `skipPrintable`
    // rather than repaired here.
    const printed = engine.evaluate("30 dollari").formatted;
    expect(printed).toBe("$30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
