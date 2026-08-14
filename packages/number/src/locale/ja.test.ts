import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberJa from "./ja";

const locale = composeLocale(japanese, [numberJa]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Anything only Japanese would write: hiragana, katakana and the two CJK
 * ideograph blocks a modern Japanese text draws on. Wider than the German
 * regex next door and narrower than nothing — a kanji is shared with Chinese,
 * so this catches "a CJK word leaked into the language-free half" rather than
 * "a *Japanese* word did", which is the only claim a script test can make.
 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/u;

/**
 * The closed key set `japanese.selectForm` can produce — one row, and that is
 * the whole of Japanese grammatical number. `en` has two, `uk` has eight.
 */
const ONE_KEY = ["other"];

describe("number ja vocabulary", () => {
  test("it targets Japanese and names its kind by id", () => {
    expect(numberJa.locale).toBe("ja");
    expect(numberJa.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on the
  // kind as a ratio-table key in any language — so this asserts the wrapper the
  // id was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // Japanese half: no kana and no kanji may reach the language-free side.
  test("the kind itself carries no Japanese word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(JAPANESE);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Japanese word
  // was smuggled in as an alias either. `japanese.numerals` claims 一 before any
  // index is consulted, so an entry for it would be unreachable machinery; 個 and
  // つ are *counters*, bound to the noun being counted rather than to the number,
  // and 数 is the abstract concept nobody counts five of.
  test("declares no forms and no Japanese alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberJa.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const alias of words.aliases) {
        expect(alias, `${unit} claims ${alias}`).not.toMatch(JAPANESE);
      }
    }
  });

  test("selectForm answers one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      japanese.selectForm({
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
    expect(numberJa.units.one?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers. Under `en` and `uk` a fraction is the
    // row they never reach; under `ja` it cannot reach a different answer, so
    // this call confirms the shape rather than a new key — and it can only
    // confirm the absence of a `forms` table, since a unit with none is skipped
    // before any key is asked for. That is the honest shape of this kind's
    // coverage, and running the same call every sibling row runs keeps it
    // comparable.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese numbers", () => {
    // CLDR gives `ja` the same separators as `en` — group ",", decimal "." — so
    // the digits themselves are the least Japanese thing in this file, and that
    // is worth pinning rather than assuming from the shared script.
    expect(engine.evaluate("1.5").formatted).toBe("1.5");
    expect(engine.evaluate("2000").formatted).toBe("2,000");
    // And the trap that pair sets, the mirror of German's: "," is the *group*
    // separator, so "1,5" is not a decimal here — it is the grouped integer 15,
    // read without complaint. No vocabulary can change that; both symbols come
    // from CLDR.
    expect(engine.evaluate("1,5").value?.canonical.toString()).toBe("15");
    // Kanji numerals in, ASCII digits out. 一万 is the myriad grouping that made
    // `ja` ship its own `numerals` instead of reusing `cardinalNumerals`: it is
    // 10⁴, so this is ten thousand and not "one myriad" spelled in thousands.
    expect(engine.evaluate("一万").formatted).toBe("10,000");
    expect(engine.evaluate("千五百").formatted).toBe("1,500");
    expect(engine.evaluate("一億二千三百四十五万六千七百八十九").formatted).toBe(
      "123,456,789",
    );
    // A sum with no space anywhere in it, which is what a Japanese input looks
    // like — and it works precisely because every character is a kanji, so `lex`
    // sees one letter run and `japanese.segment` cuts it into 二十 | 二 | 足す | 一.
    expect(engine.evaluate("二十二足す一").formatted).toBe("23");
    // A sum that lands on a fraction, through the division verb.
    expect(engine.evaluate("五 割る 二").formatted).toBe("2.5");
    expect(engine.evaluate("1.5 プラス 1").formatted).toBe("2.5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Japanese claims the
  // Latin word — `japaneseNumerals` reads kanji characters only, and
  // `japanese.segment` returns a run with no Han, Hiragana or Katakana in it
  // whole — so here the self-alias is live, which is the alias earning its keep:
  // `formatNumber` emits exactly this string.
  test("the Latin self-alias is live under ja, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
    expect(japanese.segment?.("one")).toEqual(["one"]);
  });

  // The plural boundary every sibling row turns into two different words. This
  // language turns *no* boundary into two words, so the row is doubly empty: 1
  // and 2 print as their own digits because there is nothing to append, and they
  // would print alike even if there were.
  test("no count appends a word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word. を is the
    // Japanese `in` keyword — a postposition on the *left* operand, which is why
    // it lands where an infix operator goes — and here the target word vanishes
    // and the numeral is all that prints.
    expect(engine.evaluate("1one を one").formatted).toBe("1");
    expect(engine.evaluate("2 one を one").formatted).toBe("2");
  });

  // `japanese.renderQuantity` closes the gap on *every* branch, where the default
  // spaces a word and only closes up a symbol. A `symbol: ""` unit would
  // therefore print `${number}` and nothing else if it ever reached the renderer
  // — and it never does, because `formatValue` returns the bare number text on
  // `NUMBER_KIND` first. This is the assertion that says so.
  test("the empty symbol never reaches Japanese's gapless branch", () => {
    expect(numberJa.units.one?.symbol).toBe("");
    expect(engine.evaluate("7.25").formatted).toBe("7.25");
    expect(engine.evaluate("7.25").formatted).not.toMatch(/\s/);
  });

  // Two limits of the core lexer that this package is the one place to see
  // plainly, because a bare arithmetic expression is its whole input. Recorded as
  // live assertions rather than prose, following the precedent `uk.test.ts` sets
  // for the NBSP group separator: a gap nobody re-measures is a gap that gets
  // "fixed" by weakening a test.
  test("records what an unspaced Japanese expression cannot yet do", () => {
    // An ASCII digit run is split off the *front* of a letter run and not off the
    // back, so "10足す5" reaches the resolver as the word "足す5". Every kanji
    // spelling of the same sum works (above), which is what isolates the cause to
    // the digits rather than to the verb.
    expect(() => engine.evaluate("10足す5")).toThrow();
    expect(engine.evaluate("10 足す 5").formatted).toBe("15");
    // たす is the hiragana spelling of the same verb — how it is typed into a
    // calculator — and ICU cuts it into た | す, both of which its dictionary
    // holds as words in their own right. A keyword is looked up by one segmented
    // word, so the surface can never be matched; `ja.ts` therefore does not list
    // it, and `core/locale/ja.test.ts` pins the cut so that an ICU update which
    // learns the verb surfaces as a failing test. The kanji stem 足す survives
    // whole and is the spelling the language carries.
    expect(japanese.keywords.plus).not.toContain("たす");
    expect(japanese.segment?.("たす")).toEqual(["た", "す"]);
    expect(japanese.segment?.("足す")).toEqual(["足す"]);
    expect(() => engine.evaluate("10 たす 5")).toThrow();
    // The positional year reading — 二〇二五 for 2025 — that `ja-cardinals.ts`
    // parses and `core/locale/ja.test.ts` pins at the parser. It cannot arrive at
    // the parser through an engine: 〇 is U+3007, `\p{Nl}` and not `\p{L}`, and
    // `scriptSegmenter` filters on `\p{L}`, so the zero is dropped and what
    // reaches `numerals` is 二 | 二 | 五.
    expect(japanese.segment?.("二〇二五")).toEqual(["二", "二", "五"]);
    expect(engine.evaluate("二〇二五").value?.canonical.toString()).toBe("225");
  });

  test("round-trips its own output", () => {
    // A fractional, a grouped integer (readable back — "," survives NFKC where
    // Ukrainian's NBSP does not), two kanji cardinals, the fraction-landing
    // division, and the facade's own `${raw}one` string.
    for (const input of ["1.5", "2000", "一万", "二十二足す一", "五 割る 二", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
