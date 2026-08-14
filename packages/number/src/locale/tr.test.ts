import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberTr from "./tr";

const locale = composeLocale(turkish, [numberTr]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Turkish is written in the Latin alphabet, so no script regex can separate a
 * Turkish word from a unit key the way `/\p{Script=Han}/u` does next door in
 * `zh.test.ts`. What is grepped for instead is the words themselves — the two
 * counters and the two abstract nouns this file argues against claiming — which
 * is the only honest form the "no word leaked into the kind" check can take in a
 * shared alphabet. The diacritics are spelled both ways, because a Turkish word
 * reaching the kind by accident would arrive in whichever of the two a keyboard
 * produced.
 */
const TURKISH = /tane|adet|sayı|sayi|rakam/i;

/**
 * The closed key set `turkish.selectForm` can produce — one row, and that is the
 * whole of Turkish grammatical number after a count. `en` has two, `uk` has
 * eight.
 */
const ONE_KEY = ["other"];

describe("number tr vocabulary", () => {
  test("it targets Turkish and names its kind by id", () => {
    expect(numberTr.locale).toBe("tr");
    expect(numberTr.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on the
  // kind as a ratio-table key in any language — so this asserts the wrapper the
  // id was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // Turkish half.
  test("the kind itself carries no Turkish word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(TURKISH);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Turkish word was
  // smuggled in as an alias either. An alias resolves to the *unit* `one`, never
  // to a magnitude, so listing "bir" would read "bir" as the number 1 wearing a
  // unit label rather than as the cardinal one — which the numeral table already
  // reads correctly, and better.
  test("declares no forms and no Turkish alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberTr.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const alias of words.aliases) {
        expect(alias, `${unit} claims ${alias}`).not.toMatch(TURKISH);
      }
    }
    expect(numberTr.units.one?.aliases).toEqual(["one"]);
  });

  // The one-key contract, and — unlike `id`, `ja` and `zh` — Turkish reaches it
  // *against* CLDR rather than with it. That difference is the whole reason
  // `@smartput/core/locale/tr` writes `selectForm` as a constant instead of
  // routing through `Intl.PluralRules`, so it is measured here rather than
  // assumed.
  test("selectForm answers one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      turkish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    // The rows that move `en` and `uk` and cannot move this language: the 1/2
    // boundary, the Slavic 5-and-up row, a fraction, and the count-free
    // conversion target of ruling R5.
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
          key(undefined, "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(ONE_KEY);
    // CLDR declares *two* categories for Turkish, and the language file
    // deliberately does not use them: a counted noun here is bare whatever the
    // count, so a two-row table would hold the same string twice and hide a typo
    // in the row that only fires at 1.
    expect(new Intl.PluralRules("tr").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);
    expect(new Intl.PluralRules("tr").select(1)).toBe("one");
    expect(key(1, "after-number")).toBe("other");
    expect(numberTr.units.one?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers. Under `en` and `uk` a fraction is the
    // row they never reach; under `tr` it cannot reach a different answer, so
    // this call confirms the shape rather than a new key — and it can only
    // confirm the absence of a `forms` table, since a unit with none is skipped
    // before any key is asked for. Running the same call every sibling row runs
    // keeps it comparable.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Turkish numbers", () => {
    // The separators, which are the whole of what a language decides in this
    // package: Turkish marks the decimal with "," and groups with "." — German's
    // pair, the inverse of English's — read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    expect(engine.evaluate("2000").formatted).toBe("2.000");
    expect(engine.evaluate("1000000").formatted).toBe("1.000.000");
    // And the trap that pair sets, which is Ukrainian's trap upside down: "." is
    // the *group* separator here, so "1.5" is not a decimal — it is the grouped
    // integer 15, read without complaint. No vocabulary can change that; both
    // symbols come from CLDR.
    expect(engine.evaluate("1.5").value?.canonical.toString()).toBe("15");
    expect(engine.evaluate("1.500").value?.canonical.toString()).toBe("1500");
    // All four word operators this language declares, each complete on its own —
    // which is why `turkish.keywords` declares no `by` for one of them to
    // swallow — and each in both its correct and its ASCII spelling.
    expect(engine.evaluate("2 artı 3").formatted).toBe("5");
    expect(engine.evaluate("2 arti 3").formatted).toBe("5");
    expect(engine.evaluate("10 eksi 4").formatted).toBe("6");
    expect(engine.evaluate("3 çarpı 4").formatted).toBe("12");
    expect(engine.evaluate("3 carpi 4").formatted).toBe("12");
    // A sum that lands on a fraction, through the division word, printed with the
    // decimal comma.
    expect(engine.evaluate("5 bölü 2").formatted).toBe("2,5");
    expect(engine.evaluate("5 bolu 2").formatted).toBe("2,5");
    expect(engine.evaluate("1,5 artı 1").formatted).toBe("2,5");
  });

  // Where `id.test.ts` has to record that a written-out number does not parse at
  // all, this file records the opposite: the *shared* `cardinalNumerals` reads
  // Turkish unmodified, which `@smartput/core/locale/tr` claims of no other
  // language here except Ukrainian — German and French both had to ship a parser
  // of their own. This package, whose whole input is a bare arithmetic
  // expression, is where that claim is visible.
  test("written-out Turkish numbers parse, in both directions", () => {
    expect(turkish.numerals).toBeDefined();
    expect(turkish.spell).toBeDefined();
    expect(engine.evaluate("yirmi iki").formatted).toBe("22");
    expect(engine.evaluate("iki bin").formatted).toBe("2.000");
    expect(engine.evaluate("yüz beş").formatted).toBe("105");
    // The ASCII spellings `tr-cardinals.ts` declares as second keys, which double
    // as the only path for an all-caps word: the shared helper folds with the
    // locale-neutral `toLowerCase()`, so "BES" arrives as "bes" and never as
    // "beş".
    expect(engine.evaluate("bes yuz").formatted).toBe("500");
    expect(engine.evaluate("BES YUZ").formatted).toBe("500");
    // And the numerals compose with the word operators, which is the whole point
    // of both being in the language rather than in a kind.
    expect(engine.evaluate("yirmi iki artı bir").formatted).toBe("23");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Turkish ships a cardinal parser
  // too and the alias survives anyway, because `CARDINALS` holds no Latin "one" —
  // the Turkish word is "bir". Two live tables in one alphabet that simply do not
  // overlap, which is a sharper version of the fact `id.test.ts` records for a
  // language with no numeral table at all.
  test("the Latin self-alias is live under tr, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
    expect(engine.evaluate("999one").formatted).toBe("999");
  });

  // The collision the two tables *could* have had, and the floor that prevents
  // it. `-e` is the Turkish dative, so a suffix stripper with a low floor would
  // offer "on" as a stem of "one" — and "on" is Turkish for ten, sitting in
  // `CARDINALS.tens`. `minStem: 3` refuses the strip, and the numeral table is
  // out of reach from the analyzer chain in any case, since `numerals` is handed
  // the lexer's own words and never an analyzer's forms. Both readings are pinned
  // because the failure would be a wrong answer with every character claimed.
  test("one is the unit and on is the numeral ten", () => {
    expect(engine.evaluate("one").formatted).toBe("1");
    expect(engine.evaluate("on").formatted).toBe("10");
    expect(engine.evaluate("on bir").formatted).toBe("11");
  });

  // The plural boundary every sibling row turns into two different words. This
  // language turns *no* boundary into two words, so the row is doubly empty: 1
  // and 2 print as their own digits because there is nothing to append, and they
  // would print alike even if there were.
  test("no count appends a word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word. Both of this
    // language's conversion keywords reach it — "çevir" is the verb and "to" is
    // English's word folded into the same entry — and here the target word
    // vanishes and the numeral is all that prints.
    expect(engine.evaluate("2 çevir one").formatted).toBe("2");
    expect(engine.evaluate("2 one to one").formatted).toBe("2");
  });

  // Turkish is the first language in this package to declare a `renderQuantity`
  // and still print nothing extra here. It spaces a bare symbol — "5 kg", TSE
  // following SI, the same override German makes — and that space is invisible
  // for this unit twice over: the symbol is the empty string, and `formatValue`
  // returns the bare number text on `NUMBER_KIND` before any symbol is read at
  // all. This is the assertion that says so, because a trailing blank on every
  // number would be a very quiet regression.
  test("the empty symbol never reaches the spacing override", () => {
    expect(numberTr.units.one?.symbol).toBe("");
    expect(turkish.renderQuantity).toBeDefined();
    expect(engine.evaluate("7,25").formatted).toBe("7,25");
    expect(engine.evaluate("7,25").formatted).not.toMatch(/\s/);
  });

  test("round-trips its own output", () => {
    // The grouped rows are in this list where the Ukrainian file had to leave
    // them out: Turkish groups with "." and `normalize()`'s NFKC pass leaves that
    // alone, so "1.000.000" reads straight back — as does the decimal comma,
    // which is an ordinary ASCII character here and not Ukrainian's NBSP.
    for (const input of [
      "1,5",
      "2.000",
      "1.000.000",
      "2 artı 3",
      "5 bölü 2",
      "yirmi iki",
      "999one",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
