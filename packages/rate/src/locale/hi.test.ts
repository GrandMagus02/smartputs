import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberHi from "@smartput/number/locale/hi";
// Through the package path, not "./hi": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyHi from "@smartput/rate/locale/hi";
import { money } from "../money";
import { snapshot } from "../snapshot";

/**
 * Every currency this file gives a Hindi word, and no more. The words are checked
 * by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of rates
 * has to cover the table of words, and a word added below with no rate here fails
 * loudly rather than going unchecked.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  JPY: 160,
  CHF: 0.94,
});
const locale = composeLocale(hindi, [numberHi, moneyHi]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/** Devanagari, which is every letter this vocabulary writes. */
const DEVANAGARI = /\p{Script=Devanagari}/u;

/** The key `hindi` will index a unit's `forms` with, for this count and slot. */
const key = (
  unit: string,
  slot: "bare" | "after-number" | "conversion-target",
  count?: number,
) =>
  hindi.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** Exactly the two CLDR categories `hindi.selectForm` can produce, sorted. */
const TWO_KEYS = ["one", "other"];

/** The currencies this file gives Hindi words, and the seven it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "pln", "sek", "uah"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyHi.units).flatMap(
  ([code, words]) =>
    words.aliases
      .filter((a) => DEVANAGARI.test(a))
      .map((a): [string, string] => [code, a]),
);

describe("money hi vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyHi.units).sort()).toEqual(units.sort());
    expect(moneyHi.locale).toBe("hi");
    expect(moneyHi.kind).toBe("money");
  });

  // The absence a Hindi reader notices first, asserted rather than explained away:
  // `CURRENCIES` holds the twelve codes ECB quotes plus the euro, and INR is not
  // among them — so the kind declares no unit for the rupee, and a `Vocabulary`
  // (which names units and cannot add them) has nothing to attach रुपया to. The
  // currency of the country this language is spoken in is unreachable in a Hindi
  // engine. The fix is a row in `@smartput/currency` and a quote in a snapshot,
  // both on the language-free side of the split. Wider in effect than the rouble
  // `ru.ts` records, and the same shape.
  test("there is no rupee to name, because the kind declares none", () => {
    for (const code of ["inr", "pkr", "npr", "lkr", "bdt"]) {
      expect(CURRENCIES[code], code).toBeUndefined();
      expect(moneyHi.units[code], code).toBeUndefined();
    }
    // रुपया, रुपये and the sign — the words that would be here if the kind held
    // the unit. Asserted as absent so nobody adds a word for a unit that does not
    // exist and calls the gap closed.
    expect(JSON.stringify(moneyHi)).not.toMatch(/रुपय|रुपए|₹/);
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is ratios, ISO codes and magnitude bands, so no script but ASCII may reach it.
  // Devanagari in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Hindi word", () => {
    expect(JSON.stringify(money)).not.toMatch(DEVANAGARI);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyHi.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Hindi words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyHi.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyHi.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together.
  test('currencyVocabulary("hi") is English words under a hi label', () => {
    const generated = currencyVocabulary("hi");
    expect(generated.locale).toBe("hi");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // **The Hindi-specific hazard, and the reason the drop is unconditional.** The
  // generated forms are keyed `one`/`other`. For `ar` — six CLDR categories — and
  // for `uk` — eight `${case}-${category}` keys — leaving them in place would
  // produce a table the engine can only *miss*: untidy and inert. Hindi's key set
  // is `one`/`other` **exactly**, so a generated table left behind would be
  // indexed, and the renderer would print the English word "dollars" inside a
  // Hindi sentence with nothing thrown. Hindi is the first language shipped here
  // where the wrong answer is silent rather than absent, which is why this is
  // asserted over every entry and not only over the translated ones.
  test("the English forms it generates are dropped, not carried", () => {
    for (const [code, words] of Object.entries(moneyHi.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(form, `${code} prints a Latin word for ${formKey}`).toMatch(DEVANAGARI);
      }
    }
    // "one" and "other" are the key names in *both* tables, so the tables cannot be
    // told apart by key the way `ru.test.ts` tells them apart. What separates them
    // is the script of the words, which is checked above, and the fact that the
    // generated English pair is not what survives, which is checked here.
    expect(moneyHi.units.usd?.forms).toEqual({ one: "डॉलर", other: "डॉलर" });
    expect(currencyVocabulary("hi").units.usd?.forms?.other).toBe("dollars");
  });

  test("every translated currency carries exactly the two keys, no more, no fewer", () => {
    expect(
      Object.keys(moneyHi.units)
        .filter((code) => moneyHi.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyHi.units[code]?.forms ?? {}).sort(), code).toEqual(
        TWO_KEYS,
      );
    }
  });

  test("the seven with no single-word Hindi name declare none", () => {
    // Three reasons, deliberately not collapsed into one. CAD and AUD are a head
    // noun USD already owns plus a nationality adjective ("कनाडाई डॉलर"), and a
    // unit word is one token — which is why `en` omits display forms for exactly
    // these two. SEK, NOK and CZK are worse: Hindi calls all three "क्रोना", so
    // the word has no reading at all and is left unclaimed rather than handed to
    // whichever was written first. PLN and UAH have the same two-token shape as
    // CAD/AUD — Hindi financial writing sets "पोलिश ज़्लॉटी" and "यूक्रेनी
    // रिव्निया" — and no bare Devanagari head noun in settled use, so inventing a
    // transliteration would be a word this vocabulary is guessing at.
    for (const code of UNTRANSLATED) {
      expect(moneyHi.units[code]?.forms, code).toBeUndefined();
      expect(
        added.some(([c]) => c === code),
        `${code} claims a Hindi word`,
      ).toBe(false);
      // They stay typeable, because the ISO code always was the way to reach them,
      // in either language — and it is what an Indian business page prints.
      expect(moneyHi.units[code]?.aliases, code).toContain(code);
    }
    // And the Devanagari word itself is claimed by nothing at all — unlike German,
    // where "Krone" is already `nok`'s own generated alias and the collision is
    // decided upstream. Nothing in the Latin table spells it, so leaving it out is
    // a choice this file makes rather than one it inherits.
    expect(added.some(([, alias]) => alias.startsWith("क्रोन"))).toBe(false);
  });

  // The gap invisible to every other test here: a printed form that is not a listed
  // alias still round-trips, because `hindi`'s suffix stripper recovers it — at
  // `weight: -2`. Asserting the containment is what keeps the two halves of an
  // entry, what it writes and what it reads, in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyHi.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  // The trap that would make every table test above green while the words stayed
  // unreachable: फ़ (U+095E) is a Unicode composition *exclusion*, so NFKC — which
  // `normalize()` applies before a word reaches the resolver — decomposes it into
  // फ + U+093C. A precomposed फ़्रैंक would test green here and never match what
  // a user typed.
  test("every alias and every form survives NFKC unchanged", () => {
    for (const [code, words] of Object.entries(moneyHi.units)) {
      const strings = [...words.aliases, ...Object.values(words.forms ?? {})];
      expect(
        strings.filter((s) => s.normalize("NFKC") !== s),
        code,
      ).toEqual([]);
    }
    // And the nukta-less twin beside it, which no normalization will ever produce
    // from the nukta-bearing form: फ and फ़ are different letters.
    expect(moneyHi.units.chf?.aliases).toContain("फ़्रैंक");
    expect(moneyHi.units.chf?.aliases).toContain("फ्रैंक");
  });

  test("no Hindi word is claimed by two currencies", () => {
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
    const skipPrintable = Object.keys(moneyHi.units).map((code) => `money:${code}`);
    expect(() =>
      assertLocaleContract(locale, [money, number], { skipPrintable }),
    ).not.toThrow();
    // The default counts are all integers, so they reach CLDR's `other` category
    // only from above (100, 1000) and never through a *fraction* at all — and this
    // kind *has* a `forms` table for the sweep to index, which makes the fractional
    // rows a real check here rather than the vacuous one they are next door in
    // `percent`. Both sides of Hindi's boundary are included on purpose: 0 and 0.5
    // select `one` where English would put them in `other`, and 1.5 selects
    // `other`.
    expect(() =>
      assertLocaleContract(locale, [money, number], {
        skipPrintable,
        counts: [0, 0.5, 1, 1.5, 2, 5, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Hindi money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits: Hindi marks
    // the decimal with "." and groups with ",", read out of CLDR by
    // `numberFormat: "intl"`.
    expect(engine.evaluate("30 डॉलर").formatted).toBe("$30.00");
    expect(engine.evaluate("30 यूरो").formatted).toBe("€30.00");
    expect(engine.evaluate("30 पाउंड").formatted).toBe("£30.00");
    expect(engine.evaluate("30 येन").formatted).toBe("¥30");
    expect(engine.evaluate("30 फ़्रैंक").formatted).toBe("CHF30.00");
    // The oblique plural, which is what a postposition demands of a plural noun and
    // therefore the commonest spelling inside a conversion. Listed rather than left
    // to the stripper, so it is a full-weight reading.
    expect(engine.evaluate("30 डॉलरों").formatted).toBe("$30.00");
    expect(engine.evaluate("30 पाउंडों").formatted).toBe("£30.00");
    // The variant spellings and the clipping: डालर writes with a plain ा what
    // डॉलर writes with ऑ, फ्रैंक is फ़्रैंक without its nukta, and स्टर्लिंग is
    // the adjective that says which pound — read, never printed.
    expect(engine.evaluate("30 डालर").formatted).toBe("$30.00");
    expect(engine.evaluate("30 फ्रैंक").formatted).toBe("CHF30.00");
    expect(engine.evaluate("30 स्टर्लिंग").formatted).toBe("£30.00");
    // A conversion, read through में. Both operands' words come from this file;
    // the rate comes from the snapshot.
    expect(engine.evaluate("100 डॉलर में यूरो").formatted).toBe("€90.91");
    expect(engine.evaluate("10 यूरो जोड़ 5 यूरो").formatted).toBe("€15.00");
    // A sum that lands on a fraction, which is where a currency's minor units and
    // the fractional grammatical row meet: 1.5 selects `other` — and in Hindi 0.5
    // would have selected `one`, which is the boundary English does not have.
    expect(engine.evaluate("1 डॉलर जोड़ 0.5 डॉलर").formatted).toBe("$1.50");
    expect(engine.evaluate("10 यूरो भाग 4").formatted).toBe("€2.50");
  });

  test("the Latin aliases still read in a Hindi engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30.00");
    expect(engine.evaluate("100 usd में यूरो").formatted).toBe("€90.91");
  });

  // Both rows hold the same word in every entry, and that is a fact about Hindi
  // rather than a table left half-filled: डॉलर, पाउंड, येन and फ़्रैंक are
  // consonant-final masculine loanwords whose direct plural is their singular
  // ("पाँच डॉलर", never "डॉलरें"), and यूरो ends in ो, which is not the ा that
  // becomes े. What Hindi *does* inflect is the oblique plural, and that is a form
  // the reader needs and the printer never does — so it is an alias, not a row.
  test("the two categories select one word, and the boundary is not English's", () => {
    const usd = moneyHi.units.usd?.forms;
    // Hindi's `one` is CLDR's `i = 0 or n = 1`, so 0 and every fraction below 1 are
    // singular where English puts 0 in `other`. This is the row a table ported from
    // `en` by translating two strings in place gets wrong — silently, because both
    // rows hold one word today. The assertion is here so that the day one of these
    // currencies gains a genuinely plural word it is already written.
    expect(key("usd", "after-number", 0)).toBe("one");
    expect(key("usd", "after-number", 0.5)).toBe("one");
    expect(key("usd", "after-number", 1)).toBe("one");
    expect(key("usd", "after-number", 1.5)).toBe("other");
    expect(key("usd", "after-number", 2)).toBe("other");
    expect(key("usd", "after-number", 100)).toBe("other");
    for (const count of [0, 0.5, 1, 1.5, 2, 5, 100]) {
      expect(usd?.[key("usd", "after-number", count)], `${count}`).toBe("डॉलर");
    }
    // Every translated entry holds one word across both cells, for the same
    // morphological reason.
    for (const code of TRANSLATED) {
      expect(new Set(Object.values(moneyHi.units[code]?.forms ?? {})).size, code).toBe(1);
    }
  });

  test("the slot is inert, and that is Hindi's answer rather than a gap", () => {
    // Ukrainian and Russian key `forms` on `${case}-${category}` because their
    // conversion keyword governs a case the writing system shows. Hindi's
    // postpositions govern the oblique, and for a consonant-final masculine noun
    // the oblique *singular* is the same word — so a second axis would have cost
    // two more cells per currency to record one distinction that only appears in
    // the plural, where it is a suffix the analyzer chain already strips.
    expect(key("usd", "conversion-target", 5)).toBe(key("usd", "after-number", 5));
    expect(key("usd", "bare", 5)).toBe(key("usd", "after-number", 5));
    // Ruling R5: a target with no count at all lands on the generic category.
    expect(key("usd", "conversion-target")).toBe("other");
    expect(moneyHi.units.usd?.forms?.[key("usd", "conversion-target")]).toBe("डॉलर");
    // And the oblique plural the axis would have carried is where it belongs: in
    // `aliases`, read at full weight and never printed.
    expect(moneyHi.units.usd?.aliases).toContain("डॉलरों");
    expect(Object.values(moneyHi.units.usd?.forms ?? {})).not.toContain("डॉलरों");
  });

  // **A core-level gap, recorded here because this kind is the only place `forms`
  // is visible to a user.** Completion splices the count and the selected form, and
  // the result is meant to be handed straight back to `evaluate` — which works, and
  // is asserted below through a Latin fragment that completes to the Hindi word. A
  // *Devanagari* fragment reaches nothing at all, and the cause is one character
  // class in `complete/fragment.ts`: `FRAGMENT` is `/[\p{L}][\p{L}\p{N}]*$/u`, and
  // an abugida writes its vowels as combining marks (`\p{M}`), so "30 डॉल" yields
  // the fragment "ल" — the tail of the word after the last mark — which prefixes
  // nothing. This is the exact mirror of the `lex.ts` bug `@smartput/core/locale/hi`
  // fixed by letting a `\p{M}` *continue* a letter run, and the fix has the same
  // shape (`/[\p{L}][\p{L}\p{M}\p{N}]*$/u`, verified against these inputs). It is a
  // change to core's language-free half — it unblocks every Indic, Thai, Khmer and
  // Ethiopic script at once — so it is reported rather than worked around, and
  // nothing a `Vocabulary` can reach would close it. Do not "fix" this by adding
  // truncated aliases.
  test("completion cannot see a Devanagari fragment, and that is core's to fix", () => {
    expect(engine.complete("30 डॉल")).toEqual([]);
    expect(engine.complete("30 डॉलर")).toEqual([]);
    // The vocabulary half is right, which is what localizes the gap: a Latin
    // fragment completes through the same index and splices this file's Hindi word,
    // and the spliced text evaluates.
    const [first] = engine.complete("30 doll");
    expect(first?.text).toBe("30 डॉलर");
    expect(first?.unit).toBe("usd");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("usd");
  });

  test("round-trips its own output", () => {
    // What can round-trip here is the *word* path, not the symbol path: `money`'s
    // format hook prints "$30.00", and a currency sign is an alias of nothing in
    // any language, so the printed string is display and not input. The strings
    // below are what a user types and what completion inserts.
    for (const input of [
      "1 डॉलर",
      "0.5 डॉलर",
      "1.5 डॉलर",
      "30 डॉलरों",
      "30 यूरो",
      "30 फ़्रैंक",
      "100 डॉलर में यूरो",
    ]) {
      const first = engine.evaluate(input);
      const unit = first.value?.unit as string;
      const word = moneyHi.units[unit]?.forms?.[key(unit, "after-number", 30)] as string;
      const again = engine.evaluate(`30 ${word}`);
      expect(again.value?.unit, input).toBe(unit);
    }
    // And the symbol path, pinned rather than left to be rediscovered — it does not
    // throw, which is worse than throwing and is why it is written down: `lex` skips
    // "$" as an unrecognized character, so "$30.00" comes back as the bare *number*
    // 30 with the currency silently gone. That is core's lexer, identical under
    // `en`, and nothing a vocabulary can reach; the word path above is the one that
    // round-trips.
    const printed = engine.evaluate("30 डॉलर").formatted;
    expect(printed).toBe("$30.00");
    expect(engine.evaluate(printed).value?.kind).toBe("number");
  });

  // Hindi's grouping, pinned in the kind where an Indian reader meets it first: a
  // crore is written 1,00,00,000 on every page in the country, and this engine
  // writes 10,000,000. `NumberFormatSpec` carries a separator and no grouping
  // *rule*, so no language can fix it from its own file — see
  // `@smartput/core/locale/hi`, which reports the shape the fix would take. The
  // round trip is unaffected, because the reader strips every separator wherever
  // it falls.
  test("amounts group by threes where Hindi groups by lakh and crore", () => {
    expect(engine.evaluate("100000 डॉलर").formatted).toBe("$100,000.00");
    expect(new Intl.NumberFormat("hi").format(100000)).toBe("1,00,000");
    expect(engine.evaluate("10000000 डॉलर").formatted).toBe("$10,000,000.00");
    expect(new Intl.NumberFormat("hi").format(10000000)).toBe("1,00,00,000");
    // Read back all the same: "1,00,000 डॉलर" is a genuinely Indian-grouped
    // amount and the reader is grouping-agnostic by construction.
    expect(engine.evaluate("1,00,000 डॉलर").value?.canonical.toString()).toBe(
      engine.evaluate("100000 डॉलर").value?.canonical.toString(),
    );
  });
});
