import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberKo from "@smartput/number/locale/ko";
// Through the package path, not "./ko": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyKo from "@smartput/rate/locale/ko";
import { money } from "../money";
import { snapshot } from "../snapshot";
import moneyEn from "./en";

/**
 * Every currency this file gives a Korean word, and no more. The words are checked
 * by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of rates
 * has to cover the table of words, and a word added below with no rate here fails
 * loudly rather than going unchecked.
 *
 * It has `czk` where the Japanese file does not: Korean transcribes the Czech
 * koruna as 코루나, one word, where ICU cut Japanese's コルナ in two.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  UAH: 45,
  PLN: 4.3,
  JPY: 160,
  CHF: 0.94,
  SEK: 11,
  NOK: 12,
  CZK: 25,
});

const locale = composeLocale(korean, [numberKo, moneyKo]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/**
 * Hangul, and nothing else. Where the Japanese regex in the sibling file can only
 * claim "a CJK word leaked into the language-free half" — a kanji is shared with
 * Chinese — a Hangul test is exact: the script writes Korean and no other living
 * language. It is also what separates this file's layer from the generated one,
 * since every alias `CURRENCIES` ships is ASCII.
 */
const HANGUL = /\p{Script=Hangul}/u;

/** The key `korean` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  korean.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The currencies this file gives Korean words, and the two it does not. */
const TRANSLATED = ["chf", "czk", "eur", "gbp", "jpy", "nok", "pln", "sek", "uah", "usd"];
const UNTRANSLATED = ["aud", "cad"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyKo.units).flatMap(
  ([code, words]) =>
    words.aliases.filter((a) => HANGUL.test(a)).map((a): [string, string] => [code, a]),
);

