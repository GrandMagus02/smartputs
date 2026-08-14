import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { chinese } from "@smartput/core/locale/zh";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyZh from "./zh";

const locale = () => composeLocale(chinese, [energyZh]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;
const COUNTS = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000];

/** Every key `chinese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  COUNTS.flatMap((count) =>
    SLOTS.map((slot) =>
      chinese.selectForm({
        count: new Decimal(count),
        kind: "energy",
        unit: "cal",
        slot,
      }),
    ),
  )
    // Ruling R5's row: a conversion target has no magnitude attached to it and
    // must still name a key.
    .concat(
      SLOTS.map((slot) => chinese.selectForm({ kind: "energy", unit: "cal", slot })),
    ),
);

/** Han, the one script Simplified Chinese writes its words in. */
const HAN = /\p{Script=Han}/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = chinese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyZh.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("energy zh vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyZh.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyZh.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Chinese word", () => {
    // The script as a class rather than a list of the words: the kind is nine
    // ratios, nine unit ids, the magnitude bands and four bridge signatures, so
    // any Han character reaching it is the failure.
    expect(JSON.stringify(energy)).not.toMatch(HAN);
  });

  test("only the calorie family declares a form, and it declares exactly one", () => {
    // The contract the language author pinned: Chinese marks number nowhere on a
    // noun, so every count — the fractional 1.5 and the count-free conversion
    // target included — and every slot come back "other". A one-row table is the
    // correct and finished answer for this language, not a stub; rule 6 wants
    // exactly that set, no more and no fewer.
    expect([...KEYS]).toEqual(["other"]);
    expect(new Intl.PluralRules("zh").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(Object.keys(energyZh.units.cal?.forms ?? {})).toEqual([...KEYS]);
    expect(Object.keys(energyZh.units.kcal?.forms ?? {})).toEqual([...KEYS]);
    // Every other family prints its symbol: the joule family because ICU cuts
    // its prefixed members, the watt-hour family because it is a compound in
    // Chinese as in English, and `btu` because 英热单位 is a gloss nobody types.
    for (const unit of ["j", "kj", "mj", "wh", "kwh", "mwh", "btu"] as const) {
      expect(energyZh.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("one word covers every count", () => {
    // The whole of Chinese number agreement, in four assertions. English needs
    // "calorie" beside "calories" and Ukrainian needs four nominative rows and
    // four locative ones; Chinese needs one word, and the count-free conversion
    // target takes the same one.
    expect(word("cal", 1)).toBe("卡路里");
    expect(word("cal", 200)).toBe("卡路里");
    expect(word("cal", 1.5)).toBe("卡路里");
    expect(word("cal", undefined, "conversion-target")).toBe("卡路里");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(energyZh.units)) {
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

  test("the families ICU holds together, and the ones it takes apart", () => {
    // The measurement behind every ruling in the doc comment, re-run rather than
    // trusted. In Chinese a broken prefix is worse than an unreadable fragment:
    // 千 is `zh-cardinals.ts`'s scale word for a thousand, so 「5千焦」 would lex
    // as 5, then the *number* 1000, then a stray 焦.
    expect(chinese.segment?.("焦耳")).toEqual(["焦耳"]);
    expect(chinese.segment?.("千焦")).toEqual(["千", "焦"]);
    expect(chinese.segment?.("兆焦")).toEqual(["兆", "焦"]);
    expect(chinese.numerals?.(["千"])?.value.toString()).toBe("1000");
    // The calorie family is the one where every member survives, which is why it
    // is the one that spells itself out. 大卡 is the everyday spoken word for the
    // food kilocalorie and is the member ICU takes apart, so it is absent rather
    // than listed as an alias that could never be reached.
    expect(chinese.segment?.("卡路里")).toEqual(["卡路里"]);
    expect(chinese.segment?.("千卡")).toEqual(["千卡"]);
    expect(chinese.segment?.("大卡")).toEqual(["大", "卡"]);
    // The watt-hour family: even 千瓦时, which China bills its electricity in, is
    // cut into 千瓦 + 时 — and 千瓦 is `@smartput/power`'s kilowatt.
    expect(chinese.segment?.("千瓦时")).toEqual(["千瓦", "时"]);
    const claimed = Object.values(energyZh.units).flatMap((w) => [...w.aliases]);
    for (const broken of ["千焦", "兆焦", "大卡", "千瓦时", "瓦时", "英热单位"]) {
      expect(claimed, `${broken} is claimed but unreachable`).not.toContain(broken);
    }
    // 度 is the colloquial Chinese kilowatt-hour and is left unclaimed anyway: it
    // is the measure word for temperature and angle first, and 「30度」 is a
    // summer afternoon in Beijing before it is ever an electricity bill.
    expect(claimed).not.toContain("度");
  });

  test("every Chinese alias and form survives the segmenter whole", () => {
    // The check no Latin-script language in this repo needs, and the one that
    // decides what a `zh` vocabulary may contain. Chinese is unspaced, so `lex`
    // hands each letter run to `chinese.segment` before anything is looked up: a
    // word ICU breaks never reaches the alias index as one token, however
    // faithfully it is written here. 卡路里 and 千卡 are the load-bearing cases,
    // since they are *printed* strings and not merely read ones.
    for (const [unit, words] of Object.entries(energyZh.units)) {
      for (const surface of [...words.aliases, ...Object.values(words.forms ?? {})]) {
        if (!HAN.test(surface)) continue;
        expect(chinese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [energy])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Chinese folds every count into `other`, which is the claim
    // worth sampling rather than assuming: if `selectForm` ever grows a second
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [energy], { counts: COUNTS }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Chinese energy", () => {
    // Han in, Han out, and nothing between the number and the label:
    // `chinese.renderQuantity` closes the gap on every branch, which is how
    // 「200卡路里」 is written on any Chinese page.
    expect(engine.evaluate("200卡路里").formatted).toBe("200卡路里");
    expect(engine.evaluate("500千卡").formatted).toBe("500千卡");
    // Latin in, Chinese out: "kcal" is an alias from `units.ts` and the form
    // outranks the symbol in `renderQuantity`.
    expect(engine.evaluate("300 kcal").formatted).toBe("300千卡");
    // The joule family goes the other way — 焦耳 is read and the symbol is
    // printed, because its prefixed siblings could not be read at all.
    expect(engine.evaluate("5焦耳").formatted).toBe("5J");
    // A conversion through the particle 到 and through the verb 换算, the second
    // landing on a fraction. The group separator is "," and the decimal mark ".",
    // read from CLDR through `numberFormat: "intl"` rather than transcribed.
    expect(engine.evaluate("2千卡到卡路里").formatted).toBe("2,000卡路里");
    expect(engine.evaluate("500卡路里换算千卡").formatted).toBe("0.5千卡");
    // A sum landing on a fraction. The operands are spaced, which finding 2 in
    // the language notes requires: `lex` appends a letter run's trailing digits
    // to the last segmented word, so 「1千卡加500卡路里」 would swallow the 500
    // into the operator 加.
    expect(engine.evaluate("1千卡 + 500卡路里").formatted).toBe("1.5千卡");
    // The Han numerals, this language's other unusual half.
    expect(engine.evaluate("二十卡路里").formatted).toBe("20卡路里");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "200卡路里",
      "500千卡",
      "300 kcal",
      "5焦耳",
      "2千卡到卡路里",
      "1千卡 + 500卡路里",
      "二十卡路里",
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
