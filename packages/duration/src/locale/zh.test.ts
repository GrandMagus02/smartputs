import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationZh from "./zh";

const locale = () => composeLocale(chinese, [durationZh]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;
const COUNTS = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000];

/** Every key `chinese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  COUNTS.flatMap((count) =>
    SLOTS.map((slot) =>
      chinese.selectForm({
        count: new Decimal(count),
        kind: "duration",
        unit: "h",
        slot,
      }),
    ),
  )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => chinese.selectForm({ kind: "duration", unit: "h", slot })),
    ),
);

/** Han, the one script Simplified Chinese writes its words in. */
const HAN = /\p{Script=Han}/u;

describe("duration zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // The script as a class rather than a list of the words: the kind is six
    // ratios, six unit ids and the magnitude bands, so any Han character
    // reaching it is the failure.
    expect(JSON.stringify(duration)).not.toMatch(HAN);
  });

  test("`chinese` asks for exactly one key, and every unit declares exactly it", () => {
    // The contract the language author pinned, measured here rather than
    // trusted: Chinese marks number nowhere on a noun, so every count — the
    // fractional 1.5 and the count-free conversion target included — and every
    // slot come back "other".
    expect([...KEYS]).toEqual(["other"]);
    expect(Intl.PluralRules.supportedLocalesOf("zh")).toEqual(["zh"]);
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    // Rule 6: no more keys and no fewer. A one-row table is the correct answer
    // for Chinese and not a stub anyone should come back and finish — there is
    // no second grammatical category for a second row to hold.
    for (const [unit, words] of Object.entries(durationZh.units)) {
      expect(Object.keys(words.forms ?? {}), `${unit}'s form keys`).toEqual(["other"]);
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(durationZh.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      for (const surface of [
        words.symbol as string,
        ...Object.values(words.forms ?? {}),
      ]) {
        expect(
          surface,
          `${unit}'s printable "${surface}" holds an operator character`,
        ).not.toMatch(/[/*+\-·×⋅]/);
        expect(folded, `${unit}'s printable "${surface}" is not an alias`).toContain(
          surface.toLowerCase(),
        );
      }
    }
  });

  test("every Chinese alias survives the segmenter whole", () => {
    // The check no Latin-script language in this repo needs, and the one that
    // decides what a `zh` vocabulary may contain. Chinese is unspaced, so `lex`
    // hands each letter run to `chinese.segment` before anything is looked up: a
    // word ICU breaks never reaches the alias index as one token, however
    // faithfully it is written here. All six of this kind's words survive, which
    // is why this is the kind that gets to print Chinese on every unit — 字节
    // (byte) and 千焦 (kilojoule) next door do not.
    for (const [unit, words] of Object.entries(durationZh.units)) {
      for (const surface of words.aliases) {
        if (!HAN.test(surface)) continue;
        expect(chinese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
    expect(chinese.segment?.("字节")).toEqual(["字", "节"]);
  });

  test("时 is left to the clock, and 分 is read but never printed", () => {
    // The two spelling decisions this kind's Chinese actually turns on.
    //
    // 「3时」 is three o'clock, a point rather than a length, and belongs to
    // `datetime`; only the prefixed 小时 is a duration, so the bare 时 is
    // claimed nowhere here.
    expect(durationZh.units.h?.aliases).not.toContain("时");
    // 分, 日 and 星期 are the second spellings a reader may type — 分 is the
    // everyday short minute, 日 the written day beside the colloquial 天, 星期
    // the full word 周 abbreviates. All three are read; none is printed, because
    // 分 alone is a mark or a fraction as readily as a minute and the other two
    // are simply the less common register.
    expect(durationZh.units.min?.aliases).toContain("分");
    expect(engine.evaluate("30分").formatted).toBe("30分钟");
    expect(engine.evaluate("3日").formatted).toBe("3天");
    expect(engine.evaluate("2星期").formatted).toBe("2周");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Chinese folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [duration], { counts: COUNTS }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese duration", () => {
    // Han in, Han out, and nothing between the number and the label:
    // `chinese.renderQuantity` closes the gap on every branch, which is how
    // 「5秒」 is written on any Chinese page.
    expect(engine.evaluate("5秒").formatted).toBe("5秒");
    expect(engine.evaluate("2小时").formatted).toBe("2小时");
    // Latin in, Chinese out: a Chinese developer types "2 h" as readily.
    expect(engine.evaluate("2 h").formatted).toBe("2小时");
    // A conversion through two of the four words the language claims under `in`
    // — the verb 换算 and the particle 到 — landing on a fraction.
    expect(engine.evaluate("90分钟到小时").formatted).toBe("1.5小时");
    expect(engine.evaluate("90分钟换算小时").formatted).toBe("1.5小时");
    expect(engine.evaluate("1周为天").formatted).toBe("7天");
    // A sum landing on a fraction. The decimal mark is ".", read from CLDR
    // through `numberFormat: "intl"` rather than transcribed — Chinese groups by
    // thousands and marks the decimal with a point, the same pair as `en`, even
    // though it *speaks* by myriads.
    expect(engine.evaluate("1小时 + 30分钟").formatted).toBe("1.5小时");
    // The Han numerals, this language's other unusual half.
    expect(engine.evaluate("十小时").formatted).toBe("10小时");
    expect(engine.evaluate("二十分钟").formatted).toBe("20分钟");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5秒",
      "2小时",
      "90分钟到小时",
      "1小时 + 30分钟",
      "1周为天",
      "十小时",
      "10毫秒",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
