import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentNl from "./nl";

const locale = composeLocale(dutch, [percentNl]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/**
 * Anything only Dutch would write: the trema and the acute. It catches nothing in
 * "procent", which is why the test that uses it greps for the word beside it —
 * Dutch shares the Latin alphabet and a script regex is nearly useless here.
 */
const DUTCH = /[ëïéèöü]/i;

/** The closed key set `dutch.selectForm` can produce — no more, no fewer. */
const TWO_KEYS = ["one", "other"];

describe("percent nl vocabulary", () => {
  test("it targets Dutch and names its kind by id", () => {
    expect(percentNl.locale).toBe("nl");
    expect(percentNl.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is one ratio and one unit id, so no Dutch word may reach it. The trema regex
  // alone would not catch "procent", which has none, so the word is grepped for by
  // name beside it.
  test("the kind itself carries no Dutch word", () => {
    expect(JSON.stringify(percent)).not.toMatch(DUTCH);
    expect(JSON.stringify(percent)).not.toMatch(/procent/i);
  });

  // No `forms`, and for `en`'s reason rather than a claim that Dutch has no word:
  // Dutch has a real plural for this noun ("de procenten"), and it is listed as an
  // alias, but the written form of this unit is the symbol. Where the `en` unit
  // decided against word forms, this file does not invent them.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentNl.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  // Rule 5, which is the one a Dutch vocabulary has to work harder at than a
  // German one: `dutch.analyze` deliberately does not strip `en`, so every plural
  // this file expects a reader to type has to be listed rather than hoped for.
  // Measured through the table and through the engine, because those are two
  // different claims.
  test("every plural it expects to read is a plural it lists", () => {
    const aliases = percentNl.units["%"]?.aliases ?? [];
    expect(aliases).toContain("procent");
    expect(aliases).toContain("procenten");
    // And the Latin half survives, which is what `aliasesFor` is for: "percent" is
    // an English spelling *and* a current Dutch one, so reusing the map already
    // carries it and listing it again would be a duplicate candidate.
    expect(aliases).toContain("percent");
    expect(aliases).toContain("pct");
    expect(aliases.length).toBe(new Set(aliases).size);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach: the sweep is skipped, but the alias half
    // of the contract is what carries this kind, and running the same call shape as
    // every other `nl` vocabulary keeps the row comparable.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Dutch percentages", () => {
    const e = engine();
    // The plural boundary, which Dutch does not mark here at all: a measure noun
    // stays singular after a numeral, so "2 procent" and "5 procent" are the same
    // word — and both answer with the symbol, which is the point of a symbol-only
    // unit.
    expect(e.evaluate("2 procent").formatted).toBe("2 %");
    expect(e.evaluate("5 procent").formatted).toBe("5 %");
    // The free plural, which a reader still types even though nobody counts with
    // it. It is listed because Dutch's stripper does not take `en` off — the one
    // place this file has to do more work than `de.ts` did.
    expect(e.evaluate("20 procenten").formatted).toBe("20 %");
    // Capitalised as a sentence-initial word, and lowercase as a search box: Dutch
    // capitalises no noun, so the lowercase spelling is the ordinary one and the
    // capital is the accident. Both reach the same reading, because analyzers are
    // handed the surface exactly as typed and the index folds.
    expect(e.evaluate("20 Procent").formatted).toBe("20 %");
    // The fractional row — "," as the decimal mark, read from CLDR by
    // `numberFormat: "intl"`.
    expect(e.evaluate("1,5 procent").formatted).toBe("1,5 %");
    // Grouped output, with Dutch's "." — and, unlike Ukrainian's NBSP, a group mark
    // the engine can read back (see the round-trip below).
    expect(e.evaluate("2000 procent").formatted).toBe("2.000 %");
    // Both spellings read: a Dutch engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and "percent" is a Dutch word besides.
    expect(e.evaluate("50 pct").formatted).toBe("50 %");
    expect(e.evaluate("50 percent").formatted).toBe("50 %");
    // The `of` operator through its Dutch keyword ("van").
    expect(e.evaluate("20 % van 50").formatted).toBe("10");
    // A sum that lands on a fraction, so the decimal comma and the symbol space are
    // both in one string.
    expect(e.evaluate("2 procent plus 1,5 procent").formatted).toBe("3,5 %");
  });

  // The one thing Dutch changes about how a percentage is *written*, and it comes
  // from the language rather than from this file: `dutch.renderQuantity` overrides
  // the default template to set a symbol off from the number with a space,
  // following SI as `de.ts` does, where English sets it tight.
  test("the symbol is spaced, which is the language's choice and not a stray byte", () => {
    expect(engine().evaluate("20 %").formatted).toBe("20 %");
    expect(engine().evaluate("20 %").formatted).not.toBe("20%");
    // And the space survives the trip back, which is the only reason it is safe to
    // print: the lexer ends the number at the space and reads "%" as the word token
    // it is.
    expect(engine().evaluate("20 %").value?.canonical.toString()).toBe("0.2");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion it
  // can be the target of comes from outside the kind. It needs `number` registered,
  // and both of Dutch's `in` words reach it. Where German's copy of this test
  // proves an inflected dative plural is indexed, Dutch has nothing to inflect: the
  // conversion target is spelled exactly like a bare quantity, which is the whole
  // of what `dutch.selectForm` discarding its slot means in practice.
  test("reads a conversion into percent, through both of Dutch's in words", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 / 50 in procent").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 naar procent").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 in %").formatted).toBe("10 %");
  });

  // `dutch.selectForm` still answers for this unit — it is a function of the count
  // and knows nothing about which units have tables — so the reason no grammar is
  // exercised here is the missing `forms`, not a missing key. Pinning it keeps the
  // previous tests honest.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      dutch.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    expect(key(1.5, "after-number")).toBe("other");
    // The slot is read and discarded — Dutch has no case marking on common nouns —
    // so a conversion target selects the same key a bare quantity does. German's
    // copy of this line returns "dat-one".
    expect(key(1, "conversion-target")).toBe("one");
    // Ruling R5: a conversion target has no magnitude to agree with.
    expect(key(undefined, "conversion-target")).toBe("other");
    // The closed set, so a language that grew a third key would have to come back
    // through this file.
    expect(
      [
        ...new Set(
          [undefined, 0, 1, 2, 5, 11, 21, 100, 1000, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
        ),
      ].sort(),
    ).toEqual(TWO_KEYS);
    expect(percentNl.units["%"]?.forms).toBeUndefined();
  });

  // A Dutch word this file deliberately does not claim, recorded as an assertion
  // rather than left in a comment: a percentage point is a different quantity from
  // a percentage, and claiming the noun would answer a different question than the
  // one asked.
  test("does not claim procentpunt", () => {
    expect(percentNl.units["%"]?.aliases).not.toContain("procentpunt");
    expect(() => engine().evaluate("20 procentpunten")).toThrow();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is included here where the Ukrainian file had to leave it
    // out: Dutch groups with "." and `normalize()`'s NFKC pass leaves that alone, so
    // "2.000 %" reads back as one quantity.
    for (const input of [
      "2 procent",
      "5 procent",
      "1,5 procent",
      "2000 procent",
      "20 procenten",
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
