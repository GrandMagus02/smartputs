import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureEs from "./es";

const [readingEs, deltaEs] = temperatureEs;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(spanish, temperatureEs);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/** Anything only Spanish would write — the accented vowels and the ñ. */
const SPANISH = /[áéíóúüñ]/i;

describe("temperature es vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureEs.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureEs) expect(vocabulary.locale).toBe("es");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingEs?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaEs?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureEs) {
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
  // it. Spanish shares the Latin script with the unit ids, so the grep is for
  // what only Spanish writes — the accents — plus the words this file adds.
  test("the kinds themselves carry no Spanish word", () => {
    for (const kind of [temperature, tempdelta]) {
      const source = JSON.stringify(kind);
      expect(source).not.toMatch(SPANISH);
      expect(source).not.toMatch(/centigrado|kelvines/i);
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets "20 C + 5 F" read its right
  // operand as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, Spanish included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaEs?.units[unit]?.aliases).toEqual(
        readingEs?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather
    // than retyped, so a Spanish engine still reads "212 F"; the Spanish half is
    // appended, accent-free spelling and all.
    expect(readingEs?.units.c?.aliases).toContain("celsius");
    expect(readingEs?.units.c?.aliases).toContain("centígrado");
    expect(readingEs?.units.c?.aliases).toContain("centigrados");
    expect(deltaEs?.units.k?.aliases).toContain("kelvines");
  });

  // The three scale names Spanish quotes rather than translates, recorded so the
  // absence of an entry for them reads as a decision. "celsius", "fahrenheit"
  // and "kelvin" are surnames, and the table already carries all three.
  test("adds nothing for the two surnames the table already spells", () => {
    expect(readingEs?.units.f?.aliases).toEqual(readingEn?.units.f?.aliases ?? []);
    expect(readingEs?.units.f?.aliases).toContain("fahrenheit");
  });

  // The per-unit decision is `en`'s, and it is re-taken in Spanish for a second
  // reason the file states: the noun Spanish counts is "grado", "centígrado" is
  // an adjective doing noun duty, and the only natural word form is the
  // three-token "20 grados centígrados". Asserting it against `en` rather than
  // against `undefined` is what makes the mirror the thing under test — if a
  // later phase gives an English temperature unit words, this fails until
  // Spanish follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [es, en] of [
      [readingEs, readingEn],
      [deltaEs, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(es?.units[unit]?.forms, `${es?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(es?.units[unit]?.forms, `${es?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach `spanish`'s
    // `other` category through a fraction at all. A fractional count is added for
    // the same reason every other `es` vocabulary adds one — except that here it
    // can only confirm the absence of a `forms` table, since a unit with none is
    // skipped before any key is asked for. That is the honest shape of this
    // kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // `spanish.selectForm` still answers for these units — it is a function of the
  // count and knows nothing about which units have tables — so the reason no
  // grammar is exercised here is the missing `forms`, not a missing key. Pinning
  // that keeps the output test below honest: it asserts output does not move
  // across the plural boundary, and this says why.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      spanish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    expect(key(1.5, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(readingEs?.units.c?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Spanish temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 1 selects `one` and 2 selects `other`, but no
    // `forms` table exists to index, so both render through `symbol` and the
    // formatter never asks the language for a key at all.
    expect(e.evaluate("1 kelvin").formatted).toBe("1K");
    expect(e.evaluate("2 kelvines").formatted).toBe("2K");
    // The fractional row, which is again just the symbol — with Spanish's
    // decimal comma, read from CLDR by `numberFormat: "intl"`.
    expect(e.evaluate("1,5 kelvines").formatted).toBe("1,5K");
    // The Spanish scale name in, the Latin symbol out: "°C" is what Spanish
    // print writes, Latin letters included.
    expect(e.evaluate("20 centígrados").formatted).toBe("20°C");
    expect(e.evaluate("20 centigrado").formatted).toBe("20°C");
    expect(e.evaluate("100 fahrenheit").formatted).toBe("100°F");
    // Conversions through both of Spanish's `in` keywords — "en" is the locative
    // preposition, "a" the directional one — printed in the target scale. Both
    // operands' words come from this file; the offsets come from the kind.
    expect(e.evaluate("300 K en centígrados").formatted).toBe("26,85°C");
    expect(e.evaluate("212 F a C").formatted).toBe("100°C");
    // A conversion whose result groups: Spanish groups thousands with ".", and
    // unlike Ukrainian's U+00A0 that survives `normalize()`, so this string is
    // round-tripped below rather than only asserted.
    expect(e.evaluate("5000 C en F").formatted).toBe("9.032°F");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 centígrados - 20 centígrados");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // The word this vocabulary deliberately does not claim, recorded as an
  // assertion rather than left in a comment: "grado"/"grados" is what a Spanish
  // speaker says out loud, and it is also `@smartput/angle`'s Spanish word for
  // the angular degree. Claiming it would make "90 grados" ambiguous between a
  // right angle and a summer afternoon in every composed engine, to buy back a
  // reading that does not say which scale it means anyway.
  test("leaves the bare degree noun to the angle kind", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(readingEs?.units[unit]?.aliases).not.toContain("grado");
      expect(readingEs?.units[unit]?.aliases).not.toContain("grados");
    }
    expect(() => engine().evaluate("20 grados")).toThrow();
    // And the full phrase is three tokens, so no alias could span it either —
    // that is P5's `compoundSplitter`, not a missing word.
    expect(() => engine().evaluate("20 grados centígrados")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20 centígrados",
      "1,5 kelvines",
      "100 fahrenheit",
      "300 K en centígrados",
      "5000 C en F",
      "30 centígrados - 20 centígrados",
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
