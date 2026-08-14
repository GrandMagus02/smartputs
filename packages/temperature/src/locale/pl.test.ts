import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperaturePl from "./pl";

const [readingPl, deltaPl] = temperaturePl;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(polish, temperaturePl);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/**
 * Anything only Polish would write. Polish shares the Latin alphabet, so — unlike
 * Ukrainian's Cyrillic range — this cannot on its own prove that no Polish word
 * leaked into the language-free half, and the test that uses it greps for the
 * scale names as well.
 */
const POLISH = /[ąćęłńóśźż]/i;

describe("temperature pl vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperaturePl.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperaturePl) expect(vocabulary.locale).toBe("pl");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingPl?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaPl?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperaturePl) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.length,
          `${vocabulary.kind}:${unit} has no aliases`,
        ).toBeGreaterThan(0);
        expect(words.symbol, `${vocabulary.kind}:${unit} has no symbol`).toBeDefined();
      }
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets "20 C + 5 F" read its right operand
  // as a difference — and it is also what makes every temperature alias ambiguous,
  // which `print/unit-word.ts`'s ambiguity fallback is written against. Two lists
  // that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, both languages included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaPl?.units[unit]?.aliases).toEqual(
        readingPl?.units[unit]?.aliases ?? [],
      );
    }
    // The English half is reused from the one `ALIAS` map in `units.ts` rather
    // than retyped, so a Polish engine still reads "212 F"; the Polish half is
    // appended.
    expect(readingPl?.units.c?.aliases).toContain("c");
    expect(readingPl?.units.c?.aliases).toContain("celsius");
    expect(readingPl?.units.c?.aliases).toContain("celsjusz");
    expect(deltaPl?.units.k?.aliases).toContain("kelwinów");
  });

  // The per-unit decision is `en`'s, and re-taken rather than copied: the Polish
  // spelled form is two tokens in every register ("20 stopni Celsjusza"), a word
  // token ends at a space, and the printer's spelled path only ever emits a word
  // the parser can read back. Asserting it against `en` rather than against
  // `undefined` is what makes the mirror the thing under test — if a later phase
  // gives an English temperature unit words, this fails until Polish follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [pl, en] of [
      [readingPl, readingEn],
      [deltaPl, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(pl?.units[unit]?.forms, `${pl?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(pl?.units[unit]?.forms, `${pl?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so nothing but the ASCII machinery may
  // reach it. A Polish diacritic or either scale name in a descriptor would mean a
  // translation had leaked into the half of the package that is supposed to be
  // language-free.
  test("the kinds themselves carry no Polish word", () => {
    for (const kind of [temperature, tempdelta]) {
      expect(JSON.stringify(kind)).not.toMatch(POLISH);
      expect(JSON.stringify(kind)).not.toMatch(/celsjusz|fahrenheita|kelwin/i);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach CLDR's `other`
    // category — the *fractional* row, which in Polish is the genitive singular —
    // at all. A fractional count is added for the same reason every other `pl`
    // vocabulary adds one, except that here it can only confirm the absence of a
    // `forms` table, since a unit with none is skipped before any key is asked
    // for. That is the honest shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Polish temperature", () => {
    const e = engine();
    // Every string below is spaced — "2 K", not "2K" — and that is
    // `polish.renderQuantity` rather than this vocabulary: the language sets a
    // symbol off from its number by a space, which is PN-EN ISO 80000. For a
    // degree symbol it is the notation the standard is most often quoted about,
    // and it is the one way this language moves output that no `forms` table is
    // involved in.
    //
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 2 selects `nom-few` and 5 selects `nom-many`, but no
    // `forms` table exists to index, so both render through `symbol` and the
    // formatter never asks the language for a key at all. A vocabulary that had
    // invented eight Polish keys here would print "2 kelwiny"/"5 kelwinów" —
    // readable, and unparseable in the spelled path the moment "stopni" is what a
    // Pole would actually have written.
    expect(e.evaluate("2 kelwiny").formatted).toBe("2 K");
    expect(e.evaluate("5 kelwinów").formatted).toBe("5 K");
    // The fractional row, which in every inflecting sibling is a genitive singular
    // — and here is again just the symbol, with Polish's decimal comma from CLDR
    // through `numberFormat: "intl"`.
    expect(e.evaluate("1,5 kelwina").formatted).toBe("1,5 K");
    // Polish in, Latin symbol out, for the two scale names Polish writes as
    // degrees: `°C`/`°F` are what Polish print uses, and unlike Russian's Cyrillic
    // homoglyphs there is no second spelling of them to choose between.
    expect(e.evaluate("20 celsjusz").formatted).toBe("20 °C");
    expect(e.evaluate("100 fahrenheit").formatted).toBe("100 °F");
    // The genitive singular, which is what "20 stopni Celsjusza" leaves behind
    // when the phrase is clipped to the scale name — and the locative of
    // Fahrenheit, which no suffix rule could have recovered: t→c gives
    // "fahrenheicie", and stripping "ie" from it leaves "fahrenhe".
    expect(e.evaluate("20 celsjusza").formatted).toBe("20 °C");
    expect(e.evaluate("100 fahrenheicie").formatted).toBe("100 °F");
    // A conversion, read with the Polish preposition "w" and printed in the target
    // scale. Both operands' words come from this file; the offsets come from the
    // kind.
    expect(e.evaluate("300 K w celsjuszu").formatted).toBe("26,85 °C");
    expect(e.evaluate("212 F w C").formatted).toBe("100 °C");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written as an escape because a literal NBSP is invisible in source and
    // degrades to a plain space when someone retypes the line.
    expect(e.evaluate("5000 C w F").formatted).toBe("9\u00A0032 °F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 celsjusza - 20 celsjusza");
    expect(diff.formatted).toBe("10 °C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // What this vocabulary deliberately does not claim, and what it gets for free.
  // Recorded as assertions rather than left in a comment, following
  // `@smartput/power`'s "к.с." precedent: an alias the lexer cannot produce is
  // dead weight that reads as coverage.
  test("records what the lexer can and cannot reach", () => {
    const e = engine();
    // "stopień Celsjusza" is two tokens, and a word token ends at a space, so no
    // alias can claim it. That is P5's `compoundSplitter`, not a missing word —
    // and it is the whole reason this kind ships no `forms`.
    expect(() => e.evaluate("20 stopni celsjusza")).toThrow();
    // "stopień" is claimed by neither scale, on purpose: it is the counted noun of
    // *both* constructions, so giving it to `c` would make a bare "20 stopni" a
    // Celsius reading, and it is `@smartput/angle`'s word in this language
    // besides.
    for (const words of [readingPl?.units.c, readingPl?.units.f]) {
      expect(words?.aliases).not.toContain("stopień");
      expect(words?.aliases).not.toContain("stopni");
    }
    // And what Polish gets that Russian did not: the degree sign as typed. `lex`
    // skips "°" as an unrecognized character, so "20 °C" reaches the resolver as a
    // bare "C" — which is a Latin alias in a Latin-script language, where `ru` was
    // left with a Cyrillic homoglyph it could not claim.
    expect(e.evaluate("20 °C").formatted).toBe("20 °C");
  });

  // `polish.selectForm` still answers for these units — it is a function of the
  // slot and the count, and knows nothing about which units have tables — so the
  // reason the two-axis grammar is unexercised here is the missing `forms`, not a
  // missing key. Pinning that keeps the test above honest: it asserts output does
  // not move across the plural boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      polish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(2, "after-number")).toBe("nom-few");
    expect(key(5, "after-number")).toBe("nom-many");
    // 21 goes with 5 and not with 1, which is where Polish leaves Ukrainian: "21
    // kelwinów", where `uk` agrees its 21 with the singular.
    expect(key(21, "after-number")).toBe("nom-many");
    expect(key(1.5, "after-number")).toBe("nom-other");
    expect(key(5, "conversion-target")).toBe("loc-many");
    expect(key(undefined, "conversion-target")).toBe("loc-other");
    expect(readingPl?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Inputs whose output carries no thousands group: Polish groups with U+00A0
    // and `parse/normalize.ts` folds every `\s` — NBSP included — to a plain space
    // before `lex()` sees it, so "9 032 °F" comes back as two numbers. That is a
    // core-level gap between the group separator and the normalizer, not something
    // a vocabulary can express its way out of, which is why the grouped conversion
    // above is asserted as a string instead.
    //
    // The last row is this language's own: the printed string itself, degree sign
    // and ISO space included, handed straight back. `ru` could not do that with a
    // Cyrillic keyboard's "°С"; Polish can, because the symbol it prints is spelled
    // out of the same alphabet its aliases are.
    for (const input of [
      "20 celsjusz",
      "1,5 kelwina",
      "100 fahrenheit",
      "300 K w celsjuszu",
      "30 celsjusza - 20 celsjusza",
      "20 °C",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
