import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureFr from "./fr";

const [readingFr, deltaFr] = temperatureFr;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(french, temperatureFr);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/** Anything only French would write — the accented vowels and the cedilla. */
const FRENCH = /[àâçéèêëîïôùûüÿœ]/i;

/** The group separator CLDR hands French: U+202F NARROW NO-BREAK SPACE. */
const NNBSP = "\u202f";

describe("temperature fr vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureFr.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureFr) expect(vocabulary.locale).toBe("fr");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingFr?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaFr?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureFr) {
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
  // it. French shares the Latin script with the unit ids, so the grep is for what
  // only French writes — the accents — plus the word this file adds and the one
  // it refuses.
  test("the kinds themselves carry no French word", () => {
    for (const kind of [temperature, tempdelta]) {
      const source = JSON.stringify(kind);
      expect(source).not.toMatch(FRENCH);
      expect(source).not.toMatch(/centigrades|degr/i);
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets "20 C + 5 F" read its right operand
  // as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it.
  test("both kinds register the identical alias list, French included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaFr?.units[unit]?.aliases).toEqual(
        readingFr?.units[unit]?.aliases ?? [],
      );
    }
    // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
    // retyped, so a French engine still reads "212 F"; the French half is
    // appended.
    expect(readingFr?.units.c?.aliases).toContain("celsius");
    expect(readingFr?.units.c?.aliases).toContain("centigrade");
    expect(readingFr?.units.c?.aliases).toContain("centigrades");
    expect(deltaFr?.units.c?.aliases).toContain("centigrades");
  });

  // The scale names French quotes rather than translates, recorded so the absence
  // of an entry for them reads as a decision. "celsius", "fahrenheit" and
  // "kelvin" are surnames and the table already carries all three; French does
  // pluralize the kelvin, having made it an ordinary common noun, but "kelvins"
  // is the same string the English plural already put in the table, so there is
  // nothing to append where Spanish had to declare "kelvines".
  test("adds nothing for the surnames the table already spells", () => {
    expect(readingFr?.units.f?.aliases).toEqual(readingEn?.units.f?.aliases ?? []);
    expect(readingFr?.units.k?.aliases).toEqual(readingEn?.units.k?.aliases ?? []);
    expect(readingFr?.units.f?.aliases).toContain("fahrenheit");
    expect(readingFr?.units.k?.aliases).toContain("kelvins");
  });

  // The only word this file adds, and the one place a French plural was worth
  // declaring rather than leaving to the stripper. It carries no accent, which is
  // why — unlike the Spanish file — no accent-free variant sits beside it.
  test("the one word it adds is the French plural, unaccented", () => {
    const generated = new Set(readingEn?.units.c?.aliases ?? []);
    const added = (readingFr?.units.c?.aliases ?? []).filter((a) => !generated.has(a));
    expect(added).toEqual(["centigrades"]);
    for (const word of added) expect(word).not.toMatch(FRENCH);
  });

  // The per-unit decision is `en`'s, and it is re-taken in French for reasons the
  // file states: the noun French counts is "degré", "centigrade" is an adjective
  // behind it, and the only natural word form is the three-token "20 degrés
  // Celsius" — while the symbol path already produces exactly what French print
  // writes, space included. Asserting it against `en` rather than against
  // `undefined` is what makes the mirror the thing under test — if a later phase
  // gives an English temperature unit words, this fails until French follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [fr, en] of [
      [readingFr, readingEn],
      [deltaFr, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(fr?.units[unit]?.forms, `${fr?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(fr?.units[unit]?.forms, `${fr?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach the fractional row
    // at all — and in French that row is the *singular* one, which is where a
    // table ported from English by renaming columns would be wrong. A fractional
    // count is added for the same reason every other `fr` vocabulary adds one —
    // except that here it can only confirm the absence of a `forms` table, since
    // a unit with none is skipped before any key is asked for. That is the honest
    // shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // `french.selectForm` still answers for these units — it is a function of the
  // count and knows nothing about which units have tables — so the reason no
  // grammar is exercised here is the missing `forms`, not a missing key. Pinning
  // that keeps the output test below honest: it asserts output does not move
  // across the plural boundary, and this says why, and says where the French
  // boundary would have been.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      french.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // French is singular below two — "zéro degré", "1,5 degré Celsius" — where
    // English calls 0 and 1.5 plural. This is the row the absent table would have
    // had to get right.
    expect(key(0, "after-number")).toBe("one");
    expect(key(1.5, "after-number")).toBe("one");
    expect(key(undefined, "conversion-target")).toBe("other");
    // French nouns do not decline for position, so the slot is not an axis: the
    // same count answers the same key wherever the quantity sits.
    expect(key(5, "after-number")).toBe(key(5, "conversion-target"));
    expect(readingFr?.units.c?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes French temperature", () => {
    const e = engine();
    // The space before the symbol, which is the visible difference from every
    // sibling language: `fr.ts` overrides `renderQuantity` to set one space
    // before every label, symbol included. "20 °C" is what French print writes,
    // and the SI brochure — written in French — is where that rule comes from.
    expect(e.evaluate("20 centigrades").formatted).toBe("20 °C");
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. 1 and 1,5 select `one` and 2 selects `other`, but no
    // `forms` table exists to index, so all three render through `symbol` and the
    // formatter never asks the language for a key at all.
    expect(e.evaluate("1 kelvin").formatted).toBe("1 K");
    expect(e.evaluate("2 kelvins").formatted).toBe("2 K");
    expect(e.evaluate("1,5 kelvin").formatted).toBe("1,5 K");
    // Both numbers of the added word read, the plural because it is declared and
    // not because the stripper recovered it.
    expect(e.evaluate("20 centigrade").formatted).toBe("20 °C");
    expect(e.evaluate("100 fahrenheit").formatted).toBe("100 °F");
    // Conversions through both of French's `in` keywords — "en" is the ordinary
    // conversion preposition, "vers" the directional one — printed in the target
    // scale. Both operands' words come from this file; the offsets come from the
    // kind.
    expect(e.evaluate("300 K en centigrades").formatted).toBe("26,85 °C");
    expect(e.evaluate("212 F vers C").formatted).toBe("100 °C");
    // A conversion whose result groups, with French's U+202F as the group mark —
    // an invisible *and* narrow space, pinned by codepoint because a plain space
    // in a fixture would pass against an implementation that had hardcoded
    // Ukrainian's U+00A0.
    expect(e.evaluate("5000 C en F").formatted).toBe(`9${NNBSP}032 °F`);
    // A sum that lands on a fraction, which for this kind is a reading plus a
    // difference — and the difference is what the second temperature word reads
    // as, since both kinds answer to the identical aliases.
    expect(e.evaluate("20 centigrades + 1,5 centigrades").formatted).toBe("21,5 °C");
    // The delta kind, reached through the same words: a difference between two
    // readings is 10 degrees, not a reading of 10 degrees.
    const diff = e.evaluate("30 centigrades - 20 centigrades");
    expect(diff.formatted).toBe("10 °C");
    expect(diff.value?.kind).toBe("tempdelta");
  });

  // The word this vocabulary deliberately does not claim, recorded as an
  // assertion rather than left in a comment: "degré"/"degrés" is what a French
  // speaker says out loud, and it is also `@smartput/angle`'s French word for the
  // angular degree. Claiming it would make "90 degrés" ambiguous between a right
  // angle and an unlivable afternoon in every composed engine, to buy back a
  // reading that does not say which scale it means anyway.
  test("leaves the bare degree noun to the angle kind", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(readingFr?.units[unit]?.aliases).not.toContain("degré");
      expect(readingFr?.units[unit]?.aliases).not.toContain("degrés");
    }
    expect(() => engine().evaluate("20 degrés")).toThrow();
    // And the full phrase is three tokens, so no alias could span it either —
    // that is the limit `phrase-analyzer.ts` documents, not a missing word. This
    // is the hazard the language author flagged from the other side: "degré
    // Celsius" cannot be the reading surface, and "celsius" alone is.
    expect(() => engine().evaluate("20 degrés Celsius")).toThrow();
    expect(engine().evaluate("20 celsius").formatted).toBe("20 °C");
  });

  test("round-trips its own output", () => {
    const e = engine();
    for (const input of [
      "20 centigrades",
      "1,5 kelvin",
      "100 fahrenheit",
      "300 K en centigrades",
      "5000 C en F",
      "20 centigrades + 1,5 centigrades",
      "30 centigrades - 20 centigrades",
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
