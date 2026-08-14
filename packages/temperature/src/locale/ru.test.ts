import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureRu from "./ru";

const [readingRu, deltaRu] = temperatureRu;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(russian, temperatureRu);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

describe("temperature ru vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureRu.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureRu) expect(vocabulary.locale).toBe("ru");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingRu?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaRu?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureRu) {
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
  // as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, both scripts included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaRu?.units[unit]?.aliases).toEqual(
        readingRu?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a Russian engine still reads "212 F"; the Cyrillic half is
    // appended.
    expect(readingRu?.units.c?.aliases).toContain("c");
    expect(readingRu?.units.c?.aliases).toContain("celsius");
    expect(readingRu?.units.c?.aliases).toContain("цельсий");
    expect(deltaRu?.units.k?.aliases).toContain("кельвинов");
  });

  // The per-unit decision is `en`'s, and re-taken rather than copied: the Russian
  // spelled form is two tokens in every register ("20 градусов по Цельсию"), a
  // word token ends at a space, and the printer's spelled path only ever emits a
  // word the parser can read back. Asserting it against `en` rather than against
  // `undefined` is what makes the mirror the thing under test — if a later phase
  // gives an English temperature unit words, this fails until Russian follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [ru, en] of [
      [readingRu, readingEn],
      [deltaRu, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(ru?.units[unit]?.forms, `${ru?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(ru?.units[unit]?.forms, `${ru?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no script but ASCII may reach it.
  // Cyrillic anywhere in either descriptor would mean a translation had leaked
  // into the half of the package that is supposed to be language-free.
  test("the kinds themselves carry no Russian word", () => {
    expect(JSON.stringify(temperature)).not.toMatch(/[Ѐ-ӿ]/);
    expect(JSON.stringify(tempdelta)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach CLDR's `other`
    // category — the *fractional* row, which in Russian is the genitive singular
    // — at all. A fractional count is added for the same reason every other `ru`
    // vocabulary adds one, except that here it can only confirm the absence of a
    // `forms` table, since a unit with none is skipped before any key is asked
    // for. That is the honest shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Russian temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 2 selects `nom-few` and 5 selects `nom-many`, but no
    // `forms` table exists to index, so both render through `symbol` and the
    // formatter never asks the language for a key at all. A vocabulary that had
    // invented eight Russian keys here would print "2 кельвина"/"5 кельвинов" —
    // readable, and un-parseable in the spelled path the moment "градус" is what
    // a Russian would actually have written.
    expect(e.evaluate("2 кельвина").formatted).toBe("2K");
    expect(e.evaluate("5 кельвинов").formatted).toBe("5K");
    // The fractional row, which in every other `ru` vocabulary is the genitive
    // singular — and here is again just the symbol, with Russian's decimal comma
    // from CLDR through `numberFormat: "intl"`.
    expect(e.evaluate("1,5 кельвина").formatted).toBe("1,5K");
    // Cyrillic in, Latin symbol out, for the two scale names Russian writes as
    // degrees: `°C`/`°F` are what Russian print uses, Latin letters included.
    expect(e.evaluate("20 цельсий").formatted).toBe("20°C");
    expect(e.evaluate("100 фаренгейт").formatted).toBe("100°F");
    // The dative, which is the case Russian's own "по Цельсию" leaves behind
    // when the phrase is clipped to the scale name, and a form the suffix
    // stripper could not have recovered — dropping "-ю" from "цельсию" gives
    // "цельси", a string in no index.
    expect(e.evaluate("20 цельсию").formatted).toBe("20°C");
    // A conversion, read with the Russian preposition "в" and printed in the
    // target scale. Both operands' words come from this file; the offsets come
    // from the kind.
    expect(e.evaluate("300 K в цельсий").formatted).toBe("26,85°C");
    expect(e.evaluate("212 F в C").formatted).toBe("100°C");
    // A conversion whose result groups: Russian groups thousands with U+00A0,
    // written as an escape because a literal NBSP is invisible in source and
    // degrades to a plain space when someone retypes the line.
    expect(e.evaluate("5000 C в F").formatted).toBe("9\u00A0032°F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 цельсий - 20 цельсий");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // Three spellings a Russian genuinely types and this vocabulary deliberately
  // does not claim. Recorded as assertions rather than left in a comment,
  // following `@smartput/power`'s "к.с." precedent: an alias the lexer cannot
  // produce is dead weight that reads as coverage.
  test("records the Russian spellings the lexer cannot reach", () => {
    const aliases = readingRu?.units.c?.aliases ?? [];
    // `parse/lex.ts` skips "°" as an unrecognized character, so "20 °С" with a
    // Cyrillic "С" reaches the resolver as a bare "С" and an alias carrying the
    // degree sign could never match it.
    expect(aliases).not.toContain("°с");
    expect(() => engine().evaluate("20 °С")).toThrow();
    // And the bare "с" it degrades to is not claimed either: that is already
    // Russian for the *second*, so claiming it here would make "20 с" a
    // temperature candidate in every composed engine to buy back a spelling the
    // "°" has already been thrown away from.
    expect(aliases).not.toContain("с");
    // "градус Цельсия" and "по Цельсию" are two tokens, and a word token ends at
    // a space, so no alias can claim them. That is P5's `compoundSplitter`, not a
    // missing word — and it is the whole reason this kind ships no `forms`.
    expect(() => engine().evaluate("20 градусов цельсия")).toThrow();
  });

  // `russian.selectForm` still answers for these units — it is a function of the
  // slot and the count, and knows nothing about which units have tables — so the
  // reason the two-axis grammar is unexercised here is the missing `forms`, not a
  // missing key. Pinning that keeps the previous test honest: it asserts output
  // does not move across the plural boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number, slot: "after-number" | "conversion-target") =>
      russian.selectForm({
        count: new Decimal(count),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(2, "after-number")).toBe("nom-few");
    expect(key(5, "after-number")).toBe("nom-many");
    expect(key(1.5, "after-number")).toBe("nom-other");
    expect(key(5, "conversion-target")).toBe("loc-many");
    expect(readingRu?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // Inputs whose output carries no thousands group: Russian groups with U+00A0
    // and `parse/normalize.ts` folds every `\s` — NBSP included — to a plain
    // space before `lex()` sees it, so "9 032°F" comes back as two numbers. That
    // is a core-level gap between the group separator and the normalizer, not
    // something a vocabulary can express its way out of, which is why the grouped
    // conversion above is asserted as a string instead.
    for (const input of [
      "20 цельсий",
      "1,5 кельвина",
      "100 фаренгейт",
      "300 K в цельсий",
      "30 цельсий - 20 цельсий",
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
