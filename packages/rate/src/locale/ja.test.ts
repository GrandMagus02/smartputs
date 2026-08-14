import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberJa from "@smartput/number/locale/ja";
// Through the package path, not "./ja": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyJa from "@smartput/rate/locale/ja";
import { money } from "../money";
import { snapshot } from "../snapshot";
import moneyEn from "./en";

/**
 * Every currency this file gives a Japanese word, and no more. The words are
 * checked by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of rates
 * has to cover the table of words, and a word added below with no rate here fails
 * loudly rather than going unchecked.
 *
 * It is two rows longer than the Ukrainian file's, because `cad` and `aud` have
 * Japanese names ICU keeps whole where their Ukrainian names are two tokens.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  UAH: 45,
  PLN: 4.3,
  JPY: 160,
  CHF: 0.94,
  CAD: 1.5,
  AUD: 1.6,
  SEK: 11,
  NOK: 12,
});

const locale = composeLocale(japanese, [numberJa, moneyJa]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/**
 * Anything only Japanese would write: hiragana, katakana and the two CJK
 * ideograph blocks a modern Japanese text draws on. A kanji is shared with
 * Chinese, so what this catches is "a CJK word leaked into the language-free
 * half" rather than "a *Japanese* word did" — the only claim a script test can
 * honestly make. It is also what separates this file's layer from the generated
 * one, since every alias `CURRENCIES` ships is ASCII.
 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/u;

/** The key `japanese` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  japanese.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The currencies this file gives Japanese words, and the one it does not. */
const TRANSLATED = [
  "aud",
  "cad",
  "chf",
  "eur",
  "gbp",
  "jpy",
  "nok",
  "pln",
  "sek",
  "uah",
  "usd",
];
const UNTRANSLATED = ["czk"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyJa.units).flatMap(
  ([code, words]) =>
    words.aliases.filter((a) => JAPANESE.test(a)).map((a): [string, string] => [code, a]),
);

