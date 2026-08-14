import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberIt from "@smartput/number/locale/it";
import { percent } from "../index";
import percentIt from "./it";

const locale = composeLocale(italian, [percentIt]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/** Anything only Italian would write — the five accented vowels it uses. */
const ITALIAN = /[àèéìòù]/i;

describe("percent it vocabulary", () => {
  test("it targets Italian and names its kind by id", () => {
    expect(percentIt.locale).toBe("it");
    expect(percentIt.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so nothing a language wrote may reach it.
  // Italian shares the Latin script with the kind's own ids, so the grep is for
  // what only Italian writes — the accents — plus the three words this file adds.
  test("the kind itself carries no Italian word", () => {
    const source = JSON.stringify(percent);
    expect(source).not.toMatch(ITALIAN);
    expect(source).not.toMatch(/percento|percentuale/i);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so an Italian engine still reads "20 pct" and the micro path cannot
  // drift; the Italian half is appended.
  test("reuses the Latin aliases and appends the Italian ones", () => {
    const aliases = percentIt.units["%"]?.aliases ?? [];
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    expect(aliases).toContain("percento");
    expect(aliases).toContain("percentuale");
    expect(aliases).toContain("percentuali");
    expect(aliases.length).toBe(new Set(aliases).size);
  });

  // No `forms`, and for `en`'s reason rather than `uk`'s: Italian has an
  // ordinary noun here and would owe only two rows, so nothing had to be
  // invented — the written form of this unit is simply the symbol. Where the
  // `en` unit decided against word forms, this file does not add them.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentIt.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach: the default counts are all integers,
    // the sweep is skipped here either way, and the alias half of the contract
    // is what carries this kind — running the same call shape as every other
    // `it` vocabulary keeps the row comparable.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      italian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The fractional row and the count-less conversion target (ruling R5) — the
    // two the default counts never reach — plus CLDR's `many`, which the
    // language folds into `other` so that no table in the repo owes a third key.
    expect(key(1.5, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(key(1_000_000, "after-number")).toBe("other");
    expect(percentIt.units["%"]?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Italian percentages", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only unit: the output does
    // *not* move across it. 1 selects `one` and 2 selects `other`, but there is
    // no `forms` table to index, so both render through `symbol`.
    expect(e.evaluate("1 percento").formatted).toBe("1%");
    expect(e.evaluate("2 percento").formatted).toBe("2%");
    expect(e.evaluate("5 percentuali").formatted).toBe("5%");
    // The fractional row — "," as the decimal mark, read from CLDR by
    // `numberFormat: "intl"`.
    expect(e.evaluate("1,5 percento").formatted).toBe("1,5%");
    // Grouped output, with Italian's "." as the group mark. Unlike Ukrainian's
    // U+00A0 this survives `normalize()`, so it is asserted *and* round-tripped
    // below rather than only asserted.
    expect(e.evaluate("2000 percentuale").formatted).toBe("2.000%");
    // Both halves of the alias list read: the Latin ones come from the one map
    // in `units.ts`, because recognition is many-to-one and generation is one.
    expect(e.evaluate("50 pct").formatted).toBe("50%");
    // The `of` operator through its Italian keyword, which is the partitive
    // "di" — "il 20% di 50".
    expect(e.evaluate("20% di 50").formatted).toBe("10");
  });

  // `italian.keywords` deliberately leaves `off` unclaimed — Italian's "sconto"
  // is a bare noun that would swallow ordinary prose the moment it became an
  // operator demanding two operands — so where `en` writes "20% off 50" and `es`
  // writes "20% descuento 50", Italian writes the subtraction out. This is that
  // decision as a live assertion: the discount is still expressible, through the
  // `of` keyword the language does have a word for. It needs `number`
  // registered, because `-|number|number` is the signature that finishes it.
  test("a discount is the subtraction, since `off` has no Italian word", () => {
    const e = createEngine({
      locales: [composeLocale(italian, [percentIt, numberIt])],
      kinds: [percent, number],
    });
    expect(e.evaluate("50 - 20% di 50").formatted).toBe("40");
    for (const words of Object.values(italian.keywords)) {
      expect(words).not.toContain("sconto");
    }
  });

  // The trade `it.ts` makes on "per", recorded as a live assertion instead of a
  // comment. "per cento" is what Italian actually writes, it is two tokens, and
  // its fragments are both claimed: "per" is the `times` keyword and "cento" is
  // a declared scale in the cardinal table. So the phrase does not fail — it
  // multiplies. Taking "per" away from `times` to buy this back would cost
  // "3 per 4", which is how Italian says multiplication out loud.
  test("records that the two-token phrase reads as arithmetic, not as a unit", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    const result = e.evaluate("20 per cento");
    expect(result.value?.kind).toBe("number");
    expect(result.value?.canonical.toString()).toBe("2000");
    // The univerbated spelling is the one that reaches the unit, which is why it
    // is listed at all.
    expect(e.evaluate("20 percento").value?.kind).toBe("percent");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather
  // than a unit-to-unit change — percent has exactly one unit, so the only
  // conversion it can be the target of comes from outside the kind. It needs
  // `number` registered, and it is tried through both of Italian's `in`
  // keywords: "in" is the locative preposition and "a" the directional one, and
  // a unit reachable through only one of them stops resolving the moment a user
  // picks the other.
  test("reads a conversion into percent through both `in` keywords", () => {
    const e = createEngine({
      locales: [composeLocale(italian, [percentIt, numberIt])],
      kinds: [percent, number],
    });
    expect(e.evaluate("5 / 50 in percentuale").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 a %").formatted).toBe("10%");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in the loop, unlike the Ukrainian file's: Italian
    // groups with "." and `normalize()`'s NFKC pass leaves it alone, so
    // "2.000%" lexes back as one quantity where "2 000%" could not. The sum that
    // lands on a fraction is in it too, since a percentage of a percentage is
    // the ordinary way this kind reaches one.
    for (const input of [
      "2 percento",
      "5 percentuali",
      "1,5 percento",
      "2000 percentuale",
      "50 pct",
      "1 percento + 0,5 percento",
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
