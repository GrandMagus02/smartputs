import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import { percent } from "../index";
import percentEn from "./en";
import percentTr from "./tr";

const locale = composeLocale(turkish, [percentTr]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/**
 * Turkish shares the Latin alphabet with the unit key `%` and with every
 * generated alias, so no script regex can tell a Turkish word from an English
 * one the way `/\p{Script=Han}/u` does next door in `zh.test.ts`. What is grepped
 * for instead is the words themselves — the one this file argues cannot be
 * claimed and the two it declines — spelled with and without their diacritics,
 * since a word reaching the kind by accident would arrive in whichever form a
 * keyboard produced.
 */
const TURKISH = /yüzde|yuzde|yüzdelik|yuzdelik|puan/i;

/** The closed key set `turkish.selectForm` can produce. `en` has two, `uk` eight. */
const ONE_KEY = ["other"];

describe("percent tr vocabulary", () => {
  test("it targets Turkish and names its kind by id", () => {
    expect(percentTr.locale).toBe("tr");
    expect(percentTr.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so no Turkish word may reach it.
  test("the kind itself carries no Turkish word", () => {
    expect(JSON.stringify(percent)).not.toMatch(TURKISH);
  });

  // The finding this file exists to record: the Turkish word for this unit
  // *precedes* its count, so the alias list is exactly the generated one.
  // Asserted against `en`'s rather than against the table directly, because what
  // is being claimed is "these two vocabularies differ only in their tag" — a
  // strong statement that should fail if either side ever moves.
  test("adds no word, and every alias is the generated one", () => {
    expect(percentTr.units["%"]?.aliases).toEqual(percentEn.units["%"]?.aliases ?? []);
    // Reused from the one alias map in `units.ts` rather than retyped, so "20 pct"
    // keeps parsing under a Turkish format locale: recognition is many-to-one,
    // generation is one (design decision I6).
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(percentTr.units["%"]?.aliases, latin).toContain(latin);
    }
    for (const alias of percentTr.units["%"]?.aliases ?? []) {
      expect(alias, `claims ${alias}`).not.toMatch(TURKISH);
    }
  });

  // *Yüzde* is Turkish for "percent" and it stands in front of the number, which
  // is the whole reason it is not an alias: an alias in this engine is a label a
  // count is followed by. Recorded as live assertions rather than left in the doc
  // comment, following `zh.test.ts`'s precedent for 百分之 — an unclaimed word
  // that reads as coverage is worse than a gap that is written down.
  test("yüzde precedes its count, so no alias index can hold it", () => {
    const e = engine();
    // The idiomatic Turkish phrasing, refused — loudly, which is the point.
    expect(() => e.evaluate("yüzde 20")).toThrow();
    // And the order an alias would have made legal, which is not Turkish.
    expect(() => e.evaluate("20 yüzde")).toThrow();
    // The morphology behind it: *yüzde* is the locative of *yüz*, "hundred", so
    // `@smartput/core/locale/tr`'s stripper would take the `-de` back off and land
    // on a numeral worth 100 — the right reading of the word and the wrong reading
    // of the input.
    const bare = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(bare.evaluate("yüz").formatted).toBe("100");
  });

  // Two Turkish words this file deliberately declines, recorded as assertions
  // rather than left in a comment. *Puan* is the percentage *point* — a different
  // quantity, since a rate moving from 2 % to 3 % rises by one point and by fifty
  // percent — and *yüzdelik* names the ratio the way English "percentage" and
  // Chinese 百分比 do.
  test("records the Turkish words it declines to claim", () => {
    const aliases = percentTr.units["%"]?.aliases ?? [];
    expect(aliases).not.toContain("puan");
    expect(aliases).not.toContain("yüzdelik");
    for (const declined of ["20 puan", "20 yüzdelik"]) {
      expect(() => engine().evaluate(declined)).toThrow();
    }
  });

  test("no unit declares forms, and selectForm has one key it would need", () => {
    for (const words of Object.values(percentTr.units)) {
      expect(words.forms).toBeUndefined();
    }
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      turkish.selectForm({
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
    // Turkish reaches the one-key table *against* CLDR rather than with it, which
    // is the difference from `id`, `ja` and `zh` and the reason
    // `@smartput/core/locale/tr` writes `selectForm` as a constant instead of
    // routing through `Intl.PluralRules`: a counted noun here is bare whatever the
    // count, so the second category would only ever hold a duplicate string.
    expect(new Intl.PluralRules("tr").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);
    expect(key(1, "after-number")).toBe("other");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `tr` a fraction cannot select a different key — there
    // is only one — so this call confirms the shape rather than a new row, and
    // running it keeps this vocabulary comparable with every sibling that does
    // move across the boundary.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Turkish percentages", () => {
    const e = engine();
    // The symbol is the whole of this unit's Turkish output, and it is set off by
    // a space, because `@smartput/core/locale/tr` declares a `renderQuantity` that
    // spaces a bare symbol — TSE following SI, the same override German makes.
    expect(e.evaluate("20%").formatted).toBe("20 %");
    expect(e.evaluate("20%").formatted).not.toBe("20%");
    // The English word in, the symbol out, which is what "no `forms`" means in
    // practice.
    expect(e.evaluate("20 percent").formatted).toBe("20 %");
    // The plural boundary, which in this language moves nothing at all: 1, 2 and
    // 5 take the identical noun, and the vocabulary has no word to print for any
    // of them anyway.
    expect(e.evaluate("1%").formatted).toBe("1 %");
    expect(e.evaluate("2%").formatted).toBe("2 %");
    expect(e.evaluate("5%").formatted).toBe("5 %");
    // The fractional row and the grouped one, with Turkish's separators — decimal
    // ",", group "." — the exact inverse of English's.
    expect(e.evaluate("1,5%").formatted).toBe("1,5 %");
    expect(e.evaluate("2000%").formatted).toBe("2.000 %");
    // A sum that lands on a fraction, through the division word this language
    // declares. "bölü" is complete on its own, which is why `turkish.keywords`
    // declares no `by` for it to swallow.
    expect(e.evaluate("5% bölü 2").formatted).toBe("2,5 %");
    // Both vocabularies read: a Turkish engine still takes the Latin aliases the
    // one alias map in `units.ts` declares.
    expect(e.evaluate("50 pct").formatted).toBe("50 %");
  });

  // The one thing this package cannot fix, pinned rather than left in prose.
  // Turkish writes the sign in **front** of the number — "%20", which
  // `Intl.NumberFormat` agrees with — and this engine prints "20 %", because
  // `defaultRenderQuantity` fixes the order and `turkish.renderQuantity` overrides
  // only the gap. The reason the language did not move the order is here too: the
  // engine cannot *read* "%20" back, so printing it would give this kind an
  // output it could not re-read.
  test("Turkish writes %20 and this engine writes 20 %, which is the readable one", () => {
    expect(new Intl.NumberFormat("tr", { style: "percent" }).format(0.2)).toBe("%20");
    expect(engine().evaluate("20 %").formatted).toBe("20 %");
    expect(() => engine().evaluate("%20")).toThrow();
    // And the reading that does work, so the gap is a printing gap and not a
    // parsing one: the sign after its count is understood either spaced or tight.
    expect(engine().evaluate("20 %").value?.canonical.toString()).toBe("0.2");
    expect(engine().evaluate("20%").value?.canonical.toString()).toBe("0.2");
  });

  // `％` U+FF05 is what a fullwidth keyboard produces from the `%` key, and it is
  // read without being listed: `normalize()` runs NFKC before a word reaches any
  // index, and NFKC folds the fullwidth form to the ASCII one. Asserted rather
  // than left in a comment, because the tempting "fix" is to add a dead alias
  // that reads as coverage.
  test("the fullwidth ％ reads through NFKC, not through an alias", () => {
    expect(percentTr.units["%"]?.aliases).not.toContain("％");
    expect(engine().evaluate("20％").formatted).toBe("20 %");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion
  // it can be the target of comes from outside the kind. Both of this language's
  // conversion keywords reach it: "çevir" is the verb, in its correct and its
  // ASCII spelling, and "to" is English's word folded into the same entry.
  test("reads a conversion into percent, through every in word", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(e.evaluate("5 bölü 50 çevir %").formatted).toBe("10 %");
    expect(e.evaluate("5 bölü 50 cevir %").formatted).toBe("10 %");
    expect(e.evaluate("5 bölü 50 to %").formatted).toBe("10 %");
  });

  // Where this package feels a decision taken in the language. Turkish states
  // both "of" and "off" with suffixes rather than free words — "50'nin %20'si"
  // (genitive) and "50 liradan %20 indirim" (ablative) — so
  // `@smartput/core/locale/tr` claims no word for either, and the arithmetic stays
  // reachable through the operators it does declare.
  test("there is no `of` and no `off` word, and the operators carry both", () => {
    expect(turkish.keywords.of).toBeUndefined();
    expect(turkish.keywords.off).toBeUndefined();
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    // The idiomatic Turkish phrasings, refused — loudly, which is the point.
    expect(() => e.evaluate("50'nin %20'si")).toThrow();
    // And the two readings that do work: a share through multiplication, and a
    // discount written as a subtraction.
    expect(e.evaluate("20% çarpı 50").value?.canonical.toString()).toBe("10");
    expect(e.evaluate("50 eksi 20%").formatted).toBe("40");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in this list where the Ukrainian file had to leave it
    // out: Turkish groups with "." and `normalize()`'s NFKC pass leaves that
    // alone, so "2.000 %" reads back as one quantity — as does the spaced symbol,
    // since `lex` ends the number at the blank and reads "%" as its own word.
    for (const input of ["20%", "1,5%", "2000%", "20 percent", "5% bölü 2", "50 pct"]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
