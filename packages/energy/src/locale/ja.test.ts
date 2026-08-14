import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { japanese } from "@smartput/core/locale/ja";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyJa from "./ja";

const locale = () => composeLocale(japanese, [energyJa]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

const SLOTS = ["bare", "after-number", "conversion-target"] as const;

/** Every key `japanese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000]
    .flatMap((count) =>
      SLOTS.map((slot) =>
        japanese.selectForm({
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
      SLOTS.map((slot) => japanese.selectForm({ kind: "energy", unit: "cal", slot })),
    ),
);

/** Han, Hiragana or Katakana — the three scripts Japanese is written in at once. */
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = japanese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyJa.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("energy ja vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyJa.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyJa.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Japanese word", () => {
    // The three scripts as a class rather than a list of the words: the kind is
    // ratios, unit ids, magnitude bands and four power/duration signatures, so
    // any Japanese character reaching it is the failure.
    expect(JSON.stringify(energy)).not.toMatch(JAPANESE);
  });

  test("every unit carries exactly the one key `japanese` can ask for", () => {
    // The contract the language author pinned: Japanese nouns do not inflect for
    // number, so every count and every slot — the fractional 1.5 and the
    // count-free conversion target included — come back "other". A table
    // translated from `en.ts` needs no key renamed, only its "one" row deleted.
    expect([...KEYS]).toEqual(["other"]);
    for (const [unit, words] of Object.entries(energyJa.units)) {
      if (words.forms === undefined) continue;
      expect(Object.keys(words.forms), `${unit}'s keys`).toEqual([...KEYS]);
    }
    // And the two units that carry it are the calorie family, the one family
    // here whose every member survives ICU's segmenter. The joule family and the
    // watt-hour family print symbols throughout rather than spell one member and
    // abbreviate the rest.
    const spelled = Object.entries(energyJa.units)
      .filter(([, words]) => words.forms !== undefined)
      .map(([unit]) => unit);
    expect(spelled.sort()).toEqual(["cal", "kcal"]);
  });

  test("one word covers every count", () => {
    // The whole of Japanese number agreement, in four assertions. English needs
    // "calorie" beside "calories" and Ukrainian needs four nominative rows and
    // four locative ones; Japanese needs one word, and the count-free
    // conversion target takes the same one.
    expect(word("cal", 1)).toBe("カロリー");
    expect(word("cal", 5)).toBe("カロリー");
    expect(word("cal", 1.5)).toBe("カロリー");
    expect(word("cal", undefined, "conversion-target")).toBe("カロリー");
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(energyJa.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("every Japanese alias and form survives the segmenter whole", () => {
    // The check no other language in this repo needs, and the one that decides
    // what a `ja` vocabulary may contain. Japanese is unspaced, so `lex` hands
    // each letter run to `japanese.segment` before anything is looked up: a word
    // ICU breaks never reaches the alias index as one token, however faithfully
    // it is written here.
    for (const [unit, words] of Object.entries(energyJa.units)) {
      for (const surface of [...words.aliases, ...Object.values(words.forms ?? {})]) {
        if (!JAPANESE.test(surface)) continue;
        expect(japanese.segment?.(surface), `${unit}: ICU splits "${surface}"`).toEqual([
          surface,
        ]);
      }
    }
  });

  test("the katakana energies ICU refuses, measured rather than remembered", () => {
    // Why the joule family is spelled nowhere and the watt-hour family only
    // half-readable. ICU's Japanese dictionary knows ジュール, カロリー,
    // キロカロリー and キロワット時, and cuts the rest at the SI prefix or at
    // the 時. Pinned so that a dictionary update showing up as a failing test is
    // the trigger to add a row here, rather than the gap going unnoticed.
    expect(japanese.segment?.("キロジュール")).toEqual(["キロ", "ジュール"]);
    expect(japanese.segment?.("メガジュール")).toEqual(["メガ", "ジュール"]);
    expect(japanese.segment?.("ワット時")).toEqual(["ワット", "時"]);
    expect(japanese.segment?.("メガワット時")).toEqual(["メガワット", "時"]);
    // 英熱量 is the gloss for a BTU rather than anything anyone types, and ICU
    // cuts it in two regardless — so `btu` keeps the Latin initialism alone.
    expect(japanese.segment?.("英熱量")).toEqual(["英", "熱量"]);
    const claimed = Object.values(energyJa.units).flatMap((w) => [...w.aliases]);
    for (const dead of ["キロジュール", "メガジュール", "ワット時", "メガワット時"]) {
      expect(claimed, `"${dead}" is claimed but unreachable`).not.toContain(dead);
    }
    // The one that does survive is read and never printed: its two siblings
    // cannot match it, and a family prints one register throughout.
    expect(energyJa.units.kwh?.aliases).toContain("キロワット時");
    expect(energyJa.units.kwh?.forms).toBeUndefined();
    expect(energyJa.units.kwh?.symbol).toBe("kWh");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [energy])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Japanese folds every count into `other`, which is the
    // claim worth sampling rather than assuming: if `selectForm` ever grows a
    // second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Japanese energy", () => {
    // The spelled family, with nothing between the number and the word:
    // `japanese.renderQuantity` closes the gap on every branch, so the word is
    // set as tightly as the symbol.
    expect(engine.evaluate("200キロカロリー").formatted).toBe("200キロカロリー");
    // The symbol families, where the SI spelling is what Japanese writes anyway.
    expect(engine.evaluate("1.5kJ").formatted).toBe("1.5kJ");
    expect(engine.evaluate("3ジュール").formatted).toBe("3J");
    // The watt-hour, and the one place Japanese has an easier time than
    // Ukrainian: "кВт·год" carries the SI interpunct and re-reads only as
    // `power × duration`, while "kWh" is one Latin run that is already an alias.
    expect(engine.evaluate("5キロワット時").formatted).toBe("5kWh");
    expect(engine.evaluate("1kWhをkJ").formatted).toBe("3,600kJ");
    // A conversion into the spelled family, through each particle the language
    // claims under `in`. Both mark the *source* and attach to the end of the
    // left operand, which is where a head-final language puts a particle and
    // where an infix operator has to be. The group separator is "," and the
    // decimal mark ".", read from CLDR rather than transcribed.
    expect(engine.evaluate("1kcalをカロリー").formatted).toBe("1,000カロリー");
    expect(engine.evaluate("1kcalからカロリー").formatted).toBe("1,000カロリー");
    // A sum landing on a fraction.
    expect(engine.evaluate("2キロカロリー + 500カロリー").formatted).toBe(
      "2.5キロカロリー",
    );
    // The kanji numerals, this language's other unusual half: 五百 is five
    // hundred, parsed by `japaneseNumerals` and not by any digit rule.
    expect(engine.evaluate("五百カロリー").formatted).toBe("500カロリー");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "200キロカロリー",
      "1.5kJ",
      "5キロワット時",
      "1kcalをカロリー",
      "2キロカロリー + 500カロリー",
      "1btu",
      "五百カロリー",
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
