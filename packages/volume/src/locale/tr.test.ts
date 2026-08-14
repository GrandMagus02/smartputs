import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeTr from "./tr";

const engine = () =>
  createEngine({
    locales: [composeLocale(turkish, [volumeTr])],
    kinds: [volume],
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
    kind: "volume",
    unit,
    slot,
  });
  return (volumeTr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Turkish word", () => {
    // Two sweeps, because neither alone is enough for a language written in a
    // Latin alphabet. The first is the script check the Cyrillic and CJK files
    // do, narrowed to the six letters Turkish added to the Latin alphabet — it
    // is what catches `metreküp`. The second names the Turkish words that are
    // pure ASCII and so invisible to the first, each unreachable inside an
    // English alias: `mililitre` has one `l` where `millilitre` has two, and
    // `galon` has one where `gallon` has two.
    expect(JSON.stringify(volume)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    expect(JSON.stringify(volume)).not.toMatch(/mililitre|galon/i);
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
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // Every unit, with no exception list — which is the claim this file makes
    // against `en`, `uk`, `nl` and `id`, all of which leave `m3` wordless
    // because their name for the concept is a phrase.
    for (const [unit, words] of Object.entries(volumeTr.units)) {
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
    // It matters most on `m3`. A suffix stripper removes endings and can never
    // remove `küp` from the front of nothing, so if `metreküp` were printed
    // without being listed there would be no morphology to rescue it at a
    // penalty — the word would simply have no reading.
    for (const [unit, words] of Object.entries(volumeTr.units)) {
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

  test("`metreküp` is one token, which is what lets it have words", () => {
    // The reason `en`, `uk`, `nl` and `id` refuse a table here is not that the
    // unit is unspeakable; it is that "cubic metres" is a *phrase*, `lex` ends a
    // word token at a space, and `assertLocaleContract` fails a printed phrase
    // by name. Turkish closes the space up, so the check that fails those
    // languages is the one this vocabulary passes.
    for (const [unit, words] of Object.entries(volumeTr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(form, `${unit} ${key}`).not.toMatch(/\s/u);
      }
    }
    expect(volumeTr.units.m3?.forms?.other).toBe("metreküp");
    expect(engine().evaluate("5 metreküp").value.unit).toBe("m3");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [volumeTr]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Turkish that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [volumeTr]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    for (const unit of ["l", "ml", "m3", "gal", "pint"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative and
      // Turkish deliberately does not — see the vocabulary's header.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("l", 5)).toBe("litre");
    expect(word("ml", 500)).toBe("mililitre");
    expect(word("m3", 2)).toBe("metreküp");
    expect(word("gal", 3)).toBe("galon");
  });

  test("`lt` reads and `l` prints, which are separate decisions", () => {
    // TDK sanctions the SI `l` and that is the symbol; a Turkish price tag or a
    // jerry can says "5 lt" often enough that a reader will type it. Reading is
    // many-to-one and only printing has to round-trip.
    expect(volumeTr.units.l?.symbol).toBe("l");
    expect(volumeTr.units.l?.aliases).toContain("lt");
    expect(engine().evaluate("5 lt").value.unit).toBe("l");
    expect(engine().evaluate("5 lt").formatted).toBe("5 litre");
  });

  test("an engine built from it reads and writes Turkish volume", () => {
    const e = engine();
    // The decimal comma comes from CLDR through `numberFormat: "intl"`, and the
    // noun does not move.
    expect(e.evaluate("1,5 litre").formatted).toBe("1,5 litre");
    expect(e.evaluate("1 litre").formatted).toBe("1 litre");
    expect(e.evaluate("5 litre").formatted).toBe("5 litre");
    expect(e.evaluate("2 metreküp").formatted).toBe("2 metreküp");
    expect(e.evaluate("500 mililitre").value.unit).toBe("ml");
    expect(e.evaluate("2 galon").formatted).toBe("2 galon");
    expect(e.evaluate("1 pint").formatted).toBe("1 pint");
    // A sum landing on a fraction, across two units.
    expect(e.evaluate("1 litre artı 500 mililitre").formatted).toBe("1,5 litre");
    // The conversion verb in both spellings, and English's `to`, which
    // `buildKeywords` folds into the same entry. The group separator is "." —
    // the exact inverse of English's pair.
    expect(e.evaluate("2 metreküp çevir litre").formatted).toBe("2.000 litre");
    expect(e.evaluate("2 metreküp cevir litre").formatted).toBe("2.000 litre");
    expect(e.evaluate("2 metreküp to litre").formatted).toBe("2.000 litre");
    expect(e.evaluate("500 mililitre çevir litre").formatted).toBe("0,5 litre");
    // The remaining word operators.
    expect(e.evaluate("10 litre eksi 4 litre").formatted).toBe("6 litre");
    expect(e.evaluate("10 litre çarpı 2").formatted).toBe("20 litre");
    expect(e.evaluate("10 litre bölü 4").formatted).toBe("2,5 litre");
  });

  test("agglutination reaches these nouns without a word for every ending", () => {
    // Two alternations at once. Vowel harmony picks `-ye` after `litre`'s front
    // vowel and `-a` after `galon`'s back one; consonant hardening turns the
    // locative `-de` into `-te` after `metreküp`'s voiceless `p`.
    // `@smartput/core/locale/tr` enumerates every variant because a flat
    // stripper cannot express either rule.
    const e = engine();
    expect(e.evaluate("5 litreye").formatted).toBe("5 litre");
    expect(e.evaluate("5 litreden").formatted).toBe("5 litre");
    expect(e.evaluate("2 metreküpte").formatted).toBe("2 metreküp");
    expect(e.evaluate("2 galona").formatted).toBe("2 galon");
    expect(e.evaluate("5 litreler").formatted).toBe("5 litre");
  });

  test("the dotted and dotless i, from both keyboards", () => {
    // `"LITRE"` lowercases to `"lıtre"` under Turkish rules and to `"litre"`
    // under everything else, so the language offers both readings — the Turkish
    // one at weight 0 and the ASCII keyboard's at −1 — and this vocabulary is
    // spelled entirely in lowercase so that neither fold can miss it.
    const e = engine();
    expect(e.evaluate("5 LİTRE").formatted).toBe("5 litre");
    expect(e.evaluate("5 LITRE").formatted).toBe("5 litre");
    expect(e.evaluate("5 Litre").formatted).toBe("5 litre");
    // Caps and a case ending at once, which reaches the alias only because the
    // language re-runs the stripper over each folded variant.
    expect(e.evaluate("5 LİTREYE").formatted).toBe("5 litre");
    expect(e.evaluate("5 LITREYE").formatted).toBe("5 litre");
    // The umlaut is this file's business rather than the language's: the case
    // folds reach the two i's and stop there, so `metrekup` is listed as an
    // alias. It would resolve without one — a single ü → u substitution is
    // inside the corrector's budget — and the row is here to pin that it
    // resolves at full weight instead, with no `FuzzyMatch` on the reading.
    expect(e.evaluate("2 metrekup").formatted).toBe("2 metreküp");
    expect(e.evaluate("2 metrekup").confidence).toBe(e.evaluate("2 metreküp").confidence);
    for (const words of Object.values(volumeTr.units)) {
      for (const alias of words.aliases) {
        expect(alias, `${alias} is not lowercase`).toBe(alias.toLowerCase());
      }
    }
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `tr`
    // groups with "." and the lexer reads that back as a group separator, so
    // "2.000 litre" is 2000 l and not 2.
    const e = engine();
    for (const input of [
      "1,5 litre",
      "1 litre artı 500 mililitre",
      "2 metreküp çevir litre",
      "500 mililitre çevir litre",
      "2 galon",
      "1 pint",
      "10 litre bölü 4",
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
