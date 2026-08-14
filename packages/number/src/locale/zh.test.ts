import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberZh from "./zh";

const locale = composeLocale(chinese, [numberZh]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Han, the only script this language writes its words in. A Han character is
 * shared with Japanese and Korean, so what this catches is "a CJK word leaked
 * into the language-free half" rather than "a *Chinese* word did" — the only
 * claim a script test can honestly make, and the same one `ja.test.ts` states
 * next door.
 */
const CHINESE = /\p{Script=Han}/u;

/**
 * The closed key set `chinese.selectForm` can produce — one row, and that is the
 * whole of Chinese grammatical number. `en` has two, `uk` has eight.
 */
const ONE_KEY = ["other"];

describe("number zh vocabulary", () => {
  test("it targets Chinese and names its kind by id", () => {
    expect(numberZh.locale).toBe("zh");
    expect(numberZh.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on the
  // kind as a ratio-table key in any language — so this asserts the wrapper the
  // id was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // Chinese half: no Han character may reach the language-free side.
  test("the kind itself carries no Chinese word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(CHINESE);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Chinese word was
  // smuggled in as an alias either. `chinese.numerals` claims 一 and 两 before any
  // index is consulted, so an entry for either would be unreachable machinery; 个
  // is a *measure word*, bound to the noun being counted rather than to the
  // number, and 数 is the abstract concept nobody counts five of.
  test("declares no forms and no Chinese alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberZh.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const alias of words.aliases) {
        expect(alias, `${unit} claims ${alias}`).not.toMatch(CHINESE);
      }
    }
  });

  test("selectForm answers one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      chinese.selectForm({
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
    // And the claim behind the one-key table, measured rather than asserted:
    // CLDR gives Chinese exactly one plural category, so a one-row `forms` table
    // is the correct answer for this language and not a stub anyone should come
    // back and finish.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(numberZh.units.one?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers. Under `en` and `uk` a fraction is the
    // row they never reach; under `zh` it cannot reach a different answer, so
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

  test("an engine built from it reads and writes Chinese numbers", () => {
    // CLDR gives `zh` the same separators as `en` — group ",", decimal "." — so
    // the digits themselves are the least Chinese thing in this file. Worth
    // pinning rather than assuming from the script: Chinese *speaks* by myriads
    // and still *groups* by thousands.
    expect(engine.evaluate("1.5").formatted).toBe("1.5");
    expect(engine.evaluate("2000").formatted).toBe("2,000");
    // And the trap that pair sets: "," is the *group* separator, so "1,5" is not
    // a decimal here — it is the grouped integer 15, read without complaint. No
    // vocabulary can change that; both symbols come from CLDR.
    expect(engine.evaluate("1,5").value?.canonical.toString()).toBe("15");
    // Han numerals in, ASCII digits out. 一万 is the myriad that made `zh` ship
    // its own `numerals` rather than reuse `cardinalNumerals`: it is 10⁴, so this
    // is ten thousand and not "one myriad" spelled in thousands.
    expect(engine.evaluate("一万").formatted).toBe("10,000");
    expect(engine.evaluate("一千五百").formatted).toBe("1,500");
    // The zero that marks a skipped decimal place, and the reason `zh`'s numeral
    // parser re-reads the join at every length: ICU cuts 一百零五 into
    // 一百 | 零 | 五, which is 100, 0 and 5 apart and 105 together.
    expect(chinese.segment?.("一百零五")).toEqual(["一百", "零", "五"]);
    expect(engine.evaluate("一百零五").formatted).toBe("105");
    expect(engine.evaluate("一亿二千三百四十五万六千七百八十九").formatted).toBe(
      "123,456,789",
    );
    // A sum with no space anywhere in it, which is what a Chinese input looks
    // like — and it works precisely because every character is Han, so `lex` sees
    // one letter run and `chinese.segment` cuts it into 二十 | 二 | 加 | 一.
    expect(chinese.segment?.("二十二加一")).toEqual(["二十", "二", "加", "一"]);
    expect(engine.evaluate("二十二加一").formatted).toBe("23");
    // A sum that lands on a fraction, through the division verb. 除以 is one word
    // to ICU and one keyword here — the 以 that would be `by` is already inside
    // it, which is why `chinese.keywords` declares no `by` at all.
    expect(engine.evaluate("五除以二").formatted).toBe("2.5");
    expect(engine.evaluate("1.5 加 1").formatted).toBe("2.5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Chinese claims the
  // Latin word — `chineseNumerals` reads Han characters only, and
  // `scriptSegmenter` returns a run with no Han in it whole — so here the
  // self-alias is live, which is the alias earning its keep: `formatNumber` emits
  // exactly this string.
  test("the Latin self-alias is live under zh, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
    expect(chinese.segment?.("one")).toEqual(["one"]);
  });

  // The plural boundary every sibling row turns into two different words. This
  // language turns *no* boundary into two words, so the row is doubly empty: 1
  // and 2 print as their own digits because there is nothing to append, and they
  // would print alike even if there were.
  test("no count appends a word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word. 到 is the
    // Chinese `in` keyword — an ordinary infix particle, unlike Japanese's
    // postposition — and here the target word vanishes and the numeral is all
    // that prints.
    expect(engine.evaluate("1one 到 one").formatted).toBe("1");
    expect(engine.evaluate("2 one 到 one").formatted).toBe("2");
  });

  // `chinese.renderQuantity` closes the gap on *every* branch, where the default
  // spaces a word and only closes up a symbol. A `symbol: ""` unit would
  // therefore print `${number}` and nothing else if it ever reached the renderer
  // — and it never does, because `formatValue` returns the bare number text on
  // `NUMBER_KIND` first. This is the assertion that says so.
  test("the empty symbol never reaches Chinese's gapless branch", () => {
    expect(numberZh.units.one?.symbol).toBe("");
    expect(engine.evaluate("7.25").formatted).toBe("7.25");
    expect(engine.evaluate("7.25").formatted).not.toMatch(/\s/);
  });

  // Two limits of the core lexer that this package is the one place to see
  // plainly, because a bare arithmetic expression is its whole input. Recorded as
  // live assertions rather than prose, following the precedent `uk.test.ts` sets
  // for the NBSP group separator: a gap nobody re-measures is a gap that gets
  // "fixed" by weakening a test.
  test("records what an unspaced Chinese expression cannot yet do", () => {
    // `lex` appends a letter run's trailing digits to the *last* segmented word —
    // the rule that makes an alias like "m2" reachable — and in an unspaced
    // language the word before the digits is usually the operator. So "10加5"
    // reaches the resolver as the word "加5" and never parses. Spelling the
    // operand dodges it completely, and one space restores it; neither fix
    // belongs in a language, because the rule runs before `segment` is consulted.
    expect(() => engine.evaluate("10加5")).toThrow();
    expect(engine.evaluate("10 加 5").formatted).toBe("15");
    expect(engine.evaluate("十加五").formatted).toBe("15");
    // Verb and particle written together — 换算为, the idiomatic full phrasing of
    // "convert into" — segment into two adjacent tokens that are *both* `in`, and
    // the parser refuses two conversion keywords in a row. No keyword table can
    // fold two tokens into one, which is why `zh.ts` declares all four words:
    // each works alone, and declaring only the verbs or only the particles would
    // strand the other half.
    expect(chinese.segment?.("换算为")).toEqual(["换算", "为"]);
    expect(engine.evaluate("1one 换算 one").formatted).toBe("1");
    expect(engine.evaluate("1one 为 one").formatted).toBe("1");
    expect(() => engine.evaluate("1one 换算为 one")).toThrow();
    // The positional year reading — 二〇二六 — that `zh-cardinals.ts` deliberately
    // refuses. 〇 is U+3007, `\p{Nl}` and not `\p{L}`, so `scriptSegmenter` drops
    // it before the numeral parser is ever offered the run, and what arrives is
    // two digits in a row, which the reader refuses as a phone number rather than
    // guessing at a year.
    expect(chinese.segment?.("二〇二六")).toEqual(["二", "二六"]);
    expect(() => engine.evaluate("二〇二六")).toThrow();
  });

  test("round-trips its own output", () => {
    // A fractional, a grouped integer (readable back — "," survives NFKC where
    // Ukrainian's NBSP does not), two Han cardinals, the fraction-landing
    // division, and the facade's own `${raw}one` string.
    for (const input of ["1.5", "2000", "一万", "二十二加一", "五除以二", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
