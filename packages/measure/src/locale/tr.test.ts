import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureTr from "./tr";

const engine = () =>
  createEngine({
    locales: [composeLocale(turkish, [measureTr])],
    kinds: [measure],
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
    kind: "measure",
    unit,
    slot,
  });
  return (measureTr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Turkish word", () => {
    // Two sweeps, because neither alone is enough for a language written in a
    // Latin alphabet. The first is the script check the Cyrillic and CJK files
    // do, narrowed to the six letters Turkish added to the Latin alphabet — it
    // is what catches `inç`. The second names the Turkish words that are pure
    // ASCII and so invisible to the first, each unreachable inside an English
    // alias: `punto` is not `point`, `piksel` is not `pixel`, and `milimetre`
    // has one `l` where `millimetre` has two.
    expect(JSON.stringify(measure)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    expect(JSON.stringify(measure)).not.toMatch(/punto|piksel|milimetre|santimetre/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `turkish.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean something
    // (rule 6). The counts deliberately include the shapes that move every other
    // language here — 1, the 2/5/11/21 Slavic boundaries, a fraction, and zero —
    // and none of them moves Turkish. This is the kind where Dutch keeps a
    // measure rule and its exception side by side (`12 punt` measured out beside
    // `1920 pixels` counted); Turkish has no number axis for either.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 11, 21, 100, 1000]) {
        produced.add(
          turkish.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "measure",
            unit: "px",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(measureTr.units)) {
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
    for (const [unit, words] of Object.entries(measureTr.units)) {
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

  test("`pika` is the animal, so the pica keeps its English spelling", () => {
    // Turkish printing borrowed the word rather than nativising it, TDK carries
    // no headword for it, and the respelling Turkish orthography would produce
    // is a word Turkish already has for something else. So this unit adds no
    // word of its own — the decision it makes is only which inherited spelling
    // gets printed. This is `@smartput/measure/locale/id`'s ruling about the
    // same string, reached from a different alphabet.
    for (const words of Object.values(measureTr.units)) {
      expect(words.aliases).not.toContain("pika");
    }
    expect(measureTr.units.pc?.forms?.other).toBe("pica");
    expect(engine().evaluate("2 pica").formatted).toBe("2 pica");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [measureTr]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Turkish that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [measureTr]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    for (const unit of ["inch", "mm", "cm", "pt", "pc", "px"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative — it
      // is the kind where `@smartput/measure/locale/de` needs a cell for "in
      // Pixeln", and Turkish deliberately does not.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("px", 1920)).toBe("piksel");
    expect(word("pt", 12)).toBe("punto");
    expect(word("inch", 1)).toBe("inç");
  });

  test("an engine built from it reads and writes Turkish typographic measure", () => {
    const e = engine();
    expect(e.evaluate("12 punto").formatted).toBe("12 punto");
    expect(e.evaluate("1 inç").formatted).toBe("1 inç");
    expect(e.evaluate("10 milimetre").formatted).toBe("10 milimetre");
    // The group separator is "." — the exact inverse of English's pair.
    expect(e.evaluate("1920 piksel").formatted).toBe("1.920 piksel");
    // The English spellings `units.ts` declares still read, and answer in
    // Turkish.
    expect(e.evaluate("12 points").formatted).toBe("12 punto");
    expect(e.evaluate("1920 pixels").formatted).toBe("1.920 piksel");
    // A sum landing on a fraction, across two units: 36 points is half an inch.
    expect(e.evaluate("1 inç artı 36 punto").formatted).toBe("1,5 inç");
    // The conversion verb in both spellings, and English's `to`, which
    // `buildKeywords` folds into the same entry. `px` is the one dynamic ratio
    // in the repo and 96 dpi is its default.
    expect(e.evaluate("72 punto çevir inç").formatted).toBe("1 inç");
    expect(e.evaluate("72 punto cevir inç").formatted).toBe("1 inç");
    expect(e.evaluate("72 punto to inç").formatted).toBe("1 inç");
    expect(e.evaluate("96 piksel çevir inç").formatted).toBe("1 inç");
    expect(e.evaluate("1 inç çevir piksel").formatted).toBe("96 piksel");
    expect(e.evaluate("12 punto çevir pica").formatted).toBe("1 pica");
    // The remaining word operators.
    expect(e.evaluate("20 punto eksi 8 punto").formatted).toBe("12 punto");
    expect(e.evaluate("12 punto çarpı 2").formatted).toBe("24 punto");
    expect(e.evaluate("10 punto bölü 4").formatted).toBe("2,5 punto");
  });

  test("agglutination reaches these nouns without a word for every ending", () => {
    // Vowel harmony: `punto` ends in a back vowel and takes `-ya`/`-da`,
    // `piksel` ends in a front one and takes `-e`/`-de`.
    // `@smartput/core/locale/tr` enumerates every variant because a flat
    // stripper cannot express the rule.
    const e = engine();
    expect(e.evaluate("12 puntoya").formatted).toBe("12 punto");
    expect(e.evaluate("12 puntoda").formatted).toBe("12 punto");
    expect(e.evaluate("1920 piksele").formatted).toBe("1.920 piksel");
    expect(e.evaluate("1920 pikselden").formatted).toBe("1.920 piksel");
    expect(e.evaluate("12 puntolar").formatted).toBe("12 punto");
  });

  test("the dotted and dotless i, from both keyboards", () => {
    // The kind where this matters most in practice: `PX` and `PT` are how a spec
    // sheet sets them, and `"PIKSEL"` lowercases to `"pıksel"` under Turkish
    // rules and to `"piksel"` under everything else. The language offers both
    // readings — the Turkish one at weight 0 and the ASCII keyboard's at −1 —
    // and this vocabulary is spelled entirely in lowercase so that neither fold
    // can miss it.
    const e = engine();
    expect(e.evaluate("1920 PİKSEL").formatted).toBe("1.920 piksel");
    expect(e.evaluate("1920 PIKSEL").formatted).toBe("1.920 piksel");
    expect(e.evaluate("1920 Piksel").formatted).toBe("1.920 piksel");
    // `inç` moves on both axes at once: a dotted `i` at the front, a `ç` at the
    // back.
    expect(e.evaluate("1 İNÇ").formatted).toBe("1 inç");
    // The cedilla is this file's business rather than the language's — the case
    // folds reach the two i's and stop there — so `inc` is an alias and not a
    // fold, and these two rows are what say so.
    expect(e.evaluate("1 inc").formatted).toBe("1 inç");
    expect(e.evaluate("1 INC").formatted).toBe("1 inç");
    // Caps and a case ending at once, which reaches the alias only because the
    // language re-runs the stripper over each folded variant.
    expect(e.evaluate("1920 PİKSELE").formatted).toBe("1.920 piksel");
    expect(e.evaluate("1920 PIKSELE").formatted).toBe("1.920 piksel");
    for (const words of Object.values(measureTr.units)) {
      for (const alias of words.aliases) {
        expect(alias, `${alias} is not lowercase`).toBe(alias.toLowerCase());
      }
    }
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `tr`
    // groups with "." and the lexer reads that back as a group separator, so
    // "1.920 piksel" is 1920 px and not 1,92.
    const e = engine();
    for (const input of [
      "12 punto",
      "1920 piksel",
      "1 inç artı 36 punto",
      "72 punto çevir inç",
      "96 piksel çevir inç",
      "1 inç çevir piksel",
      "2 pica",
      "10 punto bölü 4",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      // Compared at 20 decimals rather than digit for digit, exactly as
      // `de.test.ts` and `nl.test.ts` compare them: this kind's canonical is the
      // inch and four of its six ratios are non-terminating fractions written
      // out to 30 digits (5/127, 50/127, 1/72, 1/6), so re-reading a printed
      // point count rounds in the last of the 28 configured digits. That is the
      // kind's arithmetic and not the language's — the mass, length, area and
      // volume round trips beside this one are exact.
      expect(again.value.canonical.toFixed(20), input).toBe(
        first.value.canonical.toFixed(20),
      );
    }
  });
});
