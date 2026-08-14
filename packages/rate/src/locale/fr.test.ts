import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberFr from "@smartput/number/locale/fr";
// Through the package path, not "./fr": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyFr from "@smartput/rate/locale/fr";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a French word, and no more. The words are
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
const locale = composeLocale(french, [numberFr, moneyFr]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** Anything only French would write — the accented vowels and the cedilla. */
const FRENCH = /[àâçéèêëîïôùûüÿœ]/i;

/** The group separator CLDR hands French: U+202F NARROW NO-BREAK SPACE. */
const NNBSP = "\u202f";

/** The key `french` will index a unit's `forms` with, for this count and slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  french.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The currencies this file gives French words, and the five it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "pln", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "sek"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyFr.units).flatMap(
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
 * This is not a French problem and not a `forms` problem: a currency sign is
 * never read through the alias index in any language ("30 €" lexes as a bare
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

describe("money fr vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyFr.units).sort()).toEqual(units.sort());
    expect(moneyFr.locale).toBe("fr");
    expect(moneyFr.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so nothing a language wrote
  // may reach it. French shares the Latin script with the ISO codes, so the grep
  // is for what only French writes — the accents — plus the words this file adds.
  test("the kind itself carries no French word", () => {
    const source = JSON.stringify(money);
    expect(source).not.toMatch(FRENCH);
    expect(source).not.toMatch(/livre|yens|zlotys|hryvnias|couronne/i);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyFr.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the French words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one. For French this
    // carries more than it does for Spanish — four of the seven French nouns
    // *are* the generated English ones.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyFr.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyFr.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says
  // so out loud, so that the day `CURRENCIES` grows localized names, the file
  // above stops being right and this stops being green together.
  test('currencyVocabulary("fr") is English words under an fr label', () => {
    const generated = currencyVocabulary("fr");
    expect(generated.locale).toBe("fr");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    // The row that proves it: English leaves the yen invariable, and French does
    // not.
    expect(generated.units.jpy?.forms).toEqual({ one: "yen", other: "yen" });
  });

  // Where Ukrainian could leave the generated `one`/`other` rows in place
  // harmlessly — `ukrainian.selectForm` returns neither key, so they were merely
  // unreachable — French returns exactly those two. The generated table *fits*
  // here, so a row left standing would print an English word out of a French
  // engine, and this is the assertion that says none did.
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyFr.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints an English-only word`).not.toMatch(
          /pound|kron|krone|koruna/i,
        );
        expect(words.aliases, `${code} prints a word it cannot read`).toContain(form);
      }
    }
    // The five with no French word fall back to the symbol, which is only
    // possible because the generated rows were dropped: "kronor" would otherwise
    // have printed for `sek`.
    for (const code of UNTRANSLATED) {
      expect(moneyFr.units[code]?.forms, code).toBeUndefined();
    }
  });

  // Four of the seven French tables are spelled exactly as the English ones they
  // replace, and the honest thing is to say so rather than to claim a distinction
  // French does not make. What separates them is not the string but the *count*
  // that selects it — see the boundary test below — and, for three currencies, an
  // alias English never had.
  test("says which rows are French by their words and which by their boundary", () => {
    // Identical strings, re-declared rather than inherited: the generated rows are
    // dropped wholesale, so a row that survived by accident is a row nobody
    // checked.
    for (const code of ["eur", "usd", "chf"]) {
      expect(moneyFr.units[code]?.forms, code).toEqual(
        currencyVocabulary("fr").units[code]?.forms ?? {},
      );
      expect(
        added.filter(([c]) => c === code),
        code,
      ).toEqual([]);
    }
    // And the three where French genuinely declines a noun English leaves alone
    // or never listed: the yen is invariable in English, and neither the zloty's
    // nor the hryvnia's plural is an alias in the generated table.
    expect(moneyFr.units.jpy?.forms).toEqual({ one: "yen", other: "yens" });
    expect(added.map(([, alias]) => alias).sort()).toEqual([
      "hryvnias",
      "livre",
      "livres",
      "yens",
      "zlotys",
    ]);
  });

  test("every translated currency carries exactly the two keys fr can ask for", () => {
    expect(
      Object.keys(moneyFr.units)
        .filter((code) => moneyFr.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      // No more and no fewer (rule 6). `french.selectForm` folds CLDR's `many`
      // into `other`, so a third row would be a word no count could select.
      expect(Object.keys(moneyFr.units[code]?.forms ?? {}).sort(), code).toEqual([
        "one",
        "other",
      ]);
    }
  });

  test("the five with no single-word French name declare none", () => {
    // Two reasons, deliberately not collapsed into one. CAD and AUD are a
    // qualifier plus the head noun USD already owns ("dollar canadien"), and a
    // unit word is one token — which is why `en` omits display forms for exactly
    // these two. SEK, NOK and CZK are worse: French calls all three "couronne",
    // so the word has no reading at all and is left unclaimed rather than handed
    // to whichever was written first.
    for (const code of UNTRANSLATED) {
      expect(
        added.filter(([c]) => c === code),
        code,
      ).toEqual([]);
      // They stay typeable, because the ISO code always was the way to reach
      // them, in either language.
      expect(moneyFr.units[code]?.aliases, code).toContain(code);
    }
    // And the word itself is claimed by nobody, which is the point: three units
    // of one kind cannot share a reading.
    for (const words of Object.values(moneyFr.units)) {
      expect(words.aliases).not.toContain("couronne");
      expect(words.aliases).not.toContain("couronnes");
    }
    // "sterling" is refused for a third reason again — French uses it only as the
    // invariable adjective of "livre sterling", never as the noun on its own, so
    // claiming it would assert French says something it does not. `en` next door
    // does claim it, which is what makes this a decision rather than an omission.
    for (const words of Object.values(moneyFr.units)) {
      expect(words.aliases).not.toContain("sterling");
    }
  });

  // Unlike the Spanish file, which is half made of accent-free variants, this is
  // an observation: not one French currency noun carries an accent, so there is
  // no second spelling to declare beside a first.
  test("no word it adds carries a written accent", () => {
    for (const [code, alias] of added) {
      expect(alias, `${code} adds an accented spelling`).not.toMatch(FRENCH);
    }
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias still round-trips, because the French suffix stripper recovers
  // it — at `weight: -2`. Asserting the containment is what keeps the two halves
  // of an entry, what it writes and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyFr.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no French word is claimed by two currencies", () => {
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
    // The default counts are all integers, so the fractional row is never reached
    // at all — and a fractional amount of money is the ordinary case rather than
    // an edge one. In French that row is the *singular* one, so adding 1,5 is
    // what proves "1,5 dollar" selects a row that exists, and it is the row a
    // table ported from the generated English one would have got wrong.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        ...contractOptions,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency
    // symbol, minor units — so what the language decides here is the digits:
    // French marks the decimal with "," and groups with U+202F. The sign stays in
    // front, which is not French convention ("30,00 €") and is not this file's to
    // change: the hook prints `symbolOf(code)` before the number in every
    // language.
    expect(engine.evaluate("30 dollars").formatted).toBe("$30,00");
    expect(engine.evaluate("5 livres").formatted).toBe("£5,00");
    expect(engine.evaluate("100 yens").formatted).toBe("¥100");
    expect(engine.evaluate("5 francs").formatted).toBe("CHF5,00");
    expect(engine.evaluate("5 zlotys").formatted).toBe("zł5,00");
    expect(engine.evaluate("30 hryvnias").formatted).toBe("₴30,00");
    // A conversion through each of French's two `in` keywords, and a grouped
    // result: U+202F between the thousands, "," before the centimes. Pinned by
    // codepoint, because a plain space in a fixture would pass against an
    // implementation that had hardcoded Ukrainian's U+00A0.
    expect(engine.evaluate("100 dollars en hryvnias").formatted).toBe(`₴4${NNBSP}090,91`);
    expect(engine.evaluate("5 livres vers euros").formatted).toBe("€5,94");
    // A sum that lands on a fraction, and a division that does — both stay in the
    // currency they were typed in. Note the right operand of the sum: "0,5
    // dollar" is singular in French, which is the spelling a user would type and
    // the row `selectForm` selects.
    expect(engine.evaluate("1 dollar + 0,5 dollar").formatted).toBe("$1,50");
    expect(engine.evaluate("10 dollars divisé par 4").formatted).toBe("$2,50");
  });

  test("the Latin aliases still read in a French engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30,00");
    expect(engine.evaluate("30 dollar").formatted).toBe("$30,00");
    expect(engine.evaluate("100 usd en hryvnias").formatted).toBe(`₴4${NNBSP}090,91`);
  });

  // The row that is the whole point of a French vocabulary for this kind, and the
  // one place its tables differ from the English ones by more than an alias:
  // French is singular below two, so 0 and every fraction under 2 take the same
  // word 1 does. A table ported from `en` by renaming columns prints a plural on
  // all three.
  test("the count decides the row, and French is singular below two", () => {
    // Read off the table rather than through the formatter — `money` prints
    // "$1,50" whatever the grammar says, so this is the only place the words are
    // visible.
    const usd = moneyFr.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("dollar");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("dollars");
    // Zero is singular in French — "zéro dollar" — where English and Spanish both
    // call it plural.
    expect(usd?.[key("usd", "after-number", 0)]).toBe("dollar");
    // And so is every fraction below two, which is the ordinary case for money.
    expect(usd?.[key("usd", "after-number", 0.5)]).toBe("dollar");
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("dollar");
    expect(usd?.[key("usd", "after-number", 1.9)]).toBe("dollar");
    // At two the plural starts and never stops: 2,5 is plural where 1,5 was not.
    expect(usd?.[key("usd", "after-number", 2.5)]).toBe("dollars");
    expect(usd?.[key("usd", "after-number", 21)]).toBe("dollars");
    // The declining borrowed noun, which is where a copy of the generated English
    // table would have printed the invariable "yen" for a hundred of them.
    expect(moneyFr.units.jpy?.forms?.[key("jpy", "after-number", 100)]).toBe("yens");
    expect(moneyFr.units.jpy?.forms?.[key("jpy", "after-number", 1)]).toBe("yen");
    // A million is CLDR's `many` category, folded into `other` by
    // `french.selectForm`; the row it lands on is the one every other plural count
    // lands on, which is why no third key exists.
    expect(usd?.[key("usd", "after-number", 1_000_000)]).toBe("dollars");
  });

  test("the slot is not an axis, and a target with no count still resolves", () => {
    // Ukrainian's two-axis contract has no counterpart here: French does not
    // inflect a noun for its position in the sentence, so the same count answers
    // the same word in either slot. A conversion target with no count at all
    // (ruling R5) lands on `other` — "en dollars", which is the plural French
    // writes there.
    expect(key("uah", "after-number", 5)).toBe(key("uah", "conversion-target", 5));
    expect(key("usd", "conversion-target")).toBe("other");
    expect(moneyFr.units.usd?.forms?.[key("usd", "conversion-target")]).toBe("dollars");
  });

  test("completion inserts a French word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 hry");
    expect(first?.text).toBe("30 hryvnias");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
    // The singular row, reached by the count rather than by the fragment.
    const [singular] = engine.complete("1 liv");
    expect(singular?.text).toBe("1 livre");
    expect(engine.evaluate(singular?.text ?? "").formatted).toBe("£1,00");
    // And the two rows only French puts on this side of the boundary. A fraction
    // under two completes to the *singular*, and so does zero — an English or
    // Spanish engine writes "1.5 dollars" and "0 dollars" here.
    expect(engine.complete("1,5 doll")[0]?.text).toBe("1,5 dollar");
    expect(engine.complete("0 doll")[0]?.text).toBe("0 dollar");
    expect(engine.complete("2 doll")[0]?.text).toBe("2 dollars");
  });

  test("round-trips the words it prints, and records that its output cannot", () => {
    // The round trip this kind actually has: what completion inserts is what a
    // user hands back, so every form of every translated currency is re-read at
    // the count that selects it. The fractional count is the French row — 1,5
    // selects `one`, not `other` — and it is written with the comma this locale
    // reads.
    for (const code of TRANSLATED) {
      for (const [count, expected] of [
        [1, "one"],
        [5, "other"],
        [1.5, "one"],
      ] as const) {
        const form = moneyFr.units[code]?.forms?.[expected];
        expect(key(code, "after-number", count), `${code} ${count}`).toBe(expected);
        const again = engine.evaluate(`${String(count).replace(".", ",")} ${form}`);
        expect(again.value?.unit, `${code} ${form}`).toBe(code);
      }
    }
    // What cannot be round-tripped, in this language or in English: `money`'s
    // format hook prints a currency *sign*, and no lexer reads one — "$30,00"
    // comes back as the bare number 30, exactly as "$30.00" does out of an
    // English engine. It is a property of the kind's own output path, not of this
    // vocabulary, which is why the ten signs above are `skipPrintable` rather than
    // repaired here.
    const printed = engine.evaluate("30 dollars").formatted;
    expect(printed).toBe("$30,00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });
});
