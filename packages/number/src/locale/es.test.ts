import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberEs from "./es";

const locale = composeLocale(spanish, [numberEs]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/** Anything only Spanish would write — the accented vowels and the ñ. */
const SPANISH = /[áéíóúüñ]/i;

describe("number es vocabulary", () => {
  test("it targets Spanish and names its kind by id", () => {
    expect(numberEs.locale).toBe("es");
    expect(numberEs.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on
  // the kind as a ratio-table key in any language — so this asserts the wrapper
  // the id was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // Spanish half: no accented word may reach the language-free side.
  test("the kind itself carries no Spanish word", () => {
    expect(JSON.stringify(number)).not.toMatch(/alias|symbol|lexicon/i);
    expect(JSON.stringify(number)).not.toMatch(SPANISH);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Spanish word
  // was smuggled in as an alias either. `spanish.numerals` claims "uno"/"una"
  // before any index is consulted, so an entry for them would be unreachable
  // machinery; "unidad" is the mathematical unit and not a thing anyone counts.
  test("declares no forms and no Spanish alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberEs.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      expect(words.aliases, `${unit} claims the cardinal`).not.toContain("uno");
      expect(words.aliases, `${unit} claims the cardinal`).not.toContain("una");
      expect(words.aliases, `${unit} claims a Spanish noun`).not.toContain("unidad");
    }
  });

  // "uno" would be unreachable as an alias because the numeral parser answers
  // first, and this is the measurement behind that claim rather than the
  // assertion that it was left out.
  test("the cardinal is read by the numeral parser, not by this table", () => {
    expect(engine.evaluate("uno").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("uno más uno").formatted).toBe("2");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `spanish.selectForm`'s `other`
    // category is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `es` vocabulary adds one — except
    // that here it can only confirm the absence of a `forms` table, since a unit
    // with none is skipped before any key is asked for. That is the honest shape
    // of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Spanish numbers", () => {
    // Spanish marks the decimal with "," — read out of CLDR by
    // `numberFormat: "intl"` — so "1,5" is the number and "1.5" is not.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    // And this is the Spanish trap, pinned rather than avoided: "." is the
    // *group* separator here, so "1.5" is not rejected the way it is under
    // Ukrainian (whose NBSP group mark NFKC folds away) — it is read as the
    // grouped integer 15. A user typing an English decimal gets a wrong number
    // rather than an error, and no vocabulary can change that: the two symbols
    // come from CLDR and the digits are grouped by `formatNumber` itself.
    expect(engine.evaluate("1.5").value?.canonical.toString()).toBe("15");
    // Grouped output, and — unlike Ukrainian's — output this engine can read
    // back: `normalize()`'s NFKC pass leaves "." alone where it folds U+00A0 to
    // a plain space, so the group mark survives to reach `lex`.
    expect(engine.evaluate("2000").formatted).toBe("2.000");
    expect(engine.evaluate("2.000").value?.canonical.toString()).toBe("2000");
    // Spanish cardinals in, Spanish digits out. "veintidós" is one fused word in
    // `CARDINALS`, which is why 22 does not arrive as "veinte y dos".
    expect(engine.evaluate("veintidós más uno").formatted).toBe("23");
    // The four arithmetic connectives this language declares, in the spellings
    // `es.ts` argues for: "por" is `times` (never `by`), "entre" is `over`.
    expect(engine.evaluate("3 por 4").formatted).toBe("12");
    expect(engine.evaluate("5 entre 2").formatted).toBe("2,5");
    expect(engine.evaluate("10 menos 4").formatted).toBe("6");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Spanish claims the
  // Latin word, so here the self-alias is live — which is the alias earning its
  // keep, since `formatNumber` emits exactly this string.
  test("the Latin self-alias is live under es, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      spanish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The two rows the default counts never reach: a fraction and a conversion
    // target with no count at all (ruling R5). Both are `other`, and both find
    // no table here, which is why the output below does not move across them.
    expect(key(1.5, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(numberEs.units.one?.forms).toBeUndefined();
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for both, which is the whole of what it contributes to
  // the Spanish phase: nothing is appended after the numeral, so 1 and 2 are
  // byte-identical to their own digits, in either slot.
  test("the 1/2 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word — "en metros"
    // next door. Here the word vanishes and the numeral is all that prints.
    expect(engine.evaluate("1 one en one").formatted).toBe("1");
    expect(engine.evaluate("2 one a one").formatted).toBe("2");
  });

  test("round-trips its own output", () => {
    // A fractional (the "," decimal), a grouped integer (the "." the Ukrainian
    // row could not round-trip), a spelled cardinal, and the facade's own
    // `${raw}one` string.
    for (const input of ["1,5", "2000", "veintidós más uno", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