describe("money ko vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyKo.units).sort()).toEqual(units.sort());
    expect(moneyKo.locale).toBe("ko");
    expect(moneyKo.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Korean word", () => {
    expect(JSON.stringify(money)).not.toMatch(HANGUL);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyKo.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Korean words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyKo.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyKo.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together.
  test('currencyVocabulary("ko") is English words under a ko label', () => {
    const generated = currencyVocabulary("ko");
    expect(generated.locale).toBe("ko");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // Dropping the generated `forms` is load-bearing under `ko` in a way it was not
  // under `uk`, and this is the assertion that separates the two cases.
  // `ukrainian.selectForm` returns neither `one` nor `other`, so an English table
  // left in place would merely have been unreachable. `korean.selectForm` returns
  // `"other"` for every count and every slot — the *same* key the generated table
  // declares — so keeping it would have had a Korean engine completing 「30 dollars」.
  test("the English forms it generates are dropped, and here that matters", () => {
    expect(key("usd", "after-number", 5)).toBe("other");
    expect(currencyVocabulary("ko").units.usd?.forms?.other).toBe("dollars");
    for (const [code, words] of Object.entries(moneyKo.units)) {
      expect(Object.keys(words.forms ?? {}), code).not.toContain("one");
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints a Latin word`).toMatch(HANGUL);
      }
    }
  });

  test("every translated currency carries exactly the one key ko can ask for", () => {
    expect(
      Object.keys(moneyKo.units)
        .filter((code) => moneyKo.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyKo.units[code]?.forms ?? {}), code).toEqual(["other"]);
    }
    // The closed key set, read off `selectForm` rather than restated: the rows that
    // move `en` and `uk` — the 1/2 boundary, the Slavic 5-and-up row, a fraction,
    // and the count-free conversion target of ruling R5 — all land on the single
    // key above.
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key("usd", "after-number", c),
            key("usd", "conversion-target", c),
          ]),
          key("usd", "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(["other"]);
  });

  test("the two currencies with no Korean word declare none", () => {
    // And the reason is neither of Japanese's. 캐나다 달러 and 호주 달러 are not
    // words ICU dislikes — Korean needs no segmenter at all — they are *two words*
    // each, and the alias index is keyed by one. This is `en`'s and `uk`'s reason
    // ("Canadian dollar", "канадський долар"), reached by a language that can name
    // 뉴욕 where Japanese cannot.
    for (const code of UNTRANSLATED) {
      expect(moneyKo.units[code]?.forms, code).toBeUndefined();
      expect(
        moneyKo.units[code]?.aliases.some((a) => HANGUL.test(a)),
        `${code} claims a Korean word`,
      ).toBe(false);
      // It stays typeable, because the ISO code always was the way to reach it, in
      // either language.
      expect(moneyKo.units[code]?.aliases, code).toContain(code);
    }
    // And the currency a Korean user would type first is not in the kind at all, so
    // 원 names no unit and this file may not invent one. The day `CURRENCIES` grows
    // a `krw` row, this assertion fails and the omission gets revisited.
    expect(Object.keys(CURRENCIES)).not.toContain("krw");
    expect(() => engine.evaluate("30원")).toThrow();
  });

  // The gap invisible to every other test here: a printed form that is not a listed
  // alias would still round-trip in Ukrainian, because its penalised suffix
  // stripper recovers one. Korean's only analyzer besides `identity()` strips
  // *particles*, and a currency name is not a particle — so a form missing from
  // `aliases` simply does not parse, and this assertion is the only thing standing
  // between that and a completion nobody can use.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyKo.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Korean word is claimed by two currencies", () => {
    // What `assertLocaleContract` cannot catch on this kind, checked by hand: a word
    // claimed by two units of one kind has no reading, because no context the engine
    // has can separate them. The near-miss this guards is the three krona
    // currencies — 크로나, 크로네 and 코루나 are one and two syllables apart — which
    // Ukrainian could not tell apart at all.
    const owner = new Map<string, string>();
    for (const [code, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two currencies`).toBeUndefined();
      owner.set(alias, code);
    }
  });

  test("satisfies the locale contract, waiving the signs no language reads", () => {
    // `skipPrintable` is what makes this runnable at all, and it is a fact about the
    // currency table rather than about Korean: `money` prints through
    // `symbolOf(code)`, and a currency sign ("$", "₴", "zł") is readable back in no
    // language — `lex` does not build a word token out of one. Every currency needs
    // the waiver, so it is derived rather than listed, and the count is pinned so a
    // shrinking table cannot make this vacuous.
    const skipPrintable = Object.keys(moneyKo.units).map((code) => `money:${code}`);
    expect(skipPrintable.length).toBe(Object.keys(CURRENCIES).length);
    const opts = { skipPrintable };
    expect(() => assertLocaleContract(locale, [number, money], opts)).not.toThrow();
    // The default counts are all integers and never reach a fractional reading.
    // Under `ko` a fraction cannot select a different key — there is only one — so
    // this call confirms the shape rather than a new row, and running the same call
    // shape every sibling vocabulary runs keeps the row comparable.
    expect(() =>
      assertLocaleContract(locale, [number, money], {
        ...opts,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("every word it adds resolves back to its own currency", () => {
    for (const [code, alias] of added) {
      expect(engine.evaluate(`30${alias}`).value?.unit, alias).toBe(code);
    }
  });

  test("an engine built from it reads and writes Korean money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits, and CLDR gives
    // `ko` the same pair as `en`: "." for the decimal, "," for the group. The unit
    // word is written tight against the number on the way *in*, which is what
    // `korean.renderQuantity` also does on the way out.
    expect(engine.evaluate("30달러").formatted).toBe("$30.00");
    expect(engine.evaluate("30유로").formatted).toBe("€30.00");
    // JPY has no minor units, which is why 엔 prints without a fraction while every
    // other row here carries two digits. 엔화 is the headline word for the same
    // currency and reads without being printed.
    expect(engine.evaluate("30엔").formatted).toBe("¥30");
    expect(engine.evaluate("30엔화").formatted).toBe("¥30");
    // The three krona currencies Korean tells apart where Ukrainian cannot, and
    // where Japanese loses the third to its segmenter.
    expect(engine.evaluate("30크로나").value?.unit).toBe("sek");
    expect(engine.evaluate("30크로네").value?.unit).toBe("nok");
    expect(engine.evaluate("30코루나").value?.unit).toBe("czk");
    // A conversion. 를/을 is Korean's `in` keyword — the accusative particle on the
    // *left* operand, which is where an infix operator goes — and 으로 is the
    // directional particle on the target, recovered by `particleStripper`.
    expect(engine.evaluate("100달러 를 엔").formatted).toBe("¥14,545");
    expect(engine.evaluate("1000엔 을 달러").formatted).toBe("$6.88");
    expect(engine.evaluate("100 usd를 엔으로").formatted).toBe("¥14,545");
    // A sum, and a sum that lands on a fraction.
    expect(engine.evaluate("10엔 더하기 5엔").formatted).toBe("¥15");
    expect(engine.evaluate("5달러 나누기 2").formatted).toBe("$2.50");
  });

  test("the Latin aliases still read in a Korean engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30.00");
    expect(engine.evaluate("100 usd를 엔").formatted).toBe("¥14,545");
  });

  // The one sentence a Korean writer would actually type, and the one thing this
  // vocabulary cannot make work — recorded here rather than left to be rediscovered.
  // Both particles are bound, so 「100달러를」 is a single token: the analyzer
  // resolves it to `usd` perfectly well, and the parser then has no infix operator
  // between the two operands. It is a core-level gap (a lexer that can split a
  // clitic off a Hangul token), reported by `core/locale/ko.ts` and repeated here as
  // an assertion so it fails the day it is fixed.
  test("records the fully native conversion that still cannot parse", () => {
    expect(engine.evaluate("100달러를").formatted).toBe("$100.00");
    expect(() => engine.evaluate("100달러를 엔으로")).toThrow();
    // Both workarounds, either of which a real input plausibly takes: a Latin
    // source, or the source particle spaced off.
    expect(engine.evaluate("100 usd를 엔으로").value?.unit).toBe("jpy");
    expect(engine.evaluate("100달러 를 엔으로").value?.unit).toBe("jpy");
    // 의, the genitive, is deliberately not among the stripped particles — it marks
    // a possessor and never a measured quantity — so 「50달러의」 is unknown rather
    // than silently read as 50 dollars.
    expect(() => engine.evaluate("50달러의 20%")).toThrow();
  });

  test("the plural boundary moves nothing, in either slot", () => {
    // The three rows a `one`/`other` table exists for, read off the table rather
    // than through the formatter — `money` prints "$1.50" whatever the grammar says,
    // so this is the only place the words are visible. In Korean all three are one
    // word, and the conversion target is that word again: there is no case axis for
    // the slot to select on, because the case is the particle and the particle is
    // never printed.
    const usd = moneyKo.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("달러");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("달러");
    expect(usd?.[key("usd", "after-number", 5)]).toBe("달러");
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("달러");
    expect(usd?.[key("usd", "conversion-target", 5)]).toBe("달러");
    expect(usd?.[key("usd", "conversion-target")]).toBe("달러");
  });

  test("completion inserts a Korean word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the format
    // hook prints a symbol: completion splices the count and the selected form, and
    // the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 흐리");
    expect(first?.text).toBe("30 흐리우냐");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
  });

  test("round-trips its own output, by the only route this kind has", () => {
    // What this kind prints carries a currency *sign*, and `lex` builds no word
    // token out of one — so "$30.00" reads back as the bare number 30, in every
    // language. Asserted against an English engine beside the Korean one, so the gap
    // is attributed where it belongs: to `money`'s format hook, not to this
    // translation.
    const englishEngine = createEngine({
      locales: [composeLocale(english, [moneyEn])],
      kinds: [number, money],
      rates,
    });
    for (const e of [engine, englishEngine]) {
      const printed = e.evaluate("30 usd").formatted;
      expect(printed).toBe("$30.00");
      expect(e.evaluate(printed).value?.kind).toBe("number");
    }
    // The round trip that *is* available, and the one a user meets: the word this
    // vocabulary prints — through completion, and through `Printer`'s spelled path —
    // is a word it reads, and the amount survives the trip out and back through a
    // second currency.
    for (const [code, word] of Object.entries(moneyKo.units).flatMap(([code, words]) =>
      Object.values(words.forms ?? {}).map((w): [string, string] => [code, w]),
    )) {
      const first = engine.evaluate(`30${word}`);
      expect(first.value?.unit, word).toBe(code);
      const again = engine.evaluate(`30${word} 를 엔 를 달러`);
      expect(again.value?.unit, word).toBe("usd");
    }
    const there = engine.evaluate("100달러 를 엔");
    const back = engine.evaluate("100달러 를 엔 를 달러");
    expect(back.value?.unit).toBe("usd");
    expect(back.formatted).toBe("$100.00");
    expect(there.value?.canonical.toString()).toBe(
      engine.evaluate("100달러").value?.canonical.toString(),
    );
  });
});
