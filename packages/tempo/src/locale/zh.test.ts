import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoZh from "./zh";

const locale = () => composeLocale(chinese, [tempoZh]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;
const COUNTS = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000];

/** Every key `chinese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  COUNTS.flatMap((count) =>
    SLOTS.map((slot) =>
      chinese.selectForm({ count: new Decimal(count), kind: "tempo", unit: "hz", slot }),
    ),
  )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(SLOTS.map((slot) => chinese.selectForm({ kind: "tempo", unit: "hz", slot }))),
);

/** Han, the one script Simplified Chinese writes its words in. */
const HAN = /\p{Script=Han}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = chinese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("tempo zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // The script as a class rather than a list of the words: the kind is two
    // ratios, two unit ids, the magnitude bands and the reciprocal bridge to
    // `duration`, so any Han character reaching it is the failure.
    expect(JSON.stringify(tempo)).not.toMatch(HAN);
  });

  test("`hz` declares one form where English needed two identical ones", () => {
    // The contract the language author pinned: Chinese marks number nowhere on a
    // noun, so every count — the fractional 1.5 and the count-free conversion
    // target included — and every slot come back "other". A one-row table is the
    // correct and finished answer for this language, not a stub; rule 6 wants
    // exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(Object.keys(tempoZh.units.hz?.forms ?? {})).toEqual([...KEYS]);
    // `bpm` has nothing to put in the row: the Chinese is discontinuous, with
    // the rate phrase before the number and the counter after it.
    expect(tempoZh.units.bpm?.forms).toBeUndefined();
  });

  test("one word covers every count", () => {
    // English needs a `one` row beside an `other` row even though both spell
    // "hertz"; Chinese needs one word, and the count-free conversion target takes
    // the same one.
    expect(word("hz", 1)).toBe("赫兹");
    expect(word("hz", 50)).toBe("赫兹");
    expect(word("hz", 1.5)).toBe("赫兹");
    expect(word("hz", undefined, "conversion-target")).toBe("赫兹");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(tempoZh.units)) {
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

  test("赫兹 survives the segmenter whole, and the bpm phrase does not", () => {
    // Chinese is unspaced, so `lex` hands each letter run to `chinese.segment`
    // before anything is looked up: a word ICU breaks never reaches the alias
    // index as one token. 赫兹 is the load-bearing case, since it is a *printed*
    // string and not merely a read one.
    for (const [unit, words] of Object.entries(tempoZh.units)) {
      for (const surface of [...words.aliases, ...Object.values(words.forms ?? {})]) {
        if (!HAN.test(surface)) continue;
        expect(chinese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
    // The one continuous Chinese spelling of a tempo is cut into four pieces, of
    // which 分钟 is `@smartput/duration`'s minute — and the idiomatic phrasing is
    // discontinuous besides, 「每分钟120拍」, with the rate before the number and
    // the counter after it. No vocabulary entry can put a label on both sides of
    // its own quantity.
    expect(chinese.segment?.("每分钟拍数")).toEqual(["每", "分钟", "拍", "数"]);
    const claimed = Object.values(tempoZh.units).flatMap((w) => [...w.aliases]);
    expect(claimed).not.toContain("每分钟拍数");
    // 赫 is a real abbreviation inside 千赫 and 兆赫, both of which ICU returns
    // whole — and this kind ships no kHz or MHz unit for them to name, which is
    // `units.ts`'s business and not this file's. Standing alone after a number,
    // 赫 is a surname before it is a unit.
    expect(chinese.segment?.("兆赫")).toEqual(["兆赫"]);
    expect(claimed).not.toContain("赫");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Chinese folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [tempo], { counts: COUNTS }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese tempo", () => {
    // Han in, Han out, and nothing between the number and the label:
    // `chinese.renderQuantity` closes the gap on every branch, so 「50赫兹」 is
    // set as tightly as 「120bpm」.
    expect(engine.evaluate("50赫兹").formatted).toBe("50赫兹");
    expect(engine.evaluate("1.5赫兹").formatted).toBe("1.5赫兹");
    // 拍 is read and never printed: the counter standing for the whole rate, the
    // same elision "120 bpm" itself rests on.
    expect(engine.evaluate("120拍").formatted).toBe("120bpm");
    // A conversion through the particle 到 and through the verb 换算, the second
    // landing on a fraction.
    expect(engine.evaluate("120bpm到hz").formatted).toBe("2赫兹");
    expect(engine.evaluate("90拍换算hz").formatted).toBe("1.5赫兹");
    // A sum landing on a fraction. The operands are spaced, which finding 2 in
    // the language notes requires: `lex` appends a letter run's trailing digits
    // to the last segmented word, so 「1赫兹加0.5赫兹」 would swallow the 0.5 into
    // the operator 加.
    expect(engine.evaluate("1赫兹 + 0.5赫兹").formatted).toBe("1.5赫兹");
    // The Han numerals, this language's other unusual half.
    expect(engine.evaluate("二十赫兹").formatted).toBe("20赫兹");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "50赫兹",
      "1.5赫兹",
      "120拍",
      "120bpm到hz",
      "1赫兹 + 0.5赫兹",
      "二十赫兹",
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
