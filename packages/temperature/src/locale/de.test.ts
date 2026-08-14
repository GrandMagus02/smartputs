import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureDe from "./de";
import temperatureEn from "./en";

const [readingDe, deltaDe] = temperatureDe;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(german, temperatureDe);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/** Anything only German would write: the three umlauts and the ß. */
const GERMAN = /[äöüß]/i;

describe("temperature de vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureDe.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureDe) expect(vocabulary.locale).toBe("de");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingDe?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaDe?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureDe) {
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
  // same words on purpose — that is what lets "20 C + 5 F" read its right
  // operand as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, compounds included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaDe?.units[unit]?.aliases).toEqual(
        readingDe?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather
    // than retyped, so a German engine still reads "212 F"; the German compound
    // is appended.
    expect(readingDe?.units.c?.aliases).toContain("c");
    expect(readingDe?.units.c?.aliases).toContain("celsius");
    expect(readingDe?.units.c?.aliases).toContain("celsiusgrad");
    expect(deltaDe?.units.f?.aliases).toContain("fahrenheitgrad");
  });

  // The per-unit decision is `en`'s, not re-taken here: nobody writes "20 Grad
  // Celsius" into a calculator, the spelled phrase is two tokens and therefore
  // unreadable, and the printer's spelled path only ever emits a word the parser
  // can read back. Asserting it against `en` rather than against `undefined` is
  // what makes the mirror the thing under test — if a later phase gives an
  // English temperature unit words, this fails until German follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [de, en] of [
      [readingDe, readingEn],
      [deltaDe, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(de?.units[unit]?.forms, `${de?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(de?.units[unit]?.forms, `${de?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no German word may reach it. The
  // umlaut regex would not catch "celsiusgrad", which has none, so the compounds
  // are grepped for by name beside it.
  test("the kinds themselves carry no German word", () => {
    for (const kind of [temperature, tempdelta]) {
      expect(JSON.stringify(kind)).not.toMatch(GERMAN);
      expect(JSON.stringify(kind)).not.toMatch(/grad/i);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so `german.selectForm`'s `other`
    // category is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `de` vocabulary adds one — except
    // that here it can only confirm the absence of a `forms` table, since a unit
    // with none is skipped before any key is asked for. That is the honest shape
    // of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes German temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 1 selects `nom-one` and 2 selects `nom-other`, but
    // no `forms` table exists to index, so both render through `symbol` and the
    // formatter never asks the language for a key at all.
    expect(e.evaluate("1 Kelvin").formatted).toBe("1 K");
    expect(e.evaluate("2 Kelvin").formatted).toBe("2 K");
    // The German compound, capitalised as prose writes it and lowercase as a
    // search box does: analyzers are handed the surface exactly as typed and the
    // index folds, so both reach the same reading.
    expect(e.evaluate("20 Celsiusgrad").formatted).toBe("20 °C");
    expect(e.evaluate("20 celsiusgrad").formatted).toBe("20 °C");
    expect(e.evaluate("100 Fahrenheitgrad").formatted).toBe("100 °F");
    // The fractional row, which here is again just the symbol — with German's
    // decimal comma, which comes from CLDR through `numberFormat: "intl"`.
    expect(e.evaluate("1,5 Kelvin").formatted).toBe("1,5 K");
    // A conversion, read with each of German's three `in` words and printed in
    // the target scale. Both operands' words come from this file; the offsets
    // come from the kind.
    expect(e.evaluate("300 K in Celsius").formatted).toBe("26,85 °C");
    expect(e.evaluate("212 F nach C").formatted).toBe("100 °C");
    expect(e.evaluate("212 F zu Celsius").formatted).toBe("100 °C");
    // A conversion whose result groups. German groups with ".", which — unlike
    // Ukrainian's U+00A0 — survives `normalize()`, so this row is round-tripped
    // below instead of merely being asserted as a string.
    expect(e.evaluate("5000 C in F").formatted).toBe("9.032 °F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 Celsiusgrad - 20 Celsiusgrad");
    expect(diff.formatted).toBe("10 °C");
    expect(diff.value?.kind).toBe("tempdelta");
    // A sum that lands on a fraction, on the delta kind for the same reason.
    expect(e.evaluate("1 Kelvin + 0,5 Kelvin").formatted).toBe("1,5 K");
  });

  // The one thing German changes about how a temperature is *written*, and it
  // comes from the language rather than from this file: `german.renderQuantity`
  // sets a symbol off from its number with a space, per DIN 1301-1 and SI, where
  // the default template — written for English's "20°C" — sets it tight.
  test("the symbol is spaced, which is DIN 1301-1 and not a stray byte", () => {
    expect(engine().evaluate("20 C").formatted).toBe("20 °C");
    expect(engine().evaluate("20 C").formatted).not.toBe("20°C");
    // And it survives the trip back, which is the only reason it is safe to
    // print: `lex` skips "°" as an unrecognized character, so the reader sees the
    // number and then the bare "C" this table already claims.
    expect(engine().evaluate("20 °C").value?.canonical.toString()).toBe("20");
  });

  // The endings this file deliberately does not list, read through the engine
  // rather than asserted against the table: `german.analyze`'s suffix stripper
  // takes each of them off and lands on the one compound that is listed. This is
  // the measurement behind "only the nominative singular earns a line".
  test("the stripper reaches every ending the compound takes", () => {
    const e = engine();
    for (const surface of [
      "20 Celsiusgrade", // plural
      "20 Celsiusgraden", // dative plural
      "20 Celsiusgrads", // genitive singular
    ]) {
      expect(e.evaluate(surface).formatted, surface).toBe("20 °C");
    }
    expect(readingDe?.units.c?.aliases).not.toContain("celsiusgrade");
  });

  // Two German words this file deliberately does not claim, recorded as
  // assertions rather than left in a comment, following `@smartput/power`'s
  // "к.с." precedent: an unclaimed word that reads as coverage is worse than a
  // gap that is written down.
  test("records the German spellings it declines to claim", () => {
    const aliases = readingDe?.units.c?.aliases ?? [];
    // "Grad" is `@smartput/angle`'s word in German — "45 Grad" is at least as
    // often a slope as a temperature — and no context either kind could offer
    // separates them, so it is left unclaimed rather than given to whichever
    // package was written first.
    expect(aliases).not.toContain("grad");
    expect(() => engine().evaluate("20 Grad")).toThrow();
    // "Grad Celsius" is two tokens, and a word token ends at a space, so no
    // alias can claim it — and `COMPOUND_HEADS` leaves "grad" out on purpose, so
    // the splitter does not reassemble it either.
    expect(() => engine().evaluate("20 Grad Celsius")).toThrow();
    // There is no *Kelvingrad*: the kelvin is not a degree, so `k` adds nothing
    // beyond the Latin table's own words.
    expect(readingDe?.units.k?.aliases).toEqual(temperatureEn[0]?.units.k?.aliases ?? []);
  });

  // `german.selectForm` still answers for these units — it is a function of the
  // slot and the count, and knows nothing about which units have tables — so the
  // reason the two-axis grammar is unexercised here is the missing `forms`, not
  // a missing key. Pinning that keeps the previous tests honest: they assert
  // output does not move across the plural boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number, slot: "after-number" | "conversion-target") =>
      german.selectForm({
        count: new Decimal(count),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(2, "after-number")).toBe("nom-other");
    expect(key(1, "conversion-target")).toBe("dat-one");
    expect(key(5, "conversion-target")).toBe("dat-other");
    expect(readingDe?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in this list where the Ukrainian file had to leave it
    // out: German groups with "." and `normalize()`'s NFKC pass leaves that
    // alone, so "9.032 °F" reads back as one quantity.
    for (const input of [
      "20 Celsiusgrad",
      "1,5 Kelvin",
      "100 Fahrenheitgrad",
      "300 K in Celsius",
      "5000 C in F",
      "30 Celsiusgrad - 20 Celsiusgrad",
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
