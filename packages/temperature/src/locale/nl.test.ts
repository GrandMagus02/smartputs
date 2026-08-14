import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureNl from "./nl";

const [readingNl, deltaNl] = temperatureNl;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(dutch, temperatureNl);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/**
 * Anything only Dutch would write: the trema and the acute. It catches nothing in
 * "celsiusgraad", which is why the test that uses it greps for the compounds by
 * name beside it — Dutch shares the Latin alphabet with the unit table.
 */
const DUTCH = /[ëïéèöü]/i;

describe("temperature nl vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureNl.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureNl) expect(vocabulary.locale).toBe("nl");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingNl?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaNl?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureNl) {
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
  test("both kinds register the identical alias list, compounds included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaNl?.units[unit]?.aliases).toEqual(
        readingNl?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a Dutch engine still reads "212 F"; the Dutch compounds are
    // appended.
    expect(readingNl?.units.c?.aliases).toContain("c");
    expect(readingNl?.units.c?.aliases).toContain("celsius");
    expect(readingNl?.units.c?.aliases).toContain("celsiusgraad");
    expect(deltaNl?.units.f?.aliases).toContain("fahrenheitgraad");
  });

  // Rule 5's Dutch shape, and the place this file has to do more work than `de.ts`
  // did. German lists only the nominative singular and lets its stripper reach
  // every other ending; Dutch's stripper deliberately does not take `en` off (see
  // `nl.ts` — the main Dutch plural shortens an open syllable, so "graden" would
  // strip to "grad" rather than to "graad"), so the plural is a word this file
  // declares rather than a word it hopes for.
  test("the plural compound is listed, because the stripper cannot reach it", () => {
    for (const unit of ["c", "f"] as const) {
      const aliases = readingNl?.units[unit]?.aliases ?? [];
      expect(
        aliases.some((a) => a.endsWith("graad")),
        unit,
      ).toBe(true);
      expect(
        aliases.some((a) => a.endsWith("graden")),
        unit,
      ).toBe(true);
    }
    // And the measurement behind the claim: no analyzer route reaches the plural
    // from the singular, so an engine that had only the singular listed would fail
    // this input.
    expect(engine().evaluate("20 celsiusgraden").formatted).toBe("20 °C");
    expect(engine().evaluate("100 fahrenheitgraden").formatted).toBe("100 °F");
  });

  // The per-unit decision is `en`'s, not re-taken here: a Dutch text writes "het is
  // 20 graden Celsius", which is two tokens and therefore unreadable, and the
  // printer's spelled path only ever emits a word the parser can read back.
  // Asserting it against `en` rather than against `undefined` is what makes the
  // mirror the thing under test — if a later phase gives an English temperature
  // unit words, this fails until Dutch follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [nl, en] of [
      [readingNl, readingEn],
      [deltaNl, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(nl?.units[unit]?.forms, `${nl?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(nl?.units[unit]?.forms, `${nl?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no Dutch word may reach it. The trema
  // regex would not catch "celsiusgraad", which has none, so the compounds are
  // grepped for by name beside it.
  test("the kinds themselves carry no Dutch word", () => {
    for (const kind of [temperature, tempdelta]) {
      expect(JSON.stringify(kind)).not.toMatch(DUTCH);
      expect(JSON.stringify(kind)).not.toMatch(/graad|graden/i);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so `dutch.selectForm`'s `other` category
    // is never reached through a fraction at all. A fractional count is added for
    // the same reason every other `nl` vocabulary adds one — except that here it can
    // only confirm the absence of a `forms` table, since a unit with none is skipped
    // before any key is asked for. That is the honest shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Dutch temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 1 selects `one` and 2 selects `other`, but no `forms`
    // table exists to index, so both render through `symbol` and the formatter never
    // asks the language for a key at all.
    expect(e.evaluate("1 kelvin").formatted).toBe("1 K");
    expect(e.evaluate("2 kelvin").formatted).toBe("2 K");
    // The Dutch compound, lowercase as Dutch actually writes it — this language
    // capitalises no noun, which is the one German stress it does not share — and
    // capitalised as a sentence-initial accident. Both reach the same reading,
    // because analyzers are handed the surface exactly as typed and the index folds.
    expect(e.evaluate("20 celsiusgraad").formatted).toBe("20 °C");
    expect(e.evaluate("20 Celsiusgraad").formatted).toBe("20 °C");
    expect(e.evaluate("100 fahrenheitgraad").formatted).toBe("100 °F");
    // The fractional row, which here is again just the symbol — with Dutch's decimal
    // comma, which comes from CLDR through `numberFormat: "intl"`.
    expect(e.evaluate("1,5 kelvin").formatted).toBe("1,5 K");
    // A conversion, read with each of Dutch's two `in` words and printed in the
    // target scale. Both operands' words come from this file; the offsets come from
    // the kind.
    expect(e.evaluate("300 K in celsius").formatted).toBe("26,85 °C");
    expect(e.evaluate("212 F naar C").formatted).toBe("100 °C");
    // A conversion whose result groups. Dutch groups with ".", which — unlike
    // Ukrainian's U+00A0 — survives `normalize()`, so this row is round-tripped
    // below instead of merely being asserted as a string.
    expect(e.evaluate("5000 C in F").formatted).toBe("9.032 °F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 celsiusgraad - 20 celsiusgraad");
    expect(diff.formatted).toBe("10 °C");
    expect(diff.value?.kind).toBe("tempdelta");
    // A sum that lands on a fraction, on the delta kind for the same reason.
    expect(e.evaluate("1 kelvin + 0,5 kelvin").formatted).toBe("1,5 K");
  });

  // The one thing Dutch changes about how a temperature is *written*, and it comes
  // from the language rather than from this file: `dutch.renderQuantity` sets a
  // symbol off from its number with a space, following SI, where the default
  // template — written for English's "20°C" — sets it tight.
  test("the symbol is spaced, which is SI and not a stray byte", () => {
    expect(engine().evaluate("20 C").formatted).toBe("20 °C");
    expect(engine().evaluate("20 C").formatted).not.toBe("20°C");
    // And it survives the trip back, which is the only reason it is safe to print:
    // `lex` skips "°" as an unrecognized character, so the reader sees the number and
    // then the bare "C" this table already claims.
    expect(engine().evaluate("20 °C").value?.canonical.toString()).toBe("20");
  });

  // Two Dutch words this file deliberately does not claim, recorded as assertions
  // rather than left in a comment, following `@smartput/power`'s "к.с." precedent:
  // an unclaimed word that reads as coverage is worse than a gap that is written
  // down.
  test("records the Dutch spellings it declines to claim", () => {
    const aliases = readingNl?.units.c?.aliases ?? [];
    // "graad" is `@smartput/angle`'s word in Dutch — "45 graden" is at least as
    // often a slope as a temperature — and no context either kind could offer
    // separates them, so it is left unclaimed rather than given to whichever package
    // was written first. Note that the language *does* list it as a compound head,
    // which is a statement about where a word may be cut and not about what the
    // piece means.
    expect(aliases).not.toContain("graad");
    expect(aliases).not.toContain("graden");
    expect(() => engine().evaluate("20 graden")).toThrow();
    // "graden Celsius" is two tokens, and a word token ends at a space, so no alias
    // can claim it — the compound head reaches inside a single word and never across
    // a space.
    expect(() => engine().evaluate("20 graden Celsius")).toThrow();
    // There is no *kelvingraad*: the kelvin is not a degree, so `k` adds nothing
    // beyond the Latin table's own words.
    expect(readingNl?.units.k?.aliases).toEqual(temperatureEn[0]?.units.k?.aliases ?? []);
  });

  // `dutch.selectForm` still answers for these units — it is a function of the count
  // and knows nothing about which units have tables — so the reason no grammar is
  // exercised here is the missing `forms`, not a missing key. Pinning that keeps the
  // previous tests honest: they assert output does not move across the plural
  // boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number, slot: "after-number" | "conversion-target") =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The slot is read and discarded, which is the substantive difference from
    // German: `de.test.ts`'s copy of this line returns "dat-one".
    expect(key(1, "conversion-target")).toBe("one");
    expect(key(5, "conversion-target")).toBe("other");
    expect(readingNl?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in this list where the Ukrainian file had to leave it out:
    // Dutch groups with "." and `normalize()`'s NFKC pass leaves that alone, so
    // "9.032 °F" reads back as one quantity.
    for (const input of [
      "20 celsiusgraad",
      "20 celsiusgraden",
      "1,5 kelvin",
      "100 fahrenheitgraad",
      "300 K in celsius",
      "5000 C in F",
      "30 celsiusgraad - 20 celsiusgraad",
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
