import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberEs from "@smartput/number/locale/es";
// Through the package path, not "./es": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyEs from "@smartput/rate/locale/es";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Spanish word, and no more. The words are
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
const locale = composeLocale(spanish, [numberEs, moneyEs]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** Anything only Spanish would write — the accented vowels and the ñ. */
const SPANISH = /[áéíóúüñ]/i;

/** The key `spanish` will index a unit's `forms` with, for this count and slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  spanish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The currencies this file gives Spanish words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyEs.units).flatMap(
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
 * This is not a Spanish problem and not a `forms` problem: a currency sign is
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

describe("money es vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyEs.units).sort()).toEqual(units.sort());
    expect(moneyEs.locale).toBe("es");
    expect(moneyEs.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so nothing a language wrote
  // may reach it. Spanish shares the Latin script with the ISO codes, so the
  // grep is for what only Spanish writes — the accents — plus the words this
  // file adds.
  test("the kind itself carries no Spanish word", () => {
    const source = JSON.stringify(money);
    expect(source).not.toMatch(SPANISH);
    expect(source).not.toMatch(/dolar|libra|grivna|esterlina|esloti/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyEs.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Spanish words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyEs.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyEs.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned
  // vocabulary; the words behind it are English either way. This is the
  // assertion that says so out loud, so that the day `CURRENCIES` grows
  // localized names, the file above stops being right and this stops being green
  // together.
  test('currencyVocabulary("es") is English words under an es label', () => {
    const generated = currencyVocabulary("es");
    expect(generated.locale).toBe("es");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // Where Ukrainian could leave the generated `one`/`other` rows in place
  // harmlessly — `ukrainian.selectForm` returns neither key, so they were merely
  // unreachable — Spanish returns exactly those two. The generated table *fits*
  // here, so a row left standing would print an English word out of a Spanish
  // engine, and this is the assertion that says none did.
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyEs.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints an English word`).not.toMatch(
          /dollar|pound|kron|krone|koruna|hryvnia|zloty/i,
        );
        expect(words.aliases, `${code} prints a word it cannot read`).toContain(form);
      }
    }
    // The five with no Spanish word fall back to the symbol, which is only
    // possible because the generated rows were dropped: "kronor" would otherwise
    // have printed for `sek`.
    for (const code of UNTRANSLATED) {
      expect(moneyEs.units[code]?.forms, code).toBeUndefined();
    }
  });

  test("every translated currency carries exactly the two keys es can ask for", () => {
    expect(
      Object.keys(moneyEs.units)
        .filter((code) => moneyEs.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      // No more and no fewer (rule 6). `spanish.selectForm` folds CLDR's `many`
      // into `other`, so a third row would be a word no count could select.
      expect(Object.keys(moneyEs.units[code]?.forms ?? {}).sort(), code).toEqual([
        "one",
        "other",
      ]);
    }
  });

  test("the five with no single-word Spanish name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a
    // qualifier plus the head noun USD already owns ("dólar canadiense"), and a
    // unit word is one token — which is why `en` omits display forms for exactly
    // these two. SEK, NOK and CZK are worse: Spanish calls all three "corona",
    // so the word has no reading at all and is left unclaimed rather than handed
    // to whichever was written first.
    for (const code of UNTRANSLATED) {
      expect(
        moneyEs.units[code]?.aliases.some((a) => a !== code && !/^[a-z]+$/i.test(a)),
        `${code} claims a Spanish word`,
      ).toBe(false);
      expect(
        added.filter(([c]) => c === code),
        code,
      ).toEqual([]);
      // They stay typeable, because the ISO code always was the way to reach
      // them, in either language.
      expect(moneyEs.units[code]?.aliases, code).toContain(code);
    }
    // And the word itself is claimed by nobody, which is the point: three units
    // of one kind cannot share a reading.
    for (const words of Object.values(moneyEs.units)) {
      expect(words.aliases).not.toContain("corona");
      expect(words.aliases).not.toContain("coronas");
    }
  });

  // The one row where reading and printing part company, and the reason the
  // "dropped, not carried" assertion above has teeth for `pln` at all: the
  // generated English table says "zloty"/"zlotys", so a Spanish row spelled that
  // way could not be told apart from the English one. The RAE's adaptation is
  // what prints; the spelling Spanish newspapers use still reads.
  test("the zloty prints the adapted spelling and reads the borrowed one", () => {
    expect(moneyEs.units.pln?.forms).toEqual({ one: "esloti", other: "eslotis" });
    expect(currencyVocabulary("es").units.pln?.forms).toEqual({
      one: "zloty",
      other: "zlotys",
    });
    for (const word of ["zloty", "zlotys", "esloti", "eslotis"]) {
      expect(engine.evaluate(`5 ${word}`).value?.unit, word).toBe("pln");
    }
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the Spanish suffix stripper recovers
  // it — at `weight: -2`. Asserting the containment is what keeps the two halves
  // of an entry, what it writes and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyEs.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Spanish word is claimed by two currencies", () => {
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
    // "1,5 dólares" selects a row that exists.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        ...contractOptions,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Spanish money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency
    // symbol, minor units — so what the language decides here is the digits:
    // Spanish marks the decimal with "," and groups with ".".
    expect(engine.evaluate("30 dólares").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dolares").formatted).toBe("$30,00");
    expect(engine.evaluate("5 libras").formatted).toBe("£5,00");
    expect(engine.evaluate("5 esterlinas").formatted).toBe("£5,00");
    expect(engine.evaluate("100 yenes").formatted).toBe("¥100");
    expect(engine.evaluate("5 francos").formatted).toBe("CHF5,00");
    expect(engine.evaluate("5 eslotis").formatted).toBe("zł5,00");
    expect(engine.evaluate("30 grivnas").formatted).toBe("₴30,00");
    // A conversion through each of Spanish's two `in` keywords, and a grouped
    // result: "." between the thousands, "," before the cents.
    expect(engine.evaluate("100 dólares en grivnas").formatted).toBe("₴4.090,91");
    expect(engine.evaluate("5 libras a euros").formatted).toBe("€5,94");
    // A sum that lands on a fraction, and a division that does — both stay in
    // the currency they were typed in.
    expect(engine.evaluate("1 dólar + 0,5 dólares").formatted).toBe("$1,50");
    expect(engine.evaluate("10 dólares entre 4").formatted).toBe("$2,50");
  });

  test("the Latin aliases still read in a Spanish engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd en grivnas").formatted).toBe("₴4.090,91");
  });

  test("the count decides the row, and the fractional row is the plural one", () => {
    // Read off the table rather than through the formatter — `money` prints
    // "$1,50" whatever the grammar says, so this is the only place the words are
    // visible.
    const usd = moneyEs.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("dólar");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("dólares");
    // 21 is `other` in Spanish where it is `one` in Ukrainian — CLDR's Spanish
    // rules count exactly 1 and nothing else as singular — and 0 is `other` too,
    // which is the row "0 dólares" needs.
    expect(usd?.[key("usd", "after-number", 21)]).toBe("dólares");
    expect(usd?.[key("usd", "after-number", 0)]).toBe("dólares");
    // The fractional row. Spanish agrees with the count as written, so "1,5
    // dólares" is a plural — unlike Ukrainian, where the same count takes a
    // genitive *singular*.
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("dólares");
    // The consonant plural, which is where a stem-swapped copy of `usd` would
    // have written "yens".
    expect(moneyEs.units.jpy?.forms?.[key("jpy", "after-number", 5)]).toBe("yenes");
    // A million is CLDR's `many` category, folded into `other` by
    // `spanish.selectForm`; the row it lands on is the one every other plural
    // count lands on, which is why no third key exists.
    expect(usd?.[key("usd", "after-number", 1_000_000)]).toBe("dólares");
  });

  test("the slot is not an axis, and a target with no count still resolves", () => {
    // Ukrainian's two-axis contract has no counterpart here: Spanish does not
    // inflect a noun for its position in the sentence, so the same count answers
    // the same word in either slot. A conversion target with no count at all
    // (ruling R5) lands on `other` — "en dólares", which is the plural Spanish
    // writes there.
    expect(key("uah", "after-number", 5)).toBe(key("uah", "conversion-target", 5));
    expect(key("usd", "conversion-target")).toBe("other");
    expect(moneyEs.units.usd?.forms?.[key("usd", "conversion-target")]).toBe("dólares");
  });

  test("completion inserts a Spanish word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 gri");
    expect(first?.text).toBe("30 grivnas");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
    // The singular row, reached by the count rather than by the fragment.
    const [singular] = engine.complete("1 dól");
    expect(singular?.text).toBe("1 dólar");
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
        const form = moneyEs.units[code]?.forms?.[expected];
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
    const printed = engine.evaluate("30 dólares").formatted;
    expect(printed).toBe("$30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
