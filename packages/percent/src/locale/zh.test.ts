import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentZh from "./zh";

const locale = composeLocale(chinese, [percentZh]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/**
 * Han, the only script this language writes its words in. A Han character is
 * shared with Japanese and Korean, so what this catches is "a CJK word leaked
 * into the language-free half" rather than "a *Chinese* word did" — the only
 * claim a script test can honestly make.
 */
const CHINESE = /\p{Script=Han}/u;

describe("percent zh vocabulary", () => {
  test("it targets Chinese and names its kind by id", () => {
    expect(percentZh.locale).toBe("zh");
    expect(percentZh.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so no script but ASCII may reach it. A Han
  // character in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Chinese word", () => {
    expect(JSON.stringify(percent)).not.toMatch(CHINESE);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so "20 pct" keeps parsing under a Chinese format locale. Nothing is
  // appended on top, and unlike every other row of this phase that is the
  // *result* rather than an omission: every Chinese spelling of a percentage is
  // unreachable, and the four tests below name which and why.
  test("the generated Latin aliases survive, with no Chinese word on top", () => {
    const aliases = percentZh.units["%"]?.aliases ?? [];
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    expect(aliases.filter((a) => CHINESE.test(a))).toEqual([]);
  });

  // The reason there is no Chinese alias, and the only one that is about the
  // language rather than about ICU: Chinese puts the unit *in front of* the
  // count. 百分之二十 is 20%, and an alias is a token that follows a number — so
  // the word could only ever be reached as 「20百分之」, which nobody writes. It is
  // unreachable a second way besides, and that is what the segment call pins.
  test("百分之 precedes its number, and ICU will not keep it whole either", () => {
    expect(chinese.segment?.("百分之")).toEqual(["百分", "之"]);
    expect(percentZh.units["%"]?.aliases).not.toContain("百分之");
    // What the standard written form actually does in this engine: 二十 is
    // claimed by `chinese.numerals` as the number 20, and 百分 and 之 are words no
    // vocabulary claims, so the input is refused rather than read as 20% or as a
    // bare 20.
    expect(chinese.segment?.("百分之二十")).toEqual(["百分", "之", "二十"]);
    expect(() => engine().evaluate("百分之二十")).toThrow();
  });

  // 百分比 survives ICU whole and is still not an alias, for the reason `ja`
  // gives about 百分率: it names the *ratio*, the way English "percentage" does,
  // and an alias is a thing that follows a number. 百分点 is the percentage
  // *point* — a difference between percentages — and ICU cuts it anyway.
  test("百分比 and 百分点 are the concept and the neighbouring unit", () => {
    const aliases = percentZh.units["%"]?.aliases ?? [];
    expect(chinese.segment?.("百分比")).toEqual(["百分比"]);
    expect(aliases).not.toContain("百分比");
    expect(chinese.segment?.("百分点")).toEqual(["百分", "点"]);
    expect(aliases).not.toContain("百分点");
  });

  // 成 and 折 are two more *units*, not two more spellings: both are counted in
  // tenths — 三成 is 30%, 八折 is 80% — so each has a ratio this kind does not
  // declare, and a vocabulary may only name units the kind declares. Reported,
  // not faked: giving 成 the ratio 0.01 would read 三成 as 3%. The live cost is
  // worth pinning, and it is that both are simply refused.
  test("成 and 折 are tenths, and are not claimed as synonyms for the hundredth", () => {
    const aliases = percentZh.units["%"]?.aliases ?? [];
    expect(aliases).not.toContain("成");
    expect(aliases).not.toContain("折");
    // 折 is not this language's `off` keyword either, and `core/locale/zh.ts`
    // says why: 八折 names the price that *remains*, so the eight is 80 where a
    // discount operator wants 20.
    expect(chinese.keywords.off).toBeUndefined();
    expect(() => engine().evaluate("三成")).toThrow();
    expect(() => engine().evaluate("八折")).toThrow();
  });

  // The one genuinely post-numeral Chinese word for a percentage, and it belongs
  // to a tag this file is not. Under the bare `zh` tag — mainland Simplified —
  // 趴 is the ordinary verb "to lie face down".
  test("趴 is Taiwanese and is left to a zh-TW vocabulary", () => {
    expect(chinese.segment?.("趴")).toEqual(["趴"]);
    expect(percentZh.units["%"]?.aliases).not.toContain("趴");
  });

  test("no unit declares forms, and selectForm has one key it would need", () => {
    for (const words of Object.values(percentZh.units)) {
      expect(words.forms).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      chinese.selectForm({
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
    // The claim behind the one-key table, measured rather than asserted: CLDR
    // gives Chinese exactly one plural category, so a one-row `forms` table is a
    // correct answer for this language and never a stub.
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `zh` a fraction cannot select a different key — there
    // is only one — so this call confirms the shape rather than a new row, and
    // running it keeps this vocabulary comparable with every sibling that does
    // move across the boundary.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese percentages", () => {
    const e = engine();
    // The symbol is the whole of this unit's Chinese output, and it is set tight
    // against the number because `chinese.renderQuantity` closes the gap on every
    // branch — which for a symbol is what the default would have done anyway.
    expect(e.evaluate("20%").formatted).toBe("20%");
    // The plural boundary, which in this language moves nothing at all: 1, 2 and
    // 5 take the identical noun, and the vocabulary has no word to print for any
    // of them anyway.
    expect(e.evaluate("1%").formatted).toBe("1%");
    expect(e.evaluate("2%").formatted).toBe("2%");
    expect(e.evaluate("5%").formatted).toBe("5%");
    // The fractional row, and the grouped one. CLDR gives `zh` the same
    // separators as `en` — "." for the decimal, "," for the group — so unlike
    // Ukrainian's NBSP the grouped output reads straight back.
    expect(e.evaluate("1.5%").formatted).toBe("1.5%");
    expect(e.evaluate("2000%").formatted).toBe("2,000%");
    expect(e.evaluate("2,000%").formatted).toBe("2,000%");
    // A sum that lands on a fraction, through the division verb this language
    // declares. 除以 is one word to ICU and one keyword here.
    expect(e.evaluate("5% 除以 2").formatted).toBe("2.5%");
    // And the Chinese numeral as the divisor, which is what a Chinese input
    // actually looks like: no space anywhere, because `chinese.segment` cuts the
    // one Han run into 除以 | 二.
    expect(e.evaluate("5%除以二").formatted).toBe("2.5%");
    // Both scripts read: a Chinese engine still takes the Latin aliases the one
    // alias map in `units.ts` declares. Recognition is many-to-one, generation is
    // one (design decision I6).
    expect(e.evaluate("50 pct").formatted).toBe("50%");
  });

  // `％` U+FF05 is what a Chinese IME produces from the `%` key, and it is read
  // without being listed: `normalize()` runs NFKC before a word reaches any
  // index, and NFKC folds the fullwidth form to the ASCII one. Asserted rather
  // than left in a comment, because the tempting "fix" is to add a dead alias
  // that reads as coverage.
  test("the fullwidth ％ reads through NFKC, not through an alias", () => {
    expect(percentZh.units["%"]?.aliases).not.toContain("％");
    expect(engine().evaluate("20％").formatted).toBe("20%");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion
  // it can be the target of comes from outside the kind. 到 and 为 are two of the
  // four `in` words this language declares, and unlike Japanese's を they are
  // ordinary infix particles standing between the operands.
  test("reads a conversion into percent, through both infix particles", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 / 50 到 %").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 为 %").formatted).toBe("10%");
    // And with the whole expression written unspaced, the way Chinese is
    // actually typed: 一 divides through 除以 and 到 introduces the target, all
    // out of one Han run.
    expect(e.evaluate("1除以八到%").formatted).toBe("12.5%");
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of ["20%", "1.5%", "2000%", "5%除以二", "50 pct"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
