import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentDe from "./de";

const locale = composeLocale(german, [percentDe]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/** Anything only German would write: the three umlauts and the ß. */
const GERMAN = /[äöüß]/i;

describe("percent de vocabulary", () => {
  test("it targets German and names its kind by id", () => {
    expect(percentDe.locale).toBe("de");
    expect(percentDe.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so no German word may reach it. The
  // umlaut regex alone would not catch "prozent", which has none, so the word is
  // grepped for by name beside it.
  test("the kind itself carries no German word", () => {
    expect(JSON.stringify(percent)).not.toMatch(GERMAN);
    expect(JSON.stringify(percent)).not.toMatch(/prozent/i);
  });

  // No `forms`, and for `en`'s reason rather than a claim that German has no
  // word: German declines "Prozent" (the dative plural "Prozenten" is a live
  // form, and it is listed as an alias), but the written form of this unit is
  // the symbol. Where the `en` unit decided against word forms, this file does
  // not invent them.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentDe.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach: the sweep is skipped, but the alias
    // half of the contract is what carries this kind, and running the same call
    // shape as every other `de` vocabulary keeps the row comparable.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes German percentages", () => {
    const e = engine();
    // The plural boundary, which German does not mark here at all: a neuter
    // measure noun stays uninflected after a cardinal, so "2 Prozent" and "5
    // Prozent" are the same word — and both answer with the symbol, which is the
    // point of a symbol-only unit.
    expect(e.evaluate("2 Prozent").formatted).toBe("2 %");
    expect(e.evaluate("5 Prozent").formatted).toBe("5 %");
    // Capitalised as ordinary German prose writes it, and lowercase as a search
    // box does. Analyzers are handed the surface exactly as typed and the index
    // folds, so both reach the same reading.
    expect(e.evaluate("20 prozent").formatted).toBe("20 %");
    // The free plural, "die Prozente", and the dative plural German's `in`
    // governs.
    expect(e.evaluate("20 Prozente").formatted).toBe("20 %");
    expect(e.evaluate("20 Prozenten").formatted).toBe("20 %");
    // The genitive singular, which is *not* a listed alias: the language's suffix
    // stripper takes the -s off and lands on "prozent". This is the row that says
    // which cells earn a line and which do not.
    expect(e.evaluate("20 Prozents").formatted).toBe("20 %");
    // The fractional row — "," as the decimal mark, read from CLDR by
    // `numberFormat: "intl"`.
    expect(e.evaluate("1,5 Prozent").formatted).toBe("1,5 %");
    // Grouped output, with German's "." — and, unlike Ukrainian's NBSP, a group
    // mark the engine can read back (see the round-trip below).
    expect(e.evaluate("2000 Prozent").formatted).toBe("2.000 %");
    // Both alphabets read: a German engine still takes the Latin aliases the one
    // alias map in `units.ts` declares.
    expect(e.evaluate("50 pct").formatted).toBe("50 %");
    // The `of` operator through its German keyword ("von").
    expect(e.evaluate("20 % von 50").formatted).toBe("10");
    // A sum that lands on a fraction, so the decimal comma and the symbol space
    // are both in one string.
    expect(e.evaluate("2 Prozent plus 1,5 Prozent").formatted).toBe("3,5 %");
  });

  // The one thing German changes about how a percentage is *written*, and it
  // comes from the language rather than from this file: `german.renderQuantity`
  // overrides the default template to set a symbol off from the number with a
  // space (DIN 5008 / DIN 1301-1), where English sets it tight. "20 %" is what a
  // German text writes, and it is what this engine answers with.
  test("the symbol is spaced, which is German typography and not a stray byte", () => {
    expect(engine().evaluate("20 %").formatted).toBe("20 %");
    expect(engine().evaluate("20 %").formatted).not.toBe("20%");
    // And the space survives the trip back, which is the only reason it is safe
    // to print: the lexer ends the number at the space and reads "%" as the word
    // token it is.
    expect(engine().evaluate("20 %").value?.canonical.toString()).toBe("0.2");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather
  // than a unit-to-unit change — percent has exactly one unit, so the only
  // conversion it can be the target of comes from outside the kind. It needs
  // `number` registered, and "in Prozenten" is the dative plural: that is the
  // case German's `in` governs when it answers *wo*, and reaching the
  // conversion-target slot through the word rather than through "%" is what
  // proves the inflected aliases are indexed and not merely listed.
  test("reads a conversion into percent, through all three of German's in words", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 / 50 in Prozenten").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 nach Prozent").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 zu %").formatted).toBe("10 %");
  });

  // `german.selectForm` still answers for this unit — it is a function of the
  // slot and the count and knows nothing about which units have tables — so the
  // reason the two-axis grammar is unexercised here is the missing `forms`, not
  // a missing key. Pinning it keeps the previous tests honest.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      german.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(2, "after-number")).toBe("nom-other");
    expect(key(1.5, "after-number")).toBe("nom-other");
    expect(key(1, "conversion-target")).toBe("dat-one");
    // Ruling R5: a conversion target has no magnitude to agree with.
    expect(key(undefined, "conversion-target")).toBe("dat-other");
    expect(percentDe.units["%"]?.forms).toBeUndefined();
  });

  // A German word this file deliberately does not claim, recorded as an
  // assertion rather than left in a comment: a percentage point is a different
  // quantity from a percentage, and claiming the noun would answer a different
  // question than the one asked.
  test("does not claim Prozentpunkt", () => {
    expect(percentDe.units["%"]?.aliases).not.toContain("prozentpunkt");
    expect(() => engine().evaluate("20 Prozentpunkte")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is included here where the Ukrainian file had to leave it
    // out: German groups with "." and `normalize()`'s NFKC pass leaves that
    // alone, so "2.000 %" reads back as one quantity.
    for (const input of [
      "2 Prozent",
      "5 Prozent",
      "1,5 Prozent",
      "2000 Prozent",
      "20 Prozenten",
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
