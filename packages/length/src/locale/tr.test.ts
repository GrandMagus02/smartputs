import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthTr from "./tr";

const engine = () =>
  createEngine({
    locales: [composeLocale(turkish, [lengthTr])],
    kinds: [length],
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
    kind: "length",
    unit,
    slot,
  });
  return (lengthTr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Turkish word", () => {
    // Two sweeps, because neither alone is enough for a language written in a
    // Latin alphabet. The first is the script check the Cyrillic and CJK files
    // do, narrowed to the six letters Turkish added to the Latin alphabet — any
    // of them reaching the kind means a word did, and `inç` is caught here. The
    // second names the Turkish words that are pure ASCII and so invisible to the
    // first, each bounded so an English alias cannot match it: `santimetre` is
    // not `centimetre`, and `\bfit\b` and `\bmil\b` cannot be reached inside
    // `feet` or `millimetre`.
    expect(JSON.stringify(length)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    expect(JSON.stringify(length)).not.toMatch(/santimetre|yarda|\bfit\b|\bmil\b/i);
  });

  test("`in` is left to the conversion keyword here too", () => {
    // Turkish's own conversion keyword is the verb `çevir`, not `in`, so nothing
    // in a tr-only engine's lexer would shadow the alias. It is left out because
    // `registry.aliasIndex` is one flat map that `isUnitAlias` reads without a
    // locale, so a Turkish entry for `in` would put it back in front of
    // `@smartput/datetime`'s accept-gate for any engine that also speaks
    // English. See the vocabulary's own comment.
    for (const words of Object.values(lengthTr.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthTr.units.in?.aliases).toContain("inç");
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
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(lengthTr.units)) {
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
    // 5 says a printed form must be one the vocabulary reads outright, and a
    // word rescued only by morphology is the bug it exists to catch.
    for (const [unit, words] of Object.entries(lengthTr.units)) {
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
      assertLocaleContract(composeLocale(turkish, [lengthTr]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Turkish that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [lengthTr]), [length], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
    // And no `skipPrintable` waiver, which English needs for exactly this kind:
    // its inch prints the symbol `in`, which `lex` emits as a keyword token. The
    // Turkish inch prints `inç`, an ordinary word, so the waiver has nothing to
    // cover.
  });

  test("nothing moves the noun, on any axis", () => {
    for (const unit of ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative.
      // Turkish genuinely says "metreye çevir" here and still gets one row; see
      // the vocabulary's header for why the axis was rejected rather than
      // forgotten.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("m", 5)).toBe("metre");
    expect(word("cm", 100)).toBe("santimetre");
    expect(word("in", 36)).toBe("inç");
    expect(word("ft", 3)).toBe("fit");
  });

  test("`ayak` is not the foot, and `mil` is only the statute mile", () => {
    // `ayak` is first the body part, then the leg, then a stair tread; a bare
    // `ayak` is not a quantity, so the vocabulary claims the borrowed `fit`
    // instead. The nautical mile is `deniz mili` — two words, and `lex` ends a
    // word token at a space — so it is unlistable regardless, and this kind has
    // no unit for it either way.
    for (const words of Object.values(lengthTr.units)) {
      expect(words.aliases).not.toContain("ayak");
    }
    const e = engine();
    expect(() => e.evaluate("3 ayak")).toThrow();
    expect(e.evaluate("1 mil").value.unit).toBe("mi");
  });

  test("an engine built from it reads and writes Turkish length", () => {
    const e = engine();
    // The decimal comma comes from CLDR through `numberFormat: "intl"`, and the
    // noun does not move.
    expect(e.evaluate("1,5 metre").formatted).toBe("1,5 metre");
    expect(e.evaluate("1 metre").formatted).toBe("1 metre");
    expect(e.evaluate("5 metre").formatted).toBe("5 metre");
    expect(e.evaluate("36 inç").formatted).toBe("36 inç");
    expect(e.evaluate("3 fit").formatted).toBe("3 fit");
    expect(e.evaluate("2 yarda").formatted).toBe("2 yarda");
    // A sum landing on a fraction, across two units.
    expect(e.evaluate("1 metre artı 50 santimetre").formatted).toBe("1,5 metre");
    // The conversion verb in both spellings, and English's `to`, which
    // `buildKeywords` folds into the same entry. The group separator is "." —
    // the exact inverse of English's pair.
    expect(e.evaluate("1 kilometre çevir metre").formatted).toBe("1.000 metre");
    expect(e.evaluate("1 kilometre cevir metre").formatted).toBe("1.000 metre");
    expect(e.evaluate("1 kilometre to metre").formatted).toBe("1.000 metre");
    expect(e.evaluate("50 santimetre çevir metre").formatted).toBe("0,5 metre");
    // The remaining word operators.
    expect(e.evaluate("10 metre eksi 2 metre").formatted).toBe("8 metre");
    expect(e.evaluate("10 metre çarpı 2").formatted).toBe("20 metre");
    expect(e.evaluate("10 metre bölü 4").formatted).toBe("2,5 metre");
    // Turkish cardinals, read by the *shared* fold — Turkish needed no parser of
    // its own, unlike German and French.
    expect(e.evaluate("yirmi iki metre").formatted).toBe("22 metre");
    expect(e.evaluate("iki bin metre").formatted).toBe("2.000 metre");
  });

  test("agglutination reaches these nouns without a word for every ending", () => {
    // What the vocabulary does not list and does not have to. The point of the
    // pair below is vowel harmony: the dative is `-ye` after `metre`'s front
    // vowel and `-a` after `kilogram`'s back one, and the locative is `-de`
    // beside `-da`. `@smartput/core/locale/tr` enumerates every variant because
    // a flat stripper cannot express the rule, and this is that list at work on
    // real Turkish words.
    const e = engine();
    expect(e.evaluate("10 metreye").formatted).toBe("10 metre");
    expect(e.evaluate("10 metrede").formatted).toBe("10 metre");
    expect(e.evaluate("10 kilometreden").formatted).toBe("10 kilometre");
    expect(e.evaluate("10 santimetrede").formatted).toBe("10 santimetre");
    expect(e.evaluate("10 metreler").formatted).toBe("10 metre");
  });

  test("the dotted and dotless i, from both keyboards", () => {
    // The one thing about Turkish no other language here has. `"KILOMETRE"`
    // lowercases to `"kılometre"` under Turkish rules and to `"kilometre"` under
    // everything else, so the language offers both readings — the Turkish one at
    // weight 0 and the ASCII keyboard's at −1 — and this vocabulary is spelled
    // entirely in lowercase so that neither fold can miss it.
    const e = engine();
    expect(e.evaluate("10 KİLOMETRE").formatted).toBe("10 kilometre");
    expect(e.evaluate("10 KILOMETRE").formatted).toBe("10 kilometre");
    expect(e.evaluate("10 Kilometre").formatted).toBe("10 kilometre");
    // Caps and a case ending at once, which reaches the alias only because the
    // language re-runs the stripper over each folded variant.
    expect(e.evaluate("10 KİLOMETREYE").formatted).toBe("10 kilometre");
    expect(e.evaluate("10 KILOMETREYE").formatted).toBe("10 kilometre");
    // The inch is the sharpest case: `inç` has a dotted `i` at the front and a
    // `ç` at the back, so an all-caps `İNÇ` moves on both axes at once.
    expect(e.evaluate("36 İNÇ").formatted).toBe("36 inç");
    // The cedilla is the vocabulary's business and not the language's: the case
    // folds reach the two i's and stop there, so `inc` is an alias rather than
    // a fold. It is not reachable without one — the corrector sees `inç`, `inch`
    // and `min` all one edit away and refuses to choose — which is why this row
    // is an assertion rather than a note.
    expect(e.evaluate("36 inc").formatted).toBe("36 inç");
    expect(e.evaluate("36 INC").formatted).toBe("36 inç");
    // And the vocabulary's own half of that arrangement.
    for (const words of Object.values(lengthTr.units)) {
      for (const alias of words.aliases) {
        expect(alias, `${alias} is not lowercase`).toBe(alias.toLowerCase());
      }
    }
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `tr`
    // groups with "." and the lexer reads that back as a group separator, so
    // "1.000 metre" is 1000 m and not 1.
    const e = engine();
    for (const input of [
      "1,5 metre",
      "1 metre artı 50 santimetre",
      "1 kilometre çevir metre",
      "50 santimetre çevir metre",
      "36 inç",
      "3 fit",
      "2 yarda",
      "1 mil",
      "10 metre bölü 4",
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
