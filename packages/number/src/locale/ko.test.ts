import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberKo from "./ko";

const locale = composeLocale(korean, [numberKo]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Hangul, and nothing else. Where the Japanese regex next door can only claim "a
 * CJK word leaked into the language-free half" — a kanji is shared with Chinese —
 * a Hangul test is an exact one: the script is used to write Korean and no other
 * living language, so a match here really does mean a Korean word got into a file
 * that must not hold one.
 */
const HANGUL = /\p{Script=Hangul}/u;

/**
 * The closed key set `korean.selectForm` can produce — one row, and that is the
 * whole of Korean grammatical number. `en` has two, `uk` has eight.
 */
const ONE_KEY = ["other"];

describe("number ko vocabulary", () => {
  test("it targets Korean and names its kind by id", () => {
    expect(numberKo.locale).toBe("ko");
    expect(numberKo.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on the
  // kind as a ratio-table key in any language — so this asserts the wrapper the id
  // was quoted inside is gone, exactly as `en.test.ts` does, and adds the Korean
  // half: no Hangul may reach the language-free side.
  test("the kind itself carries no Korean word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(HANGUL);
  });

  // The contract check below is vacuous on the `forms` half — there is no table to
  // index — so this pins the absence itself, and pins that no Korean word was
  // smuggled in as an alias either. `korean.numerals` claims 일 and 영 before any
  // index is consulted, so an entry for either would be unreachable machinery; 개
  // and 명 are *counters*, bound to the noun being counted rather than to the
  // number; and 수 is the abstract concept nobody counts five of.
  test("declares no forms and no Korean alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test above
    // owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberKo.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const alias of words.aliases) {
        expect(alias, `${unit} claims ${alias}`).not.toMatch(HANGUL);
      }
    }
  });

  test("selectForm answers one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      korean.selectForm({
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
    expect(numberKo.units.one?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers. Under `en` and `uk` a fraction is the
    // row they never reach; under `ko` it cannot reach a different answer, so this
    // call confirms the shape rather than a new key — and it can only confirm the
    // absence of a `forms` table, since a unit with none is skipped before any key
    // is asked for. That is the honest shape of this kind's coverage, and running
    // the same call every sibling row runs keeps it comparable.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean numbers", () => {
    // CLDR gives `ko` the same separators as `en` — group ",", decimal "." — so the
    // digits themselves are the least Korean thing in this file, and that is worth
    // pinning rather than assuming.
    expect(engine.evaluate("1.5").formatted).toBe("1.5");
    expect(engine.evaluate("2000").formatted).toBe("2,000");
    // And the trap that pair sets: "," is the *group* separator, so "1,5" is not a
    // decimal here — it is the grouped integer 15, read without complaint. No
    // vocabulary can change that; both symbols come from CLDR.
    expect(engine.evaluate("1,5").value?.canonical.toString()).toBe("15");
    // Sino-Korean numerals in, ASCII digits out. 만 is 10⁴ — the myriad grouping
    // that made `ko` ship its own `numerals` instead of reusing `cardinalNumerals`
    // — and it stands bare, where Chinese writes 一万 and Japanese writes 一万 too.
    expect(engine.evaluate("만").formatted).toBe("10,000");
    // The elision Korean does and neither neighbour does: the 일 goes in front of
    // *all three* sub-myriad scales, so 1,500 is 천오백 and not 일천오백.
    expect(engine.evaluate("천오백").formatted).toBe("1,500");
    // Spaced at the myriad boundary, per 한글 맞춤법 §44 — three words, one number,
    // rejoined by `koreanNumerals`.
    expect(engine.evaluate("일억 이천삼백사십오만 육천칠백팔십구").formatted).toBe(
      "123,456,789",
    );
    // The arithmetic nouns, which are the fortunate exception to Korean
    // head-finality: 더하기 really does stand between its operands.
    expect(engine.evaluate("이십이 더하기 일").formatted).toBe("23");
    // A sum that lands on a fraction, through the division noun.
    expect(engine.evaluate("오 나누기 이").formatted).toBe("2.5");
    expect(engine.evaluate("1.5 플러스 1").formatted).toBe("2.5");
  });

  // The thing `ja.test.ts` records as a limitation and `ko` simply does not have:
  // Japanese needed every character of "10足す5" to be kanji before the expression
  // would lex, because an unspaced run only breaks where ICU's dictionary says so.
  // Korean is spaced, so a mixed digit-and-Hangul expression works as long as the
  // writer spaced it — which Korean orthography requires anyway.
  test("a spaced expression mixes digits and Hangul freely", () => {
    expect(engine.evaluate("10 더하기 5").formatted).toBe("15");
    expect(engine.evaluate("1.5 플러스 1").formatted).toBe("2.5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Korean claims the Latin
  // word — `koreanNumerals` reads Hangul syllables only — so here the self-alias is
  // live, which is the alias earning its keep: `formatNumber` emits exactly this
  // string.
  test("the Latin self-alias is live under ko, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  // The plural boundary every sibling row turns into two different words. This
  // language turns *no* boundary into two words, so the row is doubly empty: 1 and
  // 2 print as their own digits because there is nothing to append, and they would
  // print alike even if there were.
  test("no count appends a word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word. 를 is one of
    // Korean's `in` keywords — the accusative particle on the *left* operand,
    // which is why it lands where an infix operator goes — and here the target
    // word vanishes and the numeral is all that prints.
    expect(engine.evaluate("1one 를 one").formatted).toBe("1");
    expect(engine.evaluate("2 를 one").formatted).toBe("2");
  });

  // Written the way a Korean actually writes it, with the particle glued to the
  // word in front of it. It parses for a reason worth pinning: `korean` declares
  // no `segment`, so `lex` falls back to `Intl.Segmenter("ko")`, which breaks at
  // the *script* boundary even though it has no Korean dictionary — so "one를"
  // arrives as two tokens and 를 is a keyword. The same input all in Hangul would
  // not split, which is the gap `core/locale/ko.ts` reports to core.
  test("a particle glued to a Latin stem still splits off", () => {
    expect(korean.segment).toBeUndefined();
    expect(engine.evaluate("1one를 one").formatted).toBe("1");
  });

  // The limit of an *unspaced* Korean expression, recorded as live assertions
  // rather than prose, following the precedent `uk.test.ts` sets for the NBSP
  // group separator: a gap nobody re-measures is a gap that gets "fixed" by
  // weakening a test. This is the exact inverse of Japanese's position — `ja` can
  // only read an unspaced expression, and `ko` can only read a spaced one.
  test("records what an unspaced Korean expression cannot do", () => {
    const words = (run: string) =>
      [...new Intl.Segmenter("ko", { granularity: "word" }).segment(run)]
        .filter((s) => s.isWordLike)
        .map((s) => s.segment);
    // ICU has no Korean dictionary, so a Hangul run comes back whole — which is
    // what makes 이십이 one numeral word, and also what makes 이십이더하기일 one
    // unreadable word.
    expect(words("이십이")).toEqual(["이십이"]);
    expect(words("이십이더하기일")).toEqual(["이십이더하기일"]);
    expect(() => engine.evaluate("이십이더하기일")).toThrow();
    // A digit run is split off the *front* of a letter run and not off the back,
    // so "10더하기5" reaches the resolver as the word "더하기5".
    expect(() => engine.evaluate("10더하기5")).toThrow();
  });

  test("round-trips its own output", () => {
    // A fractional, a grouped integer (readable back — "," survives NFKC where
    // Ukrainian's NBSP does not), two Sino-Korean cardinals, the fraction-landing
    // division, and the facade's own `${raw}one` string.
    for (const input of [
      "1.5",
      "2000",
      "만",
      "이십이 더하기 일",
      "오 나누기 이",
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
