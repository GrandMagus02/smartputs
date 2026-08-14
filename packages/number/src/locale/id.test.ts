import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberId from "./id";

const locale = composeLocale(indonesian, [numberId]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Indonesian is written in the Latin alphabet, so no script regex can separate an
 * Indonesian word from an ISO code or a unit key the way `/\p{Script=Han}/u` does
 * next door in `zh.test.ts`. What is grepped for instead is the words themselves —
 * the classifier, the two abstract nouns and the cardinals this file argues against
 * claiming — which is the only honest form the "no word leaked into the kind" check
 * can take in a shared alphabet.
 */
const INDONESIAN = /buah|angka|bilangan|satu|puluh|ratus|belas/i;

/**
 * The closed key set `indonesian.selectForm` can produce — one row, and that is the
 * whole of Indonesian grammatical number. `en` has two, `uk` has eight.
 */
const ONE_KEY = ["other"];

describe("number id vocabulary", () => {
  test("it targets Indonesian and names its kind by id", () => {
    expect(numberId.locale).toBe("id");
    expect(numberId.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one has
  // none to grep — its single unit is *named* `one`, and that id stays on the kind as
  // a ratio-table key in any language — so this asserts the wrapper the id was quoted
  // inside is gone, exactly as `en.test.ts` does, and adds the Indonesian half.
  test("the kind itself carries no Indonesian word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(INDONESIAN);
  });

  // The contract check below is vacuous on the `forms` half — there is no table to
  // index — so this pins the absence itself, and pins that no Indonesian word was
  // smuggled in as an alias either. An alias resolves to the *unit* `one`, never to a
  // magnitude, so listing "satu" would read "satu" as the number 1 with a unit label
  // rather than as the cardinal one; and "dua puluh lima" is three tokens, which no
  // alias index can reach at all.
  test("declares no forms and no Indonesian alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the unit
    // entirely cannot make this pass by being empty — the coverage test above owns
    // that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberId.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const alias of words.aliases) {
        expect(alias, `${unit} claims ${alias}`).not.toMatch(INDONESIAN);
      }
    }
  });

  test("selectForm answers one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      indonesian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    // The rows that move `en` and `uk` and cannot move this language: the 1/2
    // boundary, the Slavic 5-and-up row, a fraction, and the count-free conversion
    // target of ruling R5.
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
    // And the claim behind the one-key table, measured rather than asserted: CLDR
    // gives Indonesian exactly one plural category — it is in the no-plural group
    // beside Chinese, Japanese, Korean and its own close relative Malay — so a
    // one-row `forms` table is the correct answer for this language and not a stub
    // anyone should come back and finish.
    expect(new Intl.PluralRules("id").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(numberId.units.one?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers. Under `en` and `uk` a fraction is the row
    // they never reach; under `id` it cannot reach a different answer, so this call
    // confirms the shape rather than a new key — and it can only confirm the absence
    // of a `forms` table, since a unit with none is skipped before any key is asked
    // for. That is the honest shape of this kind's coverage, and running the same
    // call every sibling row runs keeps it comparable.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Indonesian numbers", () => {
    // The separators, which are the whole of what a language decides in this package
    // and are the exact inverse of English's: Indonesian marks the decimal with ","
    // and groups with "." — Dutch and German's pair, read from CLDR through
    // `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    expect(engine.evaluate("2000").formatted).toBe("2.000");
    expect(engine.evaluate("1000000").formatted).toBe("1.000.000");
    // And the trap that pair sets, which is Ukrainian's trap upside down: "." is the
    // *group* separator here, so "1.5" is not a decimal — it is the grouped integer
    // 15, read without complaint. No vocabulary can change that; both symbols come
    // from CLDR.
    expect(engine.evaluate("1.5").value?.canonical.toString()).toBe("15");
    expect(engine.evaluate("1.500").value?.canonical.toString()).toBe("1500");
    // All four word operators this language declares, each complete on its own —
    // which is why `indonesian.keywords` declares no `by` for one of them to swallow.
    expect(engine.evaluate("2 tambah 3").formatted).toBe("5");
    expect(engine.evaluate("10 kurang 4").formatted).toBe("6");
    expect(engine.evaluate("3 kali 4").formatted).toBe("12");
    // A sum that lands on a fraction, through the division verb, and printed with the
    // decimal comma.
    expect(engine.evaluate("5 bagi 2").formatted).toBe("2,5");
    expect(engine.evaluate("1,5 tambah 1").formatted).toBe("2,5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Indonesian claims the
  // Latin word — this language declares no `numerals` at all — so here the
  // self-alias is live, which is the alias earning its keep: `formatNumber` emits
  // exactly this string. That it is live in a Latin-alphabet language is the sharper
  // version of the same fact `zh.test.ts` records, where the scripts simply do not
  // meet.
  test("the Latin self-alias is live under id, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
    expect(engine.evaluate("999one").formatted).toBe("999");
  });

  // The gap `@smartput/core/locale/id` measured and deliberately shipped, recorded
  // here as a live assertion rather than left in prose, because this package — whose
  // whole input is a bare arithmetic expression — is where it is visible. Indonesian
  // has two multiplying morphemes below a thousand (`puluh` ×10, `ratus` ×100) where
  // `cardinalNumerals` flushes a group only at ≥1000, so the most charitable table
  // reads "seratus dua puluh lima" as 1025 where Indonesian says 125 — the wrong
  // number with every word claimed. That file therefore ships no `numerals`, and the
  // cost lands exactly here: a written-out Indonesian number does not parse. The fix
  // is an `id-cardinals.ts` with a hand-written `NumeralParser`, and the day it lands
  // this test fails and is rewritten rather than quietly staying true.
  test("records that a written-out Indonesian number does not parse", () => {
    expect(indonesian.numerals).toBeUndefined();
    expect(indonesian.spell).toBeUndefined();
    expect(() => engine.evaluate("satu")).toThrow();
    expect(() => engine.evaluate("dua puluh lima")).toThrow();
    // And the reason none of them is listed as an alias to paper over it: an alias
    // names a *unit*, so "dua puluh lima" would have to read as the number 1 wearing
    // a label, which is a wrong answer dressed as coverage.
    expect(numberId.units.one?.aliases).toEqual(["one"]);
  });

  // The plural boundary every sibling row turns into two different words. This
  // language turns *no* boundary into two words, so the row is doubly empty: 1 and 2
  // print as their own digits because there is nothing to append, and they would
  // print alike even if there were.
  test("no count appends a word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word. Both of this
    // language's `in` keywords reach it — "ke" is the directional "to" and "dalam" is
    // "in" — and here the target word vanishes and the numeral is all that prints.
    expect(engine.evaluate("2 ke one").formatted).toBe("2");
    expect(engine.evaluate("2 one dalam one").formatted).toBe("2");
  });

  // Indonesian declares no `renderQuantity`, so `defaultRenderQuantity` applies and a
  // symbol is set tight — which for `symbol: ""` prints `${number}` and nothing else.
  // It is never reached anyway, because `formatValue` returns the bare number text on
  // `NUMBER_KIND` before any symbol is read. This is the assertion that says so.
  test("the empty symbol never reaches the renderer at all", () => {
    expect(numberId.units.one?.symbol).toBe("");
    expect(indonesian.renderQuantity).toBeUndefined();
    expect(engine.evaluate("7,25").formatted).toBe("7,25");
    expect(engine.evaluate("7,25").formatted).not.toMatch(/\s/);
  });

  test("round-trips its own output", () => {
    // The grouped rows are in this list where the Ukrainian file had to leave them
    // out: Indonesian groups with "." and `normalize()`'s NFKC pass leaves that
    // alone, so "1.000.000" reads straight back — as does the decimal comma, which is
    // an ordinary ASCII character here and not Ukrainian's NBSP.
    for (const input of [
      "1,5",
      "2.000",
      "1.000.000",
      "2 tambah 3",
      "5 bagi 2",
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
