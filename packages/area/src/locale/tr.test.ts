import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaTr from "./tr";

const engine = () =>
  createEngine({
    locales: [composeLocale(turkish, [areaTr])],
    kinds: [area],
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
    kind: "area",
    unit,
    slot,
  });
  return (areaTr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Turkish word", () => {
    // Two sweeps, because neither alone is enough for a language written in a
    // Latin alphabet. The first is the script check the Cyrillic and CJK files
    // do, narrowed to the six letters Turkish added to the Latin alphabet. The
    // second names the Turkish words that are pure ASCII and so invisible to the
    // first, each unreachable inside an English alias: `hektar` is not
    // `hectare`, `akre` is not `acre`, and `metrekare` appears nowhere near a
    // kind that holds only `m2` and `m²`.
    expect(JSON.stringify(area)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    expect(JSON.stringify(area)).not.toMatch(/metrekare|hektar|akre/i);
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
            kind: "area",
            unit: "m2",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // Every unit, with no exception list — which is the claim this file makes
    // against `en`, `uk`, `nl` and `id`, all of which leave the three squared
    // units wordless because their name for the concept is a phrase.
    for (const [unit, words] of Object.entries(areaTr.units)) {
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
    // It matters most on the three squared units. A suffix stripper removes
    // endings and can never remove `kare` from the front of nothing, so if
    // `metrekare` were printed without being listed there would be no morphology
    // to rescue it at a penalty — the word would simply have no reading.
    for (const [unit, words] of Object.entries(areaTr.units)) {
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

  test("the squared units are one token, which is what lets them have words", () => {
    // The reason `en` and `uk` refuse a table here is not that the unit is
    // unspeakable; it is that "square metres" is a *phrase*, `lex` ends a word
    // token at a space, and `assertLocaleContract` fails a printed phrase by
    // name. Turkish closes the space up, so the check that fails those languages
    // is the one this vocabulary passes.
    for (const [unit, words] of Object.entries(areaTr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(form, `${unit} ${key}`).not.toMatch(/\s/u);
      }
    }
    expect(areaTr.units.m2?.forms?.other).toBe("metrekare");
    expect(areaTr.units.km2?.forms?.other).toBe("kilometrekare");
  });

  test("`dönüm` is left unclaimed rather than pointed at the nearest unit", () => {
    // The modern Turkish `dönüm` is exactly 1000 m², a decare, and it is the
    // unit a Turkish reader is likeliest to type in this kind. This kind
    // declares no 1000 m² unit, so aiming it at the hectare would answer ten
    // times the truth and at the acre four times. A refusal says "this engine
    // does not know dönüm"; a tenfold error says nothing at all.
    for (const words of Object.values(areaTr.units)) {
      expect(words.aliases).not.toContain("dönüm");
      expect(words.aliases).not.toContain("donum");
    }
    expect(() => engine().evaluate("5 dönüm")).toThrow();
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [areaTr]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Turkish that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [areaTr]), [area], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    for (const unit of ["m2", "cm2", "km2", "hectare", "acre"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative and
      // Turkish deliberately does not — see the vocabulary's header.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("m2", 100)).toBe("metrekare");
    expect(word("hectare", 2)).toBe("hektar");
    expect(word("acre", 5)).toBe("akre");
  });

  test("an engine built from it reads and writes Turkish area", () => {
    const e = engine();
    // The way a Turkish flat is measured, and the whole point of this file.
    expect(e.evaluate("100 metrekare").formatted).toBe("100 metrekare");
    expect(e.evaluate("1,5 metrekare").formatted).toBe("1,5 metrekare");
    expect(e.evaluate("2 hektar").formatted).toBe("2 hektar");
    expect(e.evaluate("5 akre").formatted).toBe("5 akre");
    // The superscripts `units.ts` declares still read, and answer in Turkish.
    expect(e.evaluate("100 m²").formatted).toBe("100 metrekare");
    expect(e.evaluate("2 ha").formatted).toBe("2 hektar");
    // A sum landing on a fraction, across two units.
    expect(e.evaluate("1 metrekare artı 5000 santimetrekare").formatted).toBe(
      "1,5 metrekare",
    );
    // The conversion verb in both spellings, and English's `to`, which
    // `buildKeywords` folds into the same entry. The group separator is "." —
    // the exact inverse of English's pair.
    expect(e.evaluate("1 hektar çevir metrekare").formatted).toBe("10.000 metrekare");
    expect(e.evaluate("1 hektar cevir metrekare").formatted).toBe("10.000 metrekare");
    expect(e.evaluate("1 hektar to metrekare").formatted).toBe("10.000 metrekare");
    expect(e.evaluate("5000 metrekare çevir hektar").formatted).toBe("0,5 hektar");
    // The remaining word operators.
    expect(e.evaluate("10 hektar eksi 4 hektar").formatted).toBe("6 hektar");
    expect(e.evaluate("10 metrekare çarpı 2").formatted).toBe("20 metrekare");
    expect(e.evaluate("10 metrekare bölü 4").formatted).toBe("2,5 metrekare");
  });

  test("agglutination reaches these nouns without a word for every ending", () => {
    // Vowel harmony on a compound stem: `metrekare` ends in a front vowel, so
    // the dative is `-ye` and the locative `-de`, where `hektar` ends in a back
    // one and takes `-a` and `-da`. `@smartput/core/locale/tr` enumerates every
    // variant because a flat stripper cannot express the rule.
    const e = engine();
    expect(e.evaluate("100 metrekareye").formatted).toBe("100 metrekare");
    expect(e.evaluate("100 metrekarede").formatted).toBe("100 metrekare");
    expect(e.evaluate("2 hektara").formatted).toBe("2 hektar");
    expect(e.evaluate("2 hektardan").formatted).toBe("2 hektar");
    expect(e.evaluate("5 akreler").formatted).toBe("5 akre");
  });

  test("the dotted and dotless i, from both keyboards", () => {
    // `"KILOMETREKARE"` lowercases to `"kılometrekare"` under Turkish rules and
    // to `"kilometrekare"` under everything else, so the language offers both
    // readings — the Turkish one at weight 0 and the ASCII keyboard's at −1 —
    // and this vocabulary is spelled entirely in lowercase so that neither fold
    // can miss it.
    const e = engine();
    expect(e.evaluate("3 KİLOMETREKARE").formatted).toBe("3 kilometrekare");
    expect(e.evaluate("3 KILOMETREKARE").formatted).toBe("3 kilometrekare");
    expect(e.evaluate("3 Kilometrekare").formatted).toBe("3 kilometrekare");
    for (const words of Object.values(areaTr.units)) {
      for (const alias of words.aliases) {
        expect(alias, `${alias} is not lowercase`).toBe(alias.toLowerCase());
      }
    }
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `tr`
    // groups with "." and the lexer reads that back as a group separator, so
    // "10.000 metrekare" is 10000 m² and not 10.
    const e = engine();
    for (const input of [
      "100 metrekare",
      "1 metrekare artı 5000 santimetrekare",
      "1 hektar çevir metrekare",
      "5000 metrekare çevir hektar",
      "5 akre",
      "100 m²",
      "10 metrekare bölü 4",
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
