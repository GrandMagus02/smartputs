import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { CURRENCIES, currencyVocabulary } from "@smartput/currency";
import { number } from "@smartput/number";
import numberZh from "@smartput/number/locale/zh";
// Through the package path, not "./zh": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact that
// `./locale/en` was missing from it.
import moneyZh from "@smartput/rate/locale/zh";
import { money } from "../money";
import { snapshot } from "../snapshot";
import moneyEn from "./en";

/**
 * Every currency this file gives a Chinese word, and no more. The words are
 * checked by evaluating them, and a currency the snapshot does not quote raises
 * `MissingRateError` before the reading is ever reported — so the table of rates
 * has to cover the table of words, and a word added below with no rate here fails
 * loudly rather than going unchecked.
 *
 * It is six rows shorter than the Japanese file's, because Chinese compounds a
 * country morpheme onto a money morpheme and ICU's dictionary holds only the
 * commonest of those compounds.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  JPY: 160,
  CHF: 0.94,
});

const locale = composeLocale(chinese, [numberZh, moneyZh]);
const engine = createEngine({ locales: [locale], kinds: [number, money], rates });

/**
 * Han, the only script this language writes its words in. A Han character is
 * shared with Japanese and Korean, so what this catches is "a CJK word leaked
 * into the language-free half" rather than "a *Chinese* word did" — the only
 * claim a script test can honestly make. It is also what separates this file's
 * layer from the generated one, since every alias `CURRENCIES` ships is ASCII.
 */
const CHINESE = /\p{Script=Han}/u;

/** The key `chinese` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  chinese.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "money",
    unit,
    slot,
  });

/** The currencies this file gives Chinese words, and the seven it does not. */
const TRANSLATED = ["chf", "eur", "gbp", "jpy", "usd"];
const UNTRANSLATED = ["aud", "cad", "czk", "nok", "pln", "sek", "uah"];

/** Every word this vocabulary adds on top of the generated table, by currency. */
const added: Array<[string, string]> = Object.entries(moneyZh.units).flatMap(
  ([code, words]) =>
    words.aliases.filter((a) => CHINESE.test(a)).map((a): [string, string] => [code, a]),
);

