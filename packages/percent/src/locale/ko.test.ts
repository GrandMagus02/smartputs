import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { korean } from "@smartput/core/locale/ko";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberKo from "@smartput/number/locale/ko";
import { percent } from "../index";
import percentKo from "./ko";

const locale = composeLocale(korean, [percentKo]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/**
 * Hangul, and nothing else. Where the Japanese regex in the sibling file can only
 * claim "a CJK word leaked into the language-free half" — a kanji is shared with
 * Chinese — a Hangul test is an exact one: the script writes Korean and no other
 * living language.
 */
const HANGUL = /\p{Script=Hangul}/u;

describe("percent ko vocabulary", () => {
  test("it targets Korean and names its kind by id", () => {
    expect(percentKo.locale).toBe("ko");
    expect(percentKo.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentKo.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentKo.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is one ratio and one unit id, so no script but ASCII may reach it. Hangul in
  // the descriptor would mean a translation had leaked into the half of the
  // package that is supposed to be language-free.
  test("the kind itself carries no Korean word", () => {
    expect(JSON.stringify(percent)).not.toMatch(HANGUL);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so "20 pct" keeps parsing under a Korean format locale; the two
  // Hangul words are appended on top. Two is the whole Korean half, where
  // Ukrainian needed eighteen — a Korean noun does not decline, so there is no
  // paradigm to spell out.
  test("the generated Latin aliases survive, with two Korean words on top", () => {
    const aliases = percentKo.units["%"]?.aliases ?? [];
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    // 퍼센트 is the written transcription, 프로 the spoken borrowing that arrived
    // by way of Dutch and Japanese. Both get typed; neither gets printed.
    expect(aliases.filter((a) => HANGUL.test(a))).toEqual(["퍼센트", "프로"]);
  });

  // No `forms`, and for `en`'s reason rather than a grammatical one: the written
  // form of this unit is the symbol. Under `ko` the omission is a single row —
  // `korean.selectForm` has exactly one answer — which makes it cheaper to write
  // than Ukrainian's eight and no more correct: 「20%」 is what a Korean result line
  // carries, and a `forms` table would print 「20퍼센트」 at every percentage in the
  // engine's output.
  test("no unit declares forms, and selectForm has one key it would need", () => {
    for (const words of Object.values(percentKo.units)) {
      expect(words.forms).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      korean.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
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
    ).toEqual(["other"]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `ko` a fraction cannot select a different key — there
    // is only one — so this call confirms the shape rather than a new row, and
    // running it keeps this vocabulary comparable with every sibling that does
    // move across the boundary.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Korean percentages", () => {
    const e = engine();
    // Read as a word, answered as a symbol, and set tight against the number
    // because `korean.renderQuantity` closes the gap on every branch.
    expect(e.evaluate("20퍼센트").formatted).toBe("20%");
    expect(e.evaluate("20프로").formatted).toBe("20%");
    // The plural boundary, which in this language moves nothing at all: 1, 2 and 5
    // take the identical noun, and the vocabulary has no word to print for any of
    // them anyway.
    expect(e.evaluate("1퍼센트").formatted).toBe("1%");
    expect(e.evaluate("2퍼센트").formatted).toBe("2%");
    expect(e.evaluate("5퍼센트").formatted).toBe("5%");
    // The fractional row, and the grouped one. CLDR gives `ko` the same separators
    // as `en` — "." for the decimal, "," for the group — so unlike Ukrainian's
    // NBSP the grouped output reads straight back.
    expect(e.evaluate("1.5퍼센트").formatted).toBe("1.5%");
    expect(e.evaluate("2000퍼센트").formatted).toBe("2,000%");
    expect(e.evaluate("2,000%").formatted).toBe("2,000%");
    // A sum that lands on a fraction, through the division noun `ko.ts` lists.
    expect(e.evaluate("5퍼센트 나누기 2").formatted).toBe("2.5%");
    // A Sino-Korean numeral in front of the unit, spaced the way 한글 맞춤법 has it.
    expect(e.evaluate("이십 퍼센트").formatted).toBe("20%");
    // Both scripts read: a Korean engine still takes the Latin aliases the one
    // alias map in `units.ts` declares. Recognition is many-to-one, generation
    // stays one (design decision I6).
    expect(e.evaluate("50 pct").formatted).toBe("50%");
  });

  // `％` U+FF05 is what a fullwidth input mode produces from the `%` key, and it is
  // read without being listed: `normalize()` runs NFKC before a word reaches any
  // index, and NFKC folds the fullwidth form to the ASCII one. Asserted rather than
  // left in a comment, because the tempting "fix" is to add a dead alias that reads
  // as coverage.
  test("the fullwidth ％ reads through NFKC, not through an alias", () => {
    expect(percentKo.units["%"]?.aliases).not.toContain("％");
    expect(engine().evaluate("20％").formatted).toBe("20%");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion it
  // can be the target of comes from outside the kind. 를 is one of Korean's `in`
  // keywords, and it is a *postposition on the left operand*: it attaches to the
  // end of the phrase it governs, which is exactly where an infix operator goes.
  // Reaching the conversion-target slot through the word rather than through "%"
  // is what proves 퍼센트 is indexed and not merely listed.
  test("reads a conversion into percent, through the source particle", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 나누기 50를 퍼센트").formatted).toBe("10%");
    expect(e.evaluate("5 나누기 50를 %").formatted).toBe("10%");
    // 에서 is another spelling of `in` this language lists, and it means "from" —
    // it marks the source too, which is why both work as infix operators.
    expect(e.evaluate("1 나누기 8에서 퍼센트").formatted).toBe("12.5%");
  });

  // The Korean-only half of the round trip, and the reason the alias table needs no
  // inflected forms: the particle is not part of the word. 퍼센트로 ("into percent")
  // is one orthographic token, and it resolves because `particleStripper` peels the
  // directional 로 off — on the euphonic condition that 트 is an open syllable, so
  // 로 and not 으로 is the shape Korean uses here.
  test("a glued particle is stripped, and the wrong shape of it is refused", () => {
    const e = engine();
    expect(e.evaluate("20퍼센트로").formatted).toBe("20%");
    expect(e.evaluate("20퍼센트를").formatted).toBe("20%");
    // 으로 follows a closed syllable that is not ㄹ, and 트 is open, so this is not
    // Korean and the analyzer refuses to strip it. A flat suffix list would have
    // stripped it happily.
    expect(() => e.evaluate("20퍼센트으로")).toThrow();
  });

  // 할 is the Korean word for a proportion and it is deliberately unclaimed:
  // 「3할」 is 30%, a *tenth* and not a hundredth, so it is a different unit with a
  // different ratio rather than a synonym. `percent` declares one unit, and a
  // vocabulary may only name units the kind declares — reported, not faked.
  test("할 is a tenth and is not claimed as a synonym for the hundredth", () => {
    expect(percentKo.units["%"]?.aliases).not.toContain("할");
    expect(() => engine().evaluate("3할")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20퍼센트",
      "20프로",
      "1.5퍼센트",
      "2000퍼센트",
      "5퍼센트 나누기 2",
      "50 pct",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  // Imported and immediately used, so the number vocabulary this file composes
  // against in the conversion test above is the shipped one rather than a stand-in.
  test("composes with the number vocabulary it shares an engine with", () => {
    const both = composeLocale(korean, [percentKo, numberKo]);
    expect(() => assertLocaleContract(both, [percent, number])).not.toThrow();
  });
});
