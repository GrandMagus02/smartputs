import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureIt from "./it";

const [readingIt, deltaIt] = temperatureIt;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(italian, temperatureIt);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/** Anything only Italian would write — the five accented vowels it uses. */
const ITALIAN = /[àèéìòù]/i;

describe("temperature it vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureIt.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureIt) expect(vocabulary.locale).toBe("it");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingIt?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaIt?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureIt) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.length,
          `${vocabulary.kind}:${unit} has no aliases`,
        ).toBeGreaterThan(0);
        expect(words.symbol, `${vocabulary.kind}:${unit} has no symbol`).toBeDefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so nothing a language wrote may reach
  // it. Italian shares the Latin script with the unit ids, so the grep is for
  // what only Italian writes — the accents — plus the word this file adds.
  test("the kinds themselves carry no Italian word", () => {
    for (const kind of [temperature, tempdelta]) {
      const source = JSON.stringify(kind);
      expect(source).not.toMatch(ITALIAN);
      expect(source).not.toMatch(/centigrad[oi]/i);
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets "20 C + 5 F" read its right
  // operand as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, Italian included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaIt?.units[unit]?.aliases).toEqual(
        readingIt?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather
    // than retyped, so an Italian engine still reads "212 F"; the Italian half
    // is appended.
    expect(readingIt?.units.c?.aliases).toContain("celsius");
    expect(readingIt?.units.c?.aliases).toContain("centigrado");
    expect(readingIt?.units.c?.aliases).toContain("centigradi");
    expect(deltaIt?.units.c?.aliases).toContain("centigradi");
  });

  // The scale names Italian quotes rather than translates, recorded so the
  // absence of an entry for them reads as a decision. "celsius", "fahrenheit"
  // and "kelvin" are surnames, and the table already carries all three; and
  // "kelvin" belongs to Italian's invariant class, so there is no plural to add
  // where Spanish had to declare "kelvines".
  test("adds nothing for the surnames the table already spells", () => {
    expect(readingIt?.units.f?.aliases).toEqual(readingEn?.units.f?.aliases ?? []);
    expect(readingIt?.units.k?.aliases).toEqual(readingEn?.units.k?.aliases ?? []);
    expect(readingIt?.units.f?.aliases).toContain("fahrenheit");
    expect(readingIt?.units.k?.aliases).not.toContain("kelvini");
  });

  // The per-unit decision is `en`'s, and it is re-taken in Italian for reasons
  // the file states: the noun Italian counts is "grado", "centigrado" is an
  // adjective behind it, and the only natural word form is the three-token "20
  // gradi centigradi" — while "kelvin" is invariant and has no word form to
  // give at all. Asserting it against `en` rather than against `undefined` is
  // what makes the mirror the thing under test — if a later phase gives an
  // English temperature unit words, this fails until Italian follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [it, en] of [
      [readingIt, readingEn],
      [deltaIt, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(it?.units[unit]?.forms, `${it?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(it?.units[unit]?.forms, `${it?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach `italian`'s
    // `other` category through a fraction at all. A fractional count is added for
    // the same reason every other `it` vocabulary adds one — except that here it
    // can only confirm the absence of a `forms` table, since a unit with none is
    // skipped before any key is asked for. That is the honest shape of this
    // kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // `italian.selectForm` still answers for these units — it is a function of the
  // count and knows nothing about which units have tables — so the reason no
  // grammar is exercised here is the missing `forms`, not a missing key. Pinning
  // that keeps the output test below honest: it asserts output does not move
  // across the plural boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      italian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    expect(key(1.5, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    // Italian nouns do not decline for position, so the slot is not an axis: the
    // same count answers the same key wherever the quantity sits.
    expect(key(5, "after-number")).toBe(key(5, "conversion-target"));
    expect(readingIt?.units.c?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Italian temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 1 selects `one` and 2 selects `other`, but no
    // `forms` table exists to index, so both render through `symbol` and the
    // formatter never asks the language for a key at all.
    expect(e.evaluate("1 kelvin").formatted).toBe("1K");
    expect(e.evaluate("2 kelvin").formatted).toBe("2K");
    // The fractional row, which is again just the symbol — with Italian's
    // decimal comma, read from CLDR by `numberFormat: "intl"`.
    expect(e.evaluate("1,5 kelvin").formatted).toBe("1,5K");
    // The Italian scale name in, the Latin symbol out: "°C" is what Italian
    // print writes, Latin letters included. Both numbers of the word read, the
    // plural because it is declared and not because the fold recovered it.
    expect(e.evaluate("20 centigradi").formatted).toBe("20°C");
    expect(e.evaluate("20 centigrado").formatted).toBe("20°C");
    expect(e.evaluate("100 fahrenheit").formatted).toBe("100°F");
    // Conversions through both of Italian's `in` keywords — "in" is the locative
    // preposition, "a" the directional one — printed in the target scale. Both
    // operands' words come from this file; the offsets come from the kind.
    expect(e.evaluate("300 K in centigradi").formatted).toBe("26,85°C");
    expect(e.evaluate("212 F a C").formatted).toBe("100°C");
    // A conversion whose result groups: Italian groups thousands with ".", and
    // unlike Ukrainian's U+00A0 that survives `normalize()`, so this string is
    // round-tripped below rather than only asserted.
    expect(e.evaluate("5000 C in F").formatted).toBe("9.032°F");
    // A sum that lands on a fraction, which for this kind is a reading plus a
    // difference — and the difference is what the second temperature word reads
    // as, since both kinds answer to the identical aliases.
    expect(e.evaluate("20 centigradi + 1,5 centigradi").formatted).toBe("21,5°C");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 centigradi - 20 centigradi");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // The word this vocabulary deliberately does not claim, recorded as an
  // assertion rather than left in a comment: "grado"/"gradi" is what an Italian
  // speaker says out loud, and it is also `@smartput/angle`'s Italian word for
  // the angular degree. Claiming it would make "90 gradi" ambiguous between a
  // right angle and a summer afternoon in every composed engine, to buy back a
  // reading that does not say which scale it means anyway.
  test("leaves the bare degree noun to the angle kind", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(readingIt?.units[unit]?.aliases).not.toContain("grado");
      expect(readingIt?.units[unit]?.aliases).not.toContain("gradi");
    }
    expect(() => engine().evaluate("20 gradi")).toThrow();
    // And the full phrase is three tokens, so no alias could span it either —
    // that is P5's `compoundSplitter`, not a missing word.
    expect(() => engine().evaluate("20 gradi centigradi")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20 centigradi",
      "1,5 kelvin",
      "100 fahrenheit",
      "300 K in centigradi",
      "5000 C in F",
      "20 centigradi + 1,5 centigradi",
      "30 centigradi - 20 centigradi",
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
