import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberEs from "@smartput/number/locale/es";
import { percent } from "../index";
import percentEs from "./es";

const locale = composeLocale(spanish, [percentEs]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/** Anything only Spanish would write — the accented vowels and the ñ. */
const SPANISH = /[áéíóúüñ]/i;

describe("percent es vocabulary", () => {
  test("it targets Spanish and names its kind by id", () => {
    expect(percentEs.locale).toBe("es");
    expect(percentEs.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so nothing a language wrote may reach it.
  // Spanish shares the Latin script with the kind's own ids, so the grep is for
  // what only Spanish writes — the accents — plus the three words this file adds.
  test("the kind itself carries no Spanish word", () => {
    const source = JSON.stringify(percent);
    expect(source).not.toMatch(SPANISH);
    expect(source).not.toMatch(/porciento|porcentaje/i);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so a Spanish engine still reads "20 pct" and the micro path cannot
  // drift; the Spanish half is appended.
  test("reuses the Latin aliases and appends the Spanish ones", () => {
    const aliases = percentEs.units["%"]?.aliases ?? [];
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    expect(aliases).toContain("porciento");
    expect(aliases).toContain("porcentaje");
    expect(aliases).toContain("porcentajes");
    expect(aliases.length).toBe(new Set(aliases).size);
  });

  // No `forms`, and for `en`'s reason rather than `uk`'s: Spanish has an
  // ordinary noun here and would owe only two rows, so nothing had to be
  // invented — the written form of this unit is simply the symbol. Where the
  // `en` unit decided against word forms, this file does not add them.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentEs.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach: the default counts are all integers,
    // the sweep is skipped here either way, and the alias half of the contract
    // is what carries this kind — running the same call shape as every other
    // `es` vocabulary keeps the row comparable.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      spanish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The fractional row and the count-less conversion target (ruling R5) — the
    // two the default counts never reach. Both are `other`, and both find no
    // table here, which is why the output below does not move across them.
    expect(key(1.5, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(percentEs.units["%"]?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Spanish percentages", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only unit: the output does
    // *not* move across it. 1 selects `one` and 2 selects `other`, but there is
    // no `forms` table to index, so both render through `symbol`.
    expect(e.evaluate("1 porciento").formatted).toBe("1%");
    expect(e.evaluate("2 porciento").formatted).toBe("2%");
    expect(e.evaluate("5 porcentajes").formatted).toBe("5%");
    // The fractional row — "," as the decimal mark, read from CLDR by
    // `numberFormat: "intl"`.
    expect(e.evaluate("1,5 porciento").formatted).toBe("1,5%");
    // Grouped output, with Spanish's "." as the group mark. Unlike Ukrainian's
    // U+00A0 this survives `normalize()`, so it is asserted *and* round-tripped
    // below rather than only asserted.
    expect(e.evaluate("2000 porcentaje").formatted).toBe("2.000%");
    // Both halves of the alias list read: the Latin ones come from the one map
    // in `units.ts`, because recognition is many-to-one and generation is one.
    expect(e.evaluate("50 pct").formatted).toBe("50%");
    // The `of` operator through its Spanish keyword ("de"), and `off` through
    // the noun "descuento" that `es.ts` adds rather than ship a language whose
    // operator is unspellable.
    expect(e.evaluate("20% de 50").formatted).toBe("10");
    expect(e.evaluate("20% descuento 50").formatted).toBe("40");
  });

  // The trade `es.ts` makes on "por", recorded as a live assertion instead of a
  // comment. "por ciento" is what Spanish actually writes, it is two tokens, and
  // its fragments are both claimed: "por" is the `times` keyword and "ciento" is
  // a declared cardinal. So the phrase does not fail — it multiplies. Taking
  // "por" away from `times` to buy this back would cost "3 por 4", which is the
  // commoner input by a distance.
  test("records that the two-token phrase reads as arithmetic, not as a unit", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    const result = e.evaluate("20 por ciento");
    expect(result.value?.kind).toBe("number");
    expect(result.value?.canonical.toString()).toBe("2000");
    // The single-token spellings are the ones that reach the unit, which is why
    // all three are listed.
    expect(e.evaluate("20 porciento").value?.kind).toBe("percent");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather
  // than a unit-to-unit change — percent has exactly one unit, so the only
  // conversion it can be the target of comes from outside the kind. It needs
  // `number` registered, and it is tried through both of Spanish's `in`
  // keywords: "en" is the locative preposition and "a" the directional one, and
  // a unit reachable through only one of them stops resolving the moment a user
  // picks the other.
  test("reads a conversion into percent through both `in` keywords", () => {
    const e = createEngine({
      locales: [composeLocale(spanish, [percentEs, numberEs])],
      kinds: [percent, number],
    });
    expect(e.evaluate("5 / 50 en porcentaje").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 a %").formatted).toBe("10%");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in the loop, unlike the Ukrainian file's: Spanish
    // groups with "." and `normalize()`'s NFKC pass leaves it alone, so
    // "2.000%" lexes back as one quantity where "2 000%" could not.
    for (const input of [
      "2 porciento",
      "5 porcentajes",
      "1,5 porciento",
      "2000 porcentaje",
      "50 pct",
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