describe("money zh vocabulary", () => {
  test("covers every currency the kind declares", () => {
    const units = Object.keys(money.value.mode === "ratio" ? money.value.units : {});
    expect(Object.keys(moneyZh.units).sort()).toEqual(units.sort());
    expect(moneyZh.locale).toBe("zh");
    expect(moneyZh.kind).toBe("money");
  });

  test("every currency has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(moneyZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is ratios, ISO codes and magnitude bands, so no script but ASCII may reach it.
  // A Han character in the descriptor would mean a translation had leaked into the
  // half of the package that is supposed to be language-free.
  test("the kind itself carries no Chinese word", () => {
    expect(JSON.stringify(money)).not.toMatch(CHINESE);
  });

  test("typical bands are on the kind, not in the vocabulary", () => {
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(money.typical?.[code]).toEqual(def.typical);
    }
    for (const words of Object.values(moneyZh.units)) {
      expect(words).not.toHaveProperty("typical");
    }
  });

  test("the generated half stays generated", () => {
    // The ISO code, the Latin aliases and the currency sign are not language, so
    // they come through untouched and the Chinese words are appended after them.
    // Losing them would mean "30 usd" stops parsing the moment the format locale
    // changes: recognition is many-to-one, generation is one. It matters more here
    // than under `ja`, because seven of the twelve currencies have no Chinese word
    // and the ISO code is the only door they have.
    for (const [code, def] of Object.entries(CURRENCIES)) {
      expect(moneyZh.units[code]?.symbol, code).toBe(def.symbol);
      expect(moneyZh.units[code]?.aliases.slice(0, def.aliases.length), code).toEqual(
        def.aliases,
      );
    }
  });

  // `currencyVocabulary` takes a locale and stamps it on the returned vocabulary;
  // the words behind it are English either way. This is the assertion that says so
  // out loud, so that the day `CURRENCIES` grows localized names, the file above
  // stops being right and this stops being green together.
  test('currencyVocabulary("zh") is English words under a zh label', () => {
    const generated = currencyVocabulary("zh");
    expect(generated.locale).toBe("zh");
    expect(generated.units).toEqual(currencyVocabulary("en").units);
    expect(generated.units.usd?.forms).toEqual({ one: "dollar", other: "dollars" });
  });

  // Dropping the generated `forms` is load-bearing under `zh` in a way it was not
  // under `uk`, and this is the assertion that separates the two cases.
  // `ukrainian.selectForm` returns neither `one` nor `other`, so an English table
  // left in place would merely have been unreachable. `chinese.selectForm` returns
  // `"other"` for every count and every slot — the *same* key the generated table
  // declares — so keeping it would have had a Chinese engine completing
  // 「30 dollars」.
  test("the English forms it generates are dropped, and here that matters", () => {
    expect(key("usd", "after-number", 5)).toBe("other");
    expect(currencyVocabulary("zh").units.usd?.forms?.other).toBe("dollars");
    for (const [code, words] of Object.entries(moneyZh.units)) {
      expect(Object.keys(words.forms ?? {}), code).not.toContain("one");
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${code} prints a Latin word`).toMatch(CHINESE);
      }
    }
  });

  test("every translated currency carries exactly the one key zh can ask for", () => {
    expect(
      Object.keys(moneyZh.units)
        .filter((code) => moneyZh.units[code]?.forms !== undefined)
        .sort(),
    ).toEqual(TRANSLATED);
    for (const code of TRANSLATED) {
      expect(Object.keys(moneyZh.units[code]?.forms ?? {}), code).toEqual(["other"]);
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
    // And the claim behind the one-row table, measured rather than asserted: CLDR
    // gives Chinese exactly one plural category, so this is the correct shape and
    // not a stub anyone should come back and finish.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("the seven currencies with no Chinese word declare none", () => {
    for (const code of UNTRANSLATED) {
      expect(moneyZh.units[code]?.forms, code).toBeUndefined();
      expect(
        moneyZh.units[code]?.aliases.some((a) => CHINESE.test(a)),
        `${code} claims a Chinese word`,
      ).toBe(false);
      // Each stays typeable, because the ISO code always was the way to reach it,
      // in either language.
      expect(moneyZh.units[code]?.aliases, code).toContain(code);
    }
    // Five of the seven are ICU cutting a name Chinese writes perfectly happily.
    // The compounding pattern is the same one 美元 and 英镑 survive with — a
    // country morpheme in front of a money morpheme — so what separates the two
    // groups is dictionary frequency, not word formation.
    expect(chinese.segment?.("加元")).toEqual(["加", "元"]);
    expect(chinese.segment?.("加拿大元")).toEqual(["加拿大", "元"]);
    expect(chinese.segment?.("澳元")).toEqual(["澳", "元"]);
    expect(chinese.segment?.("兹罗提")).toEqual(["兹", "罗", "提"]);
    expect(chinese.segment?.("格里夫纳")).toEqual(["格里", "夫", "纳"]);
    // The other two are Ukrainian's problem rather than Japanese's: Chinese calls
    // all three krona currencies 克朗 and separates them only by a country prefix,
    // and ICU cuts every one of those after the country. So the bare word is one
    // three units of this kind would claim — which has no reading — and the
    // qualified forms are unreachable.
    expect(chinese.segment?.("克朗")).toEqual(["克朗"]);
    expect(chinese.segment?.("瑞典克朗")).toEqual(["瑞典", "克朗"]);
    expect(chinese.segment?.("挪威克朗")).toEqual(["挪威", "克朗"]);
    expect(chinese.segment?.("捷克克朗")).toEqual(["捷克", "克朗"]);
    for (const code of ["sek", "nok", "czk"]) {
      expect(moneyZh.units[code]?.aliases, code).not.toContain("克朗");
    }
  });

  // The renminbi, reported rather than patched: `CURRENCIES` ships no `cny`, and a
  // vocabulary may only name units the kind declares (rule 2 — a kind is ratios
  // and unit ids). So the three words a Chinese user is most likely to type at a
  // currency converter are claimed by nothing, and one of them could not have been
  // claimed anyway.
  test("the renminbi is a gap in the currency table, not in this translation", () => {
    expect(Object.keys(CURRENCIES)).not.toContain("cny");
    expect(chinese.segment?.("人民币")).toEqual(["人民", "币"]);
    for (const word of ["人民币", "元", "块"]) {
      expect(
        added.map(([, alias]) => alias),
        word,
      ).not.toContain(word);
    }
    expect(() => engine.evaluate("30元")).toThrow();
  });

  // The gap invisible to every other test here: a printed form that is not a
  // listed alias would still round-trip in Ukrainian, because its penalised suffix
  // stripper recovers one. Chinese has no stripper at all — `chinese.analyze` is
  // `[identity()]`, and `core/locale/zh.ts` argues that a stripper here would be
  // actively wrong rather than merely idle — so a form missing from `aliases`
  // simply does not parse, and this assertion is the only thing standing between
  // that and a completion nobody can use.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(moneyZh.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("no Chinese word is claimed by two currencies", () => {
    // What `assertLocaleContract` cannot catch on this kind, checked by hand: a
    // word claimed by two units of one kind has no reading, because no context the
    // engine has can separate them. The near-miss this guards is the one the krona
    // row above documents, and 美元/美金 are the pair inside a single currency that
    // must stay inside it.
    const owner = new Map<string, string>();
    for (const [code, alias] of added) {
      expect(owner.get(alias), `${alias} is claimed by two currencies`).toBeUndefined();
      owner.set(alias, code);
    }
  });

  test("satisfies the locale contract, waiving the signs no language reads", () => {
    // `skipPrintable` is what makes this runnable at all, and it is a fact about
    // the currency table rather than about Chinese: `money` prints through
    // `symbolOf(code)`, and a currency sign ("$", "₴", "zł") is readable back in no
    // language — `lex` does not build a word token out of one. Every currency needs
    // the waiver, so it is derived rather than listed, and the count is pinned so a
    // shrinking table cannot make this vacuous.
    const skipPrintable = Object.keys(moneyZh.units).map((code) => `money:${code}`);
    expect(skipPrintable.length).toBe(Object.keys(CURRENCIES).length);
    const opts = { skipPrintable };
    expect(() => assertLocaleContract(locale, [number, money], opts)).not.toThrow();
    // The default counts are all integers and never reach a fractional reading.
    // Under `zh` a fraction cannot select a different key — there is only one — so
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

  test("an engine built from it reads and writes Chinese money", () => {
    // The amount is rendered by `money`'s own format hook — sign, currency symbol,
    // minor units — so what the language decides here is the digits, and CLDR
    // gives `zh` the same pair as `en`: "." for the decimal, "," for the group. The
    // unit word is written tight against the number on the way *in*, which is what
    // `chinese.segment` is for.
    expect(engine.evaluate("30美元").formatted).toBe("$30.00");
    expect(engine.evaluate("30欧元").formatted).toBe("€30.00");
    expect(engine.evaluate("30美金").formatted).toBe("$30.00");
    expect(engine.evaluate("30英镑").formatted).toBe("£30.00");
    expect(engine.evaluate("30法郎").formatted).toBe("CHF30.00");
    // JPY has no minor units, which is why 日圆 prints without a fraction while
    // every other row here carries two digits.
    expect(engine.evaluate("30日圆").formatted).toBe("¥30");
    // A conversion, through 到 — one of the four `in` words this language
    // declares, and an ordinary infix particle rather than Japanese's
    // postposition.
    expect(engine.evaluate("100美元到日圆").formatted).toBe("¥14,545");
    expect(engine.evaluate("1000日圆到美元").formatted).toBe("$6.88");
    // A sum, and a sum that lands on a fraction. The operands are spelled in Han
    // numerals so the whole expression stays inside one letter run — which is what
    // a Chinese input actually looks like, and what `core/locale/zh.test.ts`
    // records as the way around the lexer's trailing-digit rule.
    expect(engine.evaluate("十日圆加五日圆").formatted).toBe("¥15");
    expect(engine.evaluate("五美元除以二").formatted).toBe("$2.50");
    expect(engine.evaluate("10日圆 加 5日圆").formatted).toBe("¥15");
  });

  test("the Latin aliases still read in a Chinese engine", () => {
    expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
    expect(engine.evaluate("30 dollars").formatted).toBe("$30.00");
    expect(engine.evaluate("100 usd到日圆").formatted).toBe("¥14,545");
  });

  test("the plural boundary moves nothing, in either slot", () => {
    // The three rows a `one`/`other` table exists for, read off the table rather
    // than through the formatter — `money` prints "$1.50" whatever the grammar says,
    // so this is the only place the words are visible. In Chinese all three are one
    // word, and the conversion target is that word again: there is no case axis for
    // the slot to select on.
    const usd = moneyZh.units.usd?.forms;
    expect(usd?.[key("usd", "after-number", 1)]).toBe("美元");
    expect(usd?.[key("usd", "after-number", 2)]).toBe("美元");
    expect(usd?.[key("usd", "after-number", 5)]).toBe("美元");
    expect(usd?.[key("usd", "after-number", 1.5)]).toBe("美元");
    expect(usd?.[key("usd", "conversion-target", 5)]).toBe("美元");
    expect(usd?.[key("usd", "conversion-target")]).toBe("美元");
  });

  test("completion inserts a Chinese word the engine can read back", () => {
    // The one place `forms` is visible to a user of the money kind, since the
    // format hook prints a symbol: completion splices the count and the selected
    // form, and the result is meant to be handed straight back to `evaluate`.
    const [first] = engine.complete("30 美");
    expect(first?.text).toBe("30 美元");
    expect(engine.evaluate(first?.text ?? "").value?.unit).toBe("usd");
    // And unspaced, which is how the count and the unit are actually written
    // here: the splice keeps the caller's own separator, so the completion of a
    // Chinese fragment comes back looking like Chinese.
    const [tight] = engine.complete("30美");
    expect(tight?.text).toBe("30美元");
    expect(engine.evaluate(tight?.text ?? "").formatted).toBe("$30.00");
  });

  test("round-trips its own output, by the only route this kind has", () => {
    // What this kind prints carries a currency *sign*, and `lex` builds no word
    // token out of one — so "$30.00" reads back as the bare number 30, in every
    // language. Asserted against an English engine beside the Chinese one, so the
    // gap is attributed where it belongs: to `money`'s format hook, not to this
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
    // vocabulary prints — through completion, and through `Printer`'s spelled path
    // — is a word it reads, and the amount survives the trip out and back through a
    // second currency.
    for (const [code, word] of Object.entries(moneyZh.units).flatMap(([code, words]) =>
      Object.values(words.forms ?? {}).map((w): [string, string] => [code, w]),
    )) {
      const first = engine.evaluate(`30${word}`);
      expect(first.value?.unit, word).toBe(code);
      const again = engine.evaluate(`30${word}到日圆到美元`);
      expect(again.value?.unit, word).toBe("usd");
    }
    const there = engine.evaluate("100美元到日圆");
    const back = engine.evaluate("100美元到日圆到美元");
    expect(back.value?.unit).toBe("usd");
    expect(back.formatted).toBe("$100.00");
    expect(there.value?.canonical.toString()).toBe(
      engine.evaluate("100美元").value?.canonical.toString(),
    );
  });
});
