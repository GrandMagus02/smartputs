import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperaturePt from "./pt";

const [readingPt, deltaPt] = temperaturePt;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(portuguese, temperaturePt);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/** Anything only Portuguese would write — the tilde and the rest of the accents. */
const PORTUGUESE = /[ãõáéíóúàâêôç]/i;

describe("temperature pt vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperaturePt.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperaturePt) expect(vocabulary.locale).toBe("pt");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingPt?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaPt?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperaturePt) {
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
  // it. Portuguese shares the Latin script with the unit ids, so the grep is for
  // what only Portuguese writes — the accents — plus the word this file adds and
  // the two it deliberately refuses.
  test("the kinds themselves carry no Portuguese word", () => {
    for (const kind of [temperature, tempdelta]) {
      const source = JSON.stringify(kind);
      expect(source).not.toMatch(PORTUGUESE);
      expect(source).not.toMatch(/centigrado|graus/i);
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets "20 C + 5 F" read its right operand
  // as a difference — and it is also what makes every temperature alias ambiguous,
  // which `print/unit-word.ts`'s ambiguity fallback is written against. Two lists
  // that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, Portuguese included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaPt?.units[unit]?.aliases).toEqual(
        readingPt?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a Portuguese engine still reads "212 F"; the Portuguese half is
    // appended, accent-free spelling and all.
    expect(readingPt?.units.c?.aliases).toContain("celsius");
    expect(readingPt?.units.c?.aliases).toContain("centígrado");
    expect(readingPt?.units.c?.aliases).toContain("centígrados");
    expect(readingPt?.units.c?.aliases).toContain("centigrado");
    expect(deltaPt?.units.c?.aliases).toContain("centigrados");
    for (const words of [readingPt, deltaPt]) {
      for (const unit of ["c", "f", "k"]) {
        const aliases = words?.units[unit]?.aliases ?? [];
        expect(aliases.length, `${words?.kind}:${unit}`).toBe(new Set(aliases).size);
      }
    }
  });

  // The two scales Portuguese quotes rather than translates, recorded so the
  // absence of an entry for them reads as a decision. All three scale names are
  // surnames; what makes `k` interesting is that its *plural* needs nothing either,
  // because Portuguese pluralizes the loanword with a plain "-s" and the table's
  // own English "kelvins" is already that string. Spanish had to declare
  // "kelvines"; Portuguese has nothing to declare.
  test("adds nothing for the surnames the table already spells", () => {
    expect(readingPt?.units.f?.aliases).toEqual(readingEn?.units.f?.aliases ?? []);
    expect(readingPt?.units.k?.aliases).toEqual(readingEn?.units.k?.aliases ?? []);
    expect(readingPt?.units.f?.aliases).toContain("fahrenheit");
    expect(readingPt?.units.k?.aliases).toContain("kelvins");
    expect(readingPt?.units.k?.aliases).not.toContain("kelvines");
  });

  // The per-unit decision is `en`'s, and it is re-taken in Portuguese for a second
  // reason the file states: the noun Portuguese counts is "grau", which
  // `@smartput/angle/locale/pt` owns, so the only natural word form is the
  // three-token "20 graus centígrados". Asserting it against `en` rather than
  // against `undefined` is what makes the mirror the thing under test — if a later
  // phase gives an English temperature unit words, this fails until Portuguese
  // follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [pt, en] of [
      [readingPt, readingEn],
      [deltaPt, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(pt?.units[unit]?.forms, `${pt?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(pt?.units[unit]?.forms, `${pt?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional count
    // at all. A fractional count is added for the same reason every other `pt`
    // vocabulary adds one — and in Portuguese it is the count that selects the
    // *singular* row, the opposite of English — except that here it can only
    // confirm the absence of a `forms` table, since a unit with none is skipped
    // before any key is asked for. That is the honest shape of this kind's
    // coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // `portuguese.selectForm` still answers for these units — it is a function of
  // the count and knows nothing about which units have tables — so the reason no
  // grammar is exercised here is the missing `forms`, not a missing key. Pinning
  // that keeps the output test below honest: it asserts output does not move
  // across the plural boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      portuguese.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The Portuguese rows: 0 and 1,5 are both singular, a million is the folded
    // `many`, and a count-less conversion target is `other` (ruling R5).
    expect(key(0, "after-number")).toBe("one");
    expect(key(1.5, "after-number")).toBe("one");
    expect(key(1_000_000, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(readingPt?.units.c?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Portuguese temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 1 selects `one` and 2 selects `other`, but no `forms`
    // table exists to index, so both render through `symbol` and the formatter
    // never asks the language for a key at all.
    expect(e.evaluate("1 kelvin").formatted).toBe("1K");
    expect(e.evaluate("2 kelvins").formatted).toBe("2K");
    // The fractional row — the one Portuguese calls singular — which is again just
    // the symbol, with the Brazilian decimal comma read from CLDR.
    expect(e.evaluate("1,5 kelvins").formatted).toBe("1,5K");
    // The Portuguese scale name in, the Latin symbol out: "°C" is what Brazilian
    // print writes, Latin letters included.
    expect(e.evaluate("20 centígrados").formatted).toBe("20°C");
    expect(e.evaluate("20 centigrado").formatted).toBe("20°C");
    expect(e.evaluate("100 fahrenheit").formatted).toBe("100°F");
    // Conversions through both of Portuguese's `in` keywords — "em" is the
    // locative preposition, "para" the directional one — printed in the target
    // scale. Both operands' words come from this file; the offsets come from the
    // kind.
    expect(e.evaluate("300 K em centígrados").formatted).toBe("26,85°C");
    expect(e.evaluate("212 F para C").formatted).toBe("100°C");
    // A conversion whose result groups: Portuguese groups thousands with ".", and
    // unlike Ukrainian's U+00A0 that survives `normalize()`, so this string is
    // round-tripped below rather than only asserted.
    expect(e.evaluate("5000 C em F").formatted).toBe("9.032°F");
    // A sum that lands on a fraction — a reading plus a difference is a reading.
    expect(e.evaluate("20 centígrados mais 0,5 centígrados").formatted).toBe("20,5°C");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 centígrados menos 20 centígrados");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // The word this vocabulary deliberately does not claim, recorded as an assertion
  // rather than left in a comment — and here the collision is a fact on disk
  // rather than a prediction: `@smartput/angle/locale/pt` claims "grau"/"graus"
  // for the angular degree and prints them as its forms. Claiming them would make
  // "90 graus" ambiguous between a right angle and a summer afternoon in every
  // composed engine, to buy back a reading that does not say which scale it means
  // anyway.
  test("leaves the bare degree noun to the angle kind", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(readingPt?.units[unit]?.aliases).not.toContain("grau");
      expect(readingPt?.units[unit]?.aliases).not.toContain("graus");
    }
    expect(() => engine().evaluate("20 graus")).toThrow();
    // And the full phrase is three tokens, so no alias could span it either — that
    // is P5's `compoundSplitter`, not a missing word.
    expect(() => engine().evaluate("20 graus centígrados")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20 centígrados",
      "1,5 kelvins",
      "100 fahrenheit",
      "300 K em centígrados",
      "5000 C em F",
      "20 centígrados mais 0,5 centígrados",
      "30 centígrados menos 20 centígrados",
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
