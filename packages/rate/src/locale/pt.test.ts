import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberPt from "@smartput/number/locale/pt";
// Through the package path, not "./pt": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyPt from "@smartput/rate/locale/pt";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Portuguese word, and no more. The words are
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
const locale = composeLocale(portuguese, [numberPt, moneyPt]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** Anything only Portuguese would write — the tilde and the rest of the accents. */
const PORTUGUESE = /[ãõáéíóúàâêôç]/i;

/** The key `portuguese` will index a unit's `forms` with, for this count and slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  portuguese.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The currencies this file gives Portuguese words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyPt.units).flatMap(
  ([code, words]) => {
    const generated = new Set(CURRENCIES[code]?.aliases ?? []);
    return words.aliases
      .filter((a) => !generated.has(a))
      .map((a): [string, string] => [code, a]);
  },
);

/**
 * The currencies whose printed *symbol* the alias index cannot read back, which is
 * every one whose sign is not also one of its words. Only "CHF" and "NOK" are —
 * both are the ISO code doing symbol duty — so ten of the twelve are named here.
 *
 * This is not a Portuguese problem and not a `forms` problem: a currency sign is
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

describe("money pt vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyPt.units).sort()).toEqual(units.sort());
    expect(moneyPt.locale).toBe("pt");
    expect(moneyPt.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is ratios, ISO codes and magnitude bands, so nothing a language wrote may
  // reach it. Portuguese shares the Latin script with the ISO codes, so the grep
  // is for what only Portuguese writes — the accents — plus the words this file
  // adds.
  test("the kind itself carries no Portuguese word", () => {
    const source = JSON.stringify(money);
    expect(source).not.toMatch(PORTUGUESE);
    expect(source).not.toMatch(/dolar|libra|iene|esterlina|zloti\b/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyPt.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Portuguese words are appended after
    // them. Losing them would mean "30 usd" stops parsing the moment the format
    // locale changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyPt.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyPt.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together.
  test('currencyVocabulary("pt") is English words under a pt label', () => {
    const generated = currencyVocabulary("pt");
    expect(generated.locale).toBe("pt");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // Where Ukrainian could leave the generated `one`/`other` rows in place
  // harmlessly — `ukrainian.selectForm` returns neither key, so they were merely
  // unreachable — Portuguese returns exactly those two. The generated table *fits*
  // here, so a row left standing would print an English word out of a Portuguese
  // engine, and this is the assertion that says none did. "hryvnia" is exempt from
  // the grep and only from the grep: it is the Portuguese name too, quoted rather
  // than adapted, and the row is re-declared below rather than inherited.
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyPt.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints an English word`).not.toMatch(
          /dollar|pound|kron|krone|koruna|zloty|\byen\b/i,
        );
        expect(words.aliases, `${code} prints a word it cannot read`).toContain(form);
      }
    }
    // The five with no Portuguese word fall back to the symbol, which is only
    // possible because the generated rows were dropped: "kronor" would otherwise
    // have printed for `sek`.
    for (const code of UNTRANSLATED) {
      expect(moneyPt.units[code]?.forms, code).toBeUndefined();
    }
  });

  test("every translated currency carries exactly the two keys pt can ask for", () => {
    expect(
      Object.keys(moneyPt.units)
        .filter((code) => moneyPt.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      // No more and no fewer (rule 6). `portuguese.selectForm` folds CLDR's `many`
      // into `other`, so a third row would be a word no count could select — and
      // Portuguese is a language where `many` is genuinely returned by
      // `Intl.PluralRules` for a whole million, so the folding is the only reason
      // two rows are enough.
      expect(Object.keys(moneyPt.units[code]?.forms ?? {}).sort(), code).toEqual([
        "one",
        "other",
      ]);
    }
  });

  test("the five with no single-word Portuguese name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a
    // qualifier plus the head noun USD already owns ("dólar canadense"), and a unit
    // word is one token — which is why `en` omits display forms for exactly these
    // two. SEK, NOK and CZK are worse: Portuguese calls all three "coroa", so the
    // word has no reading at all and is left unclaimed rather than handed to
    // whichever was written first.
    for (const code of UNTRANSLATED) {
      expect(
        added.filter(([c]) => c === code),
        code,
      ).toEqual([]);
      // They stay typeable, because the ISO code always was the way to reach them,
      // in either language.
      expect(moneyPt.units[code]?.aliases, code).toContain(code);
    }
    // And the word itself is claimed by nobody, which is the point: three units of
    // one kind cannot share a reading.
    for (const words of Object.values(moneyPt.units)) {
      expect(words.aliases).not.toContain("coroa");
      expect(words.aliases).not.toContain("coroas");
    }
  });

  // The one row where reading and printing part company, and the reason the
  // "dropped, not carried" assertion above has teeth for `pln` at all: the
  // generated English table says "zloty"/"zlotys", so a Portuguese row spelled
  // that way could not be told apart from the English one. The adaptation is what
  // prints; the spelling the financial pages use still reads.
  test("the zloty prints the adapted spelling and reads the borrowed one", () => {
    expect(moneyPt.units.pln?.forms).toEqual({ one: "zloti", other: "zlotis" });
    expect(currencyVocabulary("pt").units.pln?.forms).toEqual({
      one: "zloty",
      other: "zlotys",
    });
    for (const word of ["zloty", "zlotys", "zloti", "zlotis"]) {
      expect(engine.evaluate(`5 ${word}`).value?.unit, word).toBe("pln");
    }
  });

  // The opposite case, and the reason both are written down. Portuguese has no
  // adaptation of the hryvnia — it quotes the transliteration, as English does —
  // so the row is spelled like the English one deliberately. What it adds is the
  // *plural*: `CURRENCIES` lists "hryvnias" as a display form and never as an
  // alias, so before this file it was reachable only through the penalised suffix
  // stripper.
  test("the hryvnia is quoted rather than adapted, and its plural is a real addition", () => {
    expect(CURRENCIES.uah?.aliases).not.toContain("hryvnias");
    expect(moneyPt.units.uah?.aliases).toContain("hryvnias");
    expect(moneyPt.units.uah?.forms).toEqual({ one: "hryvnia", other: "hryvnias" });
    expect(engine.evaluate("30 hryvnias").value?.unit).toBe("uah");
  });

  // The Brazilian currency is not in this table, and the language file's headline
  // plural class is the one that has nowhere to land because of it. Recorded as an
  // assertion rather than a comment, because the day `CURRENCIES` grows `brl` this
  // is the test that should fail and send someone back to this file.
  test("records that the real — pt's own plural class — has no unit here", () => {
    expect(CURRENCIES.brl).toBeUndefined();
    for (const words of Object.values(moneyPt.units)) {
      expect(words.aliases).not.toContain("real");
      expect(words.aliases).not.toContain("reais");
    }
    // The language can read the plural back to its singular all the same — that is
    // `pluralReplacer`'s -ais → -al row — there is simply no currency for it to
    // resolve to.
    expect(() => engine.evaluate("30 reais")).toThrow();
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the Portuguese suffix stripper
  // recovers it — at `weight: -2`. Asserting the containment is what keeps the two
  // halves of an entry, what it writes and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyPt.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Portuguese word is claimed by two currencies", () => {
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
    // The default counts are all integers, so the `one` category is never reached
    // through a *fraction* at all — and a fractional amount of money is the
    // ordinary case rather than an edge one. Adding 1,5 is what proves "1,5 dólar"
    // selects a row that exists, and in Portuguese that row is the *singular*,
    // which is the opposite of what an English-speaking author would have written.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        ...contractOptions,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Portuguese money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits: Brazilian
    // Portuguese marks the decimal with "," and groups with ".".
    expect(engine.evaluate("30 dólares").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dolares").formatted).toBe("$30,00");
    expect(engine.evaluate("5 libras").formatted).toBe("£5,00");
    expect(engine.evaluate("5 esterlinas").formatted).toBe("£5,00");
    expect(engine.evaluate("100 ienes").formatted).toBe("¥100");
    expect(engine.evaluate("5 francos").formatted).toBe("CHF5,00");
    expect(engine.evaluate("5 zlotis").formatted).toBe("zł5,00");
    expect(engine.evaluate("30 hryvnias").formatted).toBe("₴30,00");
    // A conversion through each of Portuguese's two `in` keywords, and a grouped
    // result: "." between the thousands, "," before the cents.
    expect(engine.evaluate("100 dólares em hryvnias").formatted).toBe("₴4.090,91");
    expect(engine.evaluate("5 libras para euros").formatted).toBe("€5,94");
    // A sum that lands on a fraction, and a division that does — both stay in the
    // currency they were typed in. "sobre" is the one-word divisor `pt.ts` argues
    // for, since "dividido por" is two operator tokens in this language.
    expect(engine.evaluate("1 dólar mais 0,5 dólar").formatted).toBe("$1,50");
    expect(engine.evaluate("10 dólares sobre 4").formatted).toBe("$2,50");
  });

  test("the Latin aliases still read in a Portuguese engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd em hryvnias").formatted).toBe("₴4.090,91");
  });

  test("the count decides the row, and the fractional row is the singular one", () => {
    // Read off the table rather than through the formatter — `money` prints
    // "$1,50" whatever the grammar says, so this is the only place the words are
    // visible.
    const usd = moneyPt.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("dólar");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("dólares");
    expect(usd?.[key("usd", "after-number", 21)]).toBe("dólares");
    // The two rows Portuguese does not share with English or with Spanish. CLDR's
    // rule is `i = 0..1`, so **0 is singular** — "0 dólar" — and so is a fraction:
    // "1,5 dólar", where Spanish writes "1,5 dólares" and English "1.5 dollars".
    expect(usd?.[key("usd", "after-number", 0)]).toBe("dólar");
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("dólar");
    // The vowel plural, which is where a stem-swapped copy of `usd` would have
    // written "ienees".
    expect(moneyPt.units.jpy?.forms?.[key("jpy", "after-number", 5)]).toBe("ienes");
    // A million is CLDR's `many` category — genuinely returned for Portuguese by
    // this runtime — folded into `other` by `portuguese.selectForm`; the row it
    // lands on is the one every other plural count lands on, which is why no third
    // key exists.
    expect(usd?.[key("usd", "after-number", 1_000_000)]).toBe("dólares");
  });

  test("the slot is not an axis, and a target with no count still resolves", () => {
    // Ukrainian's two-axis contract has no counterpart here: Portuguese does not
    // inflect a noun for its position in the sentence, so the same count answers
    // the same word in either slot. A conversion target with no count at all
    // (ruling R5) lands on `other` — "em dólares", which is the plural Portuguese
    // writes there.
    expect(key("uah", "after-number", 5)).toBe(key("uah", "conversion-target", 5));
    expect(key("usd", "conversion-target")).toBe("other");
    expect(moneyPt.units.usd?.forms?.[key("usd", "conversion-target")]).toBe("dólares");
  });

  test("completion inserts a Portuguese word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 hry");
    expect(first?.text).toBe("30 hryvnias");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
    // The singular row, reached by the count rather than by the fragment.
    const [singular] = engine.complete("1 dól");
    expect(singular?.text).toBe("1 dólar");
    expect(engine.evaluate(singular?.text ?? "").formatted).toBe("$1,00");
  });

  test("round-trips the words it prints, and records that its output cannot", () => {
    // The round trip this kind actually has: what completion inserts is what a
    // user hands back, so every form of every translated currency is re-read at
    // the count that selects it. 1,5 is in the list because it is the count whose
    // row Portuguese disagrees with English about.
    for (const code of TRANSLATED) {
      for (const [count, expected] of [
        [1, "one"],
        [5, "other"],
        [1.5, "one"],
      ] as const) {
        const form = moneyPt.units[code]?.forms?.[expected];
        expect(key(code, "after-number", count), code).toBe(expected);
        const again = engine.evaluate(`${String(count).replace(".", ",")} ${form}`);
        expect(again.value?.unit, `${code} ${form}`).toBe(code);
      }
    }
    // What cannot be round-tripped, in this language or in English: `money`'s
    // format hook prints a currency *sign*, and no lexer reads one — "$30,00" comes
    // back as the bare number 30, exactly as "$30.00" does out of an English
    // engine. It is a property of the kind's own output path, not of this
    // vocabulary, which is why the ten signs above are `skipPrintable` rather than
    // repaired here.
    const printed = engine.evaluate("30 dólares").formatted;
    expect(printed).toBe("$30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
