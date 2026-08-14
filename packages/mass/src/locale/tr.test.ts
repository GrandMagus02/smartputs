import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massTr from "./tr";

const engine = () =>
  createEngine({
    locales: [composeLocale(turkish, [massTr])],
    kinds: [mass],
  });

/** The only key `turkish.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = turkish.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massTr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Turkish word", () => {
    // Two sweeps, because neither alone is enough for a language written in a
    // Latin alphabet. The first is the script check the Cyrillic and CJK files
    // do, narrowed to the six letters Turkish added to the Latin alphabet — any
    // of them reaching the kind means a word did. The second names the three
    // Turkish words that are pure ASCII and so invisible to the first, each
    // chosen to be unreachable inside an English alias: `miligram` has one `l`
    // where `milligram` has two, and `ons` and `libre` are bounded so `ounce`
    // and `pound` cannot match them.
    expect(JSON.stringify(mass)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    expect(JSON.stringify(mass)).not.toMatch(/miligram|\bons\b|\blibre\b/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `turkish.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean something
    // (rule 6). The counts deliberately include the shapes that move every other
    // language here — 1, the 2/5/11/21 Slavic boundaries, a fraction, and zero —
    // and none of them moves Turkish.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 11, 21, 100, 1000]) {
        produced.add(
          turkish.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // Every unit, with no exception list: this vocabulary has a Turkish noun for
    // all six, so a missing table would be an unfinished file rather than a
    // decision.
    for (const [unit, words] of Object.entries(massTr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs: Turkish
    // capitalises no common noun, so the string this table prints is the string
    // `buildRegistry` indexes. That is a decision and not an accident — the
    // registry folds an alias key with `toLocaleLowerCase("tr")`, under which a
    // capital `I` becomes `ı` rather than `i`, so a capital in this table would
    // be indexed under a different letter than the reader typed.
    //
    // Turkish does have a suffix stripper behind these aliases, so a forgotten
    // form would often still be *reachable* at a −2 penalty. That is exactly why
    // this check compares against `aliases` rather than asking the engine: rule
    // 5 says a printed form must be a form the vocabulary reads outright, and a
    // word rescued only by morphology is the bug it exists to catch.
    for (const [unit, words] of Object.entries(massTr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
      expect(words.aliases, `${unit} prints symbol ${words.symbol}`).toContain(
        words.symbol as string,
      );
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [massTr]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Turkish that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [massTr]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // The one-key contract seen from the vocabulary side: one string per unit is
    // the language and not an unfinished table. English marks number always,
    // German marks it on the feminine units, Ukrainian marks number and case at
    // once, and Turkish marks nothing — "beş kilogramlar" is a mistake, not a
    // plural.
    for (const unit of ["mg", "g", "kg", "t", "oz", "lb"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative and
      // Turkish deliberately does not — see the vocabulary's header.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("kg", 5)).toBe("kilogram");
    expect(word("mg", 500)).toBe("miligram");
    expect(word("t", 2)).toBe("ton");
    expect(word("lb", 3)).toBe("libre");
  });

  test("`dönüm`'s counterpart here: `ons` is claimed, and the troy reading is not", () => {
    // TDK's headword for `ons` is the avoirdupois ounce this kind holds, which
    // is the whole difference from `@smartput/mass/locale/id`, where the
    // inherited word means one hectogram and had to be refused. What remains is
    // the gold market's troy ounce, 31.1 g against 28.35 — and this kind
    // declares no troy unit for it to resolve to, so the dictionary reading is
    // the one claimed.
    expect(engine().evaluate("2 ons").value.unit).toBe("oz");
    expect(engine().evaluate("2 ons").value.canonical.toString()).toBe("56.69904625");
  });

  test("an engine built from it reads and writes Turkish mass", () => {
    const e = engine();
    // The decimal comma comes from CLDR through `numberFormat: "intl"`, and the
    // noun does not move.
    expect(e.evaluate("1,5 kg").formatted).toBe("1,5 kilogram");
    expect(e.evaluate("1 kilogram").formatted).toBe("1 kilogram");
    expect(e.evaluate("5 kilogram").formatted).toBe("5 kilogram");
    expect(e.evaluate("2 ton").formatted).toBe("2 ton");
    expect(e.evaluate("500 miligram").value.unit).toBe("mg");
    // The colloquial clipping, which `units.ts` already declares and Turkish
    // uses unchanged: "iki kilo domates".
    expect(e.evaluate("2 kilo").value.unit).toBe("kg");
    // A sum landing on a fraction.
    expect(e.evaluate("1 kg artı 500 g").formatted).toBe("1,5 kilogram");
    expect(e.evaluate("1 kg arti 500 g").formatted).toBe("1,5 kilogram");
    // The conversion verb in both spellings, and English's `to`, which
    // `buildKeywords` folds into the same entry. The group separator is "." —
    // the exact inverse of English's pair.
    expect(e.evaluate("2 kg çevir gram").formatted).toBe("2.000 gram");
    expect(e.evaluate("2 kg cevir gram").formatted).toBe("2.000 gram");
    expect(e.evaluate("2 kg to gram").formatted).toBe("2.000 gram");
    expect(e.evaluate("500 gram çevir kilogram").formatted).toBe("0,5 kilogram");
    // The remaining word operators, where the language's keyword table meets
    // this vocabulary's nouns.
    expect(e.evaluate("10 gram eksi 5 gram").formatted).toBe("5 gram");
    expect(e.evaluate("3 gram çarpı 2").formatted).toBe("6 gram");
    expect(e.evaluate("10 gram bölü 4").formatted).toBe("2,5 gram");
    // The two imperial nouns, printed in Turkish.
    expect(e.evaluate("3 ons").formatted).toBe("3 ons");
    expect(e.evaluate("3 pound").formatted).toBe("3 libre");
  });

  test("agglutination reaches these nouns without a word for every ending", () => {
    // What the vocabulary does not list and does not have to: Turkish glues a
    // case ending onto the noun, and the ending's shape is chosen by vowel
    // harmony from the last vowel of the stem — dative `-a` after `kilogram`'s
    // back vowel, `-e` after `metre`'s front one. `@smartput/core/locale/tr`
    // enumerates every harmonic variant because a flat stripper cannot express
    // the rule, and this is that list doing its job on real Turkish words.
    const e = engine();
    expect(e.evaluate("5 kilograma").formatted).toBe("5 kilogram");
    expect(e.evaluate("5 kilogramda").formatted).toBe("5 kilogram");
    expect(e.evaluate("500 gramdan").formatted).toBe("500 gram");
    // A three-letter stem, which is exactly `minStem`: `ton` survives the strip
    // where a floor of 4 would have lost it.
    expect(e.evaluate("2 tondan").formatted).toBe("2 ton");
    expect(e.evaluate("5 kilogramlar").formatted).toBe("5 kilogram");
  });

  test("the dotted and dotless i, from both keyboards", () => {
    // The one thing about Turkish no other language here has. `"KILOGRAM"`
    // lowercases to `"kılogram"` under Turkish rules and to `"kilogram"` under
    // everything else, so the language offers both readings — the Turkish one at
    // weight 0 and the ASCII keyboard's at −1 — and this vocabulary is spelled
    // entirely in lowercase so that neither fold can miss it.
    const e = engine();
    expect(e.evaluate("5 KİLOGRAM").formatted).toBe("5 kilogram");
    expect(e.evaluate("5 KILOGRAM").formatted).toBe("5 kilogram");
    expect(e.evaluate("5 Kilogram").formatted).toBe("5 kilogram");
    // Caps and a case ending at once, which reaches the alias only because the
    // language re-runs the stripper over each folded variant.
    expect(e.evaluate("5 KİLOGRAMA").formatted).toBe("5 kilogram");
    expect(e.evaluate("5 KILOGRAMA").formatted).toBe("5 kilogram");
    // And the vocabulary's own half of that arrangement.
    for (const words of Object.values(massTr.units)) {
      for (const alias of words.aliases) {
        expect(alias, `${alias} is not lowercase`).toBe(alias.toLowerCase());
      }
    }
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `tr`
    // groups with "." and the lexer reads that back as a group separator, so
    // "2.000 gram" is 2000 g and not 2.
    const e = engine();
    for (const input of [
      "1,5 kg",
      "1 kg artı 500 g",
      "2 kg çevir gram",
      "500 gram çevir kilogram",
      "3 ons",
      "3 pound",
      "10 gram bölü 4",
      "2 ton",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
    }
  });
});
