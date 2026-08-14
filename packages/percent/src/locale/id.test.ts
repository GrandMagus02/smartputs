import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentId from "./id";

const locale = composeLocale(indonesian, [percentId]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/**
 * Indonesian shares the Latin alphabet with the ISO-ish unit key `%` and with every
 * generated alias, so no script regex can tell an Indonesian word from an English
 * one the way `/\p{Script=Han}/u` does next door in `zh.test.ts`. What is grepped
 * for instead is the words themselves — the one this file claims and the three it
 * argues against — which is the only honest form the check can take here.
 */
const INDONESIAN = /persen|perseratus|persentase|diskon/i;

/** The closed key set `indonesian.selectForm` can produce. `en` has two, `uk` eight. */
const ONE_KEY = ["other"];

describe("percent id vocabulary", () => {
  test("it targets Indonesian and names its kind by id", () => {
    expect(percentId.locale).toBe("id");
    expect(percentId.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind is
  // one ratio and one unit id, so no Indonesian word may reach it.
  test("the kind itself carries no Indonesian word", () => {
    expect(JSON.stringify(percent)).not.toMatch(INDONESIAN);
  });

  test("the generated Latin aliases survive, with the Indonesian word on top", () => {
    const aliases = percentId.units["%"]?.aliases ?? [];
    // Reused from the one alias map in `units.ts` rather than retyped, so "20 pct"
    // keeps parsing under an Indonesian format locale: recognition is many-to-one,
    // generation is one (design decision I6).
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    expect(aliases).toContain("persen");
  });

  // The whole Indonesian half of this file is one word, and the reason is that this
  // language has no grammatical plural at all: "1 persen" and "1000 persen" are the
  // same string. `nl.test.ts` next door has to assert its `-en` plural is listed
  // because Dutch's stripper cannot reach it; here there is no second cell to reach.
  test("the Indonesian word is invariant, so there is one line and no plural", () => {
    const aliases = percentId.units["%"]?.aliases ?? [];
    const added = aliases.filter((a) => INDONESIAN.test(a));
    expect(added).toEqual(["persen"]);
    // And the language-level fact behind it, which is also why the list has to be
    // complete: `indonesian.analyze` is a bare `identity()` with no stripper, so a
    // word not listed is a word that cannot be read at all.
    expect(indonesian.analyze?.length).toBe(1);
    const e = engine();
    expect(e.evaluate("1 persen").formatted).toBe("1%");
    expect(e.evaluate("1000 persen").formatted).toBe("1.000%");
  });

  // Three Indonesian words this file deliberately declines, recorded as assertions
  // rather than left in a comment: an unclaimed word that reads as coverage is worse
  // than a gap that is written down.
  test("records the Indonesian words it declines to claim", () => {
    const aliases = percentId.units["%"]?.aliases ?? [];
    // The calque, *per* + *seratus*. A mathematical gloss rather than a word anyone
    // writes after a number — "%" and "persen" already carry the meaning.
    expect(aliases).not.toContain("perseratus");
    // The name of the *ratio*, the way English "percentage" and Chinese 百分比 are:
    // nobody writes "20 persentase".
    expect(aliases).not.toContain("persentase");
    for (const declined of ["20 perseratus", "20 persentase"]) {
      expect(() => engine().evaluate(declined)).toThrow();
    }
    // "poin persen" is the percentage *point* — a different quantity, since a rate
    // moving from 2% to 3% rises by one point and by fifty percent — and it is two
    // tokens besides, which no alias index can reach.
    expect(aliases).not.toContain("poin");
  });

  // The one place this package feels a decision taken in the language file. Indonesian
  // states a discount with the noun *diskon*, which precedes both operands, while
  // `off` is an infix — so `@smartput/core/locale/id` claims no word for it, and the
  // arithmetic stays reachable through `-` and the words this language does declare.
  test("there is no `off` word, and subtraction is what carries the discount", () => {
    expect(indonesian.keywords.off).toBeUndefined();
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    // The idiomatic Indonesian phrasing, refused — loudly, which is the point.
    expect(() => e.evaluate("diskon 20% dari 50")).toThrow();
    // And the two readings that do work: "of" through *dari*, and the discount
    // written as a subtraction through *kurang*.
    expect(e.evaluate("20% dari 50").formatted).toBe("10");
    expect(e.evaluate("50 kurang 20%").formatted).toBe("40");
  });

  test("no unit declares forms, and selectForm has one key it would need", () => {
    for (const words of Object.values(percentId.units)) {
      expect(words.forms).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      indonesian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
          key(undefined, "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(ONE_KEY);
    // The claim behind the one-key table, measured rather than asserted: CLDR gives
    // Indonesian exactly one plural category, so this is the cheapest place in the
    // repo a `forms` table could have been shipped — one row — and it is still the
    // wrong output, because the written form of this unit is the symbol.
    expect(new Intl.PluralRules("id").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional reading at
    // all. Under `id` a fraction cannot select a different key — there is only one —
    // so this call confirms the shape rather than a new row, and running it keeps this
    // vocabulary comparable with every sibling that does move across the boundary.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Indonesian percentages", () => {
    const e = engine();
    // The symbol is the whole of this unit's Indonesian output, and it is set tight
    // against the number because this language declares no `renderQuantity` and
    // `defaultRenderQuantity` closes a symbol up — which is also what Indonesian
    // typography does, so the default template is the right one here.
    expect(e.evaluate("20%").formatted).toBe("20%");
    expect(e.evaluate("20%").formatted).not.toBe("20 %");
    // The word in, the symbol out, which is what "no `forms`" means in practice.
    expect(e.evaluate("20 persen").formatted).toBe("20%");
    // The plural boundary, which in this language moves nothing at all: 1, 2 and 5
    // take the identical noun, and the vocabulary has no word to print for any of them
    // anyway.
    expect(e.evaluate("1%").formatted).toBe("1%");
    expect(e.evaluate("2%").formatted).toBe("2%");
    expect(e.evaluate("5%").formatted).toBe("5%");
    // The fractional row and the grouped one, with Indonesian's separators — decimal
    // ",", group "." — the exact inverse of English's.
    expect(e.evaluate("1,5%").formatted).toBe("1,5%");
    expect(e.evaluate("2000%").formatted).toBe("2.000%");
    // A sum that lands on a fraction, through the division verb this language
    // declares. "bagi" is complete on its own, which is why `indonesian.keywords`
    // declares no `by` for it to swallow.
    expect(e.evaluate("5% bagi 2").formatted).toBe("2,5%");
    // Both scripts — or rather both vocabularies — read: an Indonesian engine still
    // takes the Latin aliases the one alias map in `units.ts` declares.
    expect(e.evaluate("50 pct").formatted).toBe("50%");
  });

  // `％` U+FF05 is what a fullwidth keyboard produces from the `%` key, and it is
  // read without being listed: `normalize()` runs NFKC before a word reaches any
  // index, and NFKC folds the fullwidth form to the ASCII one. Asserted rather than
  // left in a comment, because the tempting "fix" is to add a dead alias that reads
  // as coverage.
  test("the fullwidth ％ reads through NFKC, not through an alias", () => {
    expect(percentId.units["%"]?.aliases).not.toContain("％");
    expect(engine().evaluate("20％").formatted).toBe("20%");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than a
  // unit-to-unit change — percent has exactly one unit, so the only conversion it can
  // be the target of comes from outside the kind. Both of this language's `in` words
  // are ordinary infix particles standing between the operands.
  test("reads a conversion into percent, through both in words", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 bagi 50 ke %").formatted).toBe("10%");
    expect(e.evaluate("5 bagi 50 dalam %").formatted).toBe("10%");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in this list where the Ukrainian file had to leave it out:
    // Indonesian groups with "." and `normalize()`'s NFKC pass leaves that alone, so
    // "2.000%" reads back as one quantity.
    for (const input of ["20%", "1,5%", "2000%", "20 persen", "5% bagi 2", "50 pct"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