describe("money ja vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyJa.units).sort()).toEqual(units.sort());
    expect(moneyJa.locale).toBe("ja");
    expect(moneyJa.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios, ISO codes and magnitude bands, so no script but ASCII may
  // reach it. Kana or kanji in the descriptor would mean a translation had leaked
  // into the half of the package that is supposed to be language-free.
  test("the kind itself carries no Japanese word", () => {
    expect(JSON.stringify(money)).not.toMatch(JAPANESE);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyJa.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Japanese words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyJa.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyJa.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says
  // so out loud, so that the day `CURRENCIES` grows localized names, the file
  // above stops being right and this stops being green together.
  test('currencyVocabulary("ja") is English words under a ja label', () => {
    const generated = currencyVocabulary("ja");
    expect(generated.locale).toBe("ja");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // Dropping the generated `forms` is load-bearing under `ja` in a way it was not
  // under `uk`, and this is the assertion that separates the two cases.
  // `ukrainian.selectForm` returns neither `one` nor `other`, so an English table
  // left in place would merely have been unreachable. `japanese.selectForm`
  // returns `"other"` for every count and every slot — the *same* key the
  // generated table declares — so keeping it would have had a Japanese engine
  // completing 「30 dollars」.
  test("the English forms it generates are dropped, and here that matters", () => {
    expect(key("usd", "after-number", 5)).toBe("other");
    expect(currencyVocabulary("ja").units.usd?.forms?.other).toBe("dollars");
    for (const [code, words] of Object.entries(moneyJa.units)) {
      expect(Object.keys(words.forms ?? {}), code).not.toContain("one");
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints a Latin word`).toMatch(JAPANESE);
      }
    }
  });

  test("every translated currency carries exactly the one key ja can ask for", () => {
    expect(
      Object.keys(moneyJa.units)
        .filter((code) => moneyJa.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyJa.units[code]?.forms ?? {}), code).toEqual(["other"]);
    }
    // The closed key set, read off `selectForm` rather than restated: the rows
    // that move `en` and `uk` — the 1/2 boundary, the Slavic 5-and-up row, a
    // fraction, and the count-free conversion target of ruling R5 — all land on
    // the single key above.
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

  test("the one currency with no Japanese word declares none", () => {
    // And the reason is neither of Ukrainian's. コルナ is not a two-token
    // qualifier and it is not shared with a sibling — Japanese transcribes all
    // three krona currencies differently — it is a word ICU cuts into コル | ナ,
    // so an alias for it could never be produced as a lookup key.
    for (const code of UNTRANSLATED) {
      expect(moneyJa.units[code]?.forms, code).toBeUndefined();
      expect(
        moneyJa.units[code]?.aliases.some((a) => JAPANESE.test(a)),
        `${code} claims a Japanese word`,
      ).toBe(false);
      // It stays typeable, because the ISO code always was the way to reach it,
      // in either language.
      expect(moneyJa.units[code]?.aliases, code).toContain(code);
    }
    expect(japanese.segment?.("コルナ")).toEqual(["コル", "ナ"]);
    // Its two siblings survive whole, which is what makes the omission a
    // segmenter fact rather than a decision about Scandinavian currencies.
    expect(japanese.segment?.("クローナ")).toEqual(["クローナ"]);
    expect(japanese.segment?.("クローネ")).toEqual(["クローネ"]);
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias would still round-trip in Ukrainian, because its penalised
  // suffix stripper recovers one. Japanese has no stripper at all —
  // `japanese.analyze` is `[identity()]`, because there are no suffixes to strip
  // — so a form missing from `aliases` simply does not parse, and this assertion
  // is the only thing standing between that and a completion nobody can use.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyJa.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Japanese word is claimed by two currencies", () => {
    // What `assertLocaleContract` cannot catch on this kind, checked by hand: a
    // word claimed by two units of one kind has no reading, because no context
    // the engine has can separate them. The near-miss this guards is real —
    // カナダドル, オーストラリアドル and ドル are three entries ending in the same
    // two characters, and only the segmenter keeping the compounds whole keeps
    // them three words rather than one.
    const owner = new Map<string, string>();
    for (const [code, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two currencies`).toBeUndefined();
      owner.set(alias, code);
    }
  });

  test("satisfies the locale contract, waiving the signs no language reads", () => {
    // `skipPrintable` is what makes this runnable at all, and it is a fact about
    // the currency table rather than about Japanese: `money` prints through
    // `symbolOf(code)`, and a currency sign ("$", "₴", "zł") is readable back in
    // no language — `lex` does not build a word token out of one. Every currency
    // needs the waiver, so it is derived rather than listed, and the count is
    // pinned so a shrinking table cannot make this vacuous.
    const skipPrintable = Object.keys(moneyJa.units).map((code) => `money:${code}`);
    expect(skipPrintable.length).toBe(Object.keys(CURRENCIES).length);
    const opts = { skipPrintable };
    expect(() => assertLocaleContract(locale, [number, money], opts)).not.toThrow();
    // The default counts are all integers and never reach a fractional reading.
    // Under `ja` a fraction cannot select a different key — there is only one — so
    // this call confirms the shape rather than a new row, and running the same
    // call shape every sibling vocabulary runs keeps the row comparable.
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

  test("an engine built from it reads and writes Japanese money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency
    // symbol, minor units — so what the language decides here is the digits, and
    // CLDR gives `ja` the same pair as `en`: "." for the decimal, "," for the
    // group. The unit word is written tight against the number on the way *in*,
    // which is what `japanese.segment` is for.
    expect(engine.evaluate("30ドル").formatted).toBe("$30.00");
    expect(engine.evaluate("30ユーロ").formatted).toBe("€30.00");
    expect(engine.evaluate("30米ドル").formatted).toBe("$30.00");
    // JPY has no minor units, which is why 円 prints without a fraction while
    // every other row here carries two digits.
    expect(engine.evaluate("30円").formatted).toBe("¥30");
    // The two `en` and `uk` both had to leave untranslated, reachable here.
    expect(engine.evaluate("30カナダドル").formatted).toBe("CA$30.00");
    expect(engine.evaluate("30オーストラリアドル").formatted).toBe("A$30.00");
    // The two krona currencies Japanese tells apart where Ukrainian cannot.
    expect(engine.evaluate("30クローナ").value?.unit).toBe("sek");
    expect(engine.evaluate("30クローネ").value?.unit).toBe("nok");
    // A conversion, through を — the Japanese `in` keyword, and a postposition on
    // the *left* operand, which is why it lands where an infix operator goes.
    expect(engine.evaluate("100ドルを円").formatted).toBe("¥14,545");
    expect(engine.evaluate("1000円をドル").formatted).toBe("$6.88");
    // A sum, and a sum that lands on a fraction.
    expect(engine.evaluate("10円 足す 5円").formatted).toBe("¥15");
    expect(engine.evaluate("5ドル 割る 2").formatted).toBe("$2.50");
  });

  test("the Latin aliases still read in a Japanese engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30.00");
    expect(engine.evaluate("100 usdを円").formatted).toBe("¥14,545");
  });

  test("the plural boundary moves nothing, in either slot", () => {
    // The three rows a `one`/`other` table exists for, read off the table rather
    // than through the formatter — `money` prints "$1.50" whatever the grammar
    // says, so this is the only place the words are visible. In Japanese all
    // three are one word, and the conversion target is that word again: there is
    // no case axis for the slot to select on.
    const usd = moneyJa.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("ドル");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("ドル");
    expect(usd?.[key("usd", "after-number", 5)]).toBe("ドル");
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("ドル");
    expect(usd?.[key("usd", "conversion-target", 5)]).toBe("ドル");
    expect(usd?.[key("usd", "conversion-target")]).toBe("ドル");
  });

  test("completion inserts a Japanese word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 フリ");
    expect(first?.text).toBe("30 フリヴニャ");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("uah");
  });

  test("round-trips its own output, by the only route this kind has", () => {
    // What this kind prints carries a currency *sign*, and `lex` builds no word
    // token out of one — so "$30.00" reads back as the bare number 30, in every
    // language. Asserted against an English engine beside the Japanese one, so
    // the gap is attributed where it belongs: to `money`'s format hook, not to
    // this translation.
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
    // vocabulary prints — through completion, and through `Printer`'s spelled
    // path — is a word it reads, and the amount survives the trip out and back
    // through a second currency.
    for (const [code, word] of Object.entries(moneyJa.units).flatMap(([code, words]) =>
      Object.values(words.forms ?? {}).map((w): [string, string] => [code, w]),
    )) {
      const first = engine.evaluate(`30${word}`);
      expect(first.value?.unit, word).toBe(code);
      const again = engine.evaluate(`30${word}を円をドル`);
      expect(again.value?.unit, word).toBe("usd");
    }
    const there = engine.evaluate("100ドルを円");
    const back = engine.evaluate("100ドルを円をドル");
    expect(back.value?.unit).toBe("usd");
    expect(back.formatted).toBe("$100.00");
    expect(there.value?.canonical.toString()).toBe(
      engine.evaluate("100ドル").value?.canonical.toString(),
    );
  });
});
