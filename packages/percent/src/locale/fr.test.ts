import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberFr from "@smartput/number/locale/fr";
import { percent } from "../index";
import percentFr from "./fr";

const locale = composeLocale(french, [percentFr]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/** Anything only French would write — the accented vowels and the cedilla. */
const FRENCH = /[àâçéèêëîïôùûüÿœ]/i;

/** The group separator CLDR hands French: U+202F NARROW NO-BREAK SPACE. */
const NNBSP = "\u202f";

describe("percent fr vocabulary", () => {
  test("it targets French and names its kind by id", () => {
    expect(percentFr.locale).toBe("fr");
    expect(percentFr.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is one ratio and one unit id, so nothing a language wrote may reach it.
  // French shares the Latin script with the kind's own ids, so the grep is for
  // what only French writes — the accents — plus the four words this file adds.
  test("the kind itself carries no French word", () => {
    const source = JSON.stringify(percent);
    expect(source).not.toMatch(FRENCH);
    expect(source).not.toMatch(/pourcent|pourcentage/i);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so a French engine still reads "20 pct" and the micro path cannot
  // drift; the French half is appended.
  test("reuses the Latin aliases and appends the French ones", () => {
    const aliases = percentFr.units["%"]?.aliases ?? [];
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    for (const word of ["pourcent", "pourcents", "pourcentage", "pourcentages"]) {
      expect(aliases, word).toContain(word);
    }
    expect(aliases.length).toBe(new Set(aliases).size);
  });

  // Where the Spanish file next door is half made of accent-free variants, this
  // is an observation rather than a decision: not one French word for this unit
  // carries an accent, so there is no second spelling to declare beside a first.
  test("no word it adds carries a written accent", () => {
    for (const word of percentFr.units["%"]?.aliases ?? []) {
      expect(word, `${word} is an accented spelling`).not.toMatch(FRENCH);
    }
  });

  // No `forms`, and for `en`'s reason rather than `uk`'s: French has an ordinary
  // noun here and would owe only two rows, so nothing had to be invented — the
  // written form of this unit is simply the symbol. Where the `en` unit decided
  // against word forms, this file does not add them.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentFr.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach: the default counts are all integers,
    // the sweep is skipped here either way, and the alias half of the contract is
    // what carries this kind — running the same call shape as every other `fr`
    // vocabulary keeps the row comparable. In French the fractional row is the
    // *singular* one, which is the row a table ported from English would miss.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      french.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The three rows that separate French from English: 0 is singular, and so is
    // every fraction below two — "zéro pour cent", "1,5 pour cent". English calls
    // both "other".
    expect(key(0, "after-number")).toBe("one");
    expect(key(1.5, "after-number")).toBe("one");
    expect(key(1.9, "after-number")).toBe("one");
    // The count-less conversion target (ruling R5), plus CLDR's `many`, which the
    // language folds into `other` so that no table in the repo owes a third key.
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(key(1_000_000, "after-number")).toBe("other");
    // French does not inflect a noun for its position, so the slot is not an
    // axis: two rows per unit, never four.
    expect(key(5, "after-number")).toBe(key(5, "conversion-target"));
    expect(percentFr.units["%"]?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes French percentages", () => {
    const e = engine();
    // The space before the symbol, which is the whole visible difference from the
    // Italian and Spanish siblings: `fr.ts` overrides `renderQuantity` to set one
    // space before every label, symbol included, because that is what French
    // typography does — "20 %", never "20%".
    expect(e.evaluate("20 pourcent").formatted).toBe("20 %");
    // The plural boundary, and the point of a symbol-only unit: the output does
    // *not* move across it. 1 and 1,5 select `one` and 2 selects `other`, but
    // there is no `forms` table to index, so all three render through `symbol`.
    expect(e.evaluate("1 pourcent").formatted).toBe("1 %");
    expect(e.evaluate("2 pourcents").formatted).toBe("2 %");
    expect(e.evaluate("5 pourcentage").formatted).toBe("5 %");
    // The fractional row — "," as the decimal mark, read from CLDR by
    // `numberFormat: "intl"`, and the count French would write singular.
    expect(e.evaluate("1,5 pourcent").formatted).toBe("1,5 %");
    // Grouped output, with French's U+202F NARROW NO-BREAK SPACE as the group
    // mark. `normalize()` folds it to a plain space on the way back in, so this
    // string is round-tripped below rather than only asserted.
    expect(e.evaluate("2000 pourcentage").formatted).toBe(`2${NNBSP}000 %`);
    // Both halves of the alias list read: the Latin ones come from the one map in
    // `units.ts`, because recognition is many-to-one and generation is one.
    expect(e.evaluate("50 pct").formatted).toBe("50 %");
    // The `of` operator through its French keyword, which is the partitive "de" —
    // "20 % de 50". The elided "d'" is not declared and could not be: `lex` keeps
    // an apostrophe between two letters inside the word, so "d'un" is one token.
    expect(e.evaluate("20% de 50").formatted).toBe("10");
  });

  // The trade `fr.ts` and `fr-cardinals.ts` make between them, recorded as a live
  // assertion instead of a comment. "pour cent" is what French actually writes,
  // it is two tokens, and exactly one of the fragments is claimed: "pour" is no
  // keyword — French spells `times` "fois"/"multiplié" and `by` "par" — while
  // "cent" is a declared scale worth 100. So unlike Italian's "per cento", which
  // silently multiplies, the French phrase fails outright, and it fails on the
  // half nothing claims.
  test("records that the two-token phrase does not parse, and why", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    expect(() => e.evaluate("20 pour cent")).toThrow(/pour/);
    // "cent" on its own is the numeral, which is the half of the phrase that does
    // have a reading.
    expect(e.evaluate("cent").value?.canonical.toString()).toBe("100");
    // The univerbated spelling is the one that reaches the unit, which is why it
    // is listed at all.
    expect(e.evaluate("20 pourcent").value?.kind).toBe("percent");
  });

  // The discount operator, which French does spell — `fr.ts` claims "remise",
  // the noun a French price line actually carries ("30 % de remise"). Italian
  // left `off` unclaimed and had to write the subtraction out; French does not.
  // It needs `number` registered, because `-|number|percent` is the signature
  // that finishes it.
  test("a discount reads through the French `off` keyword", () => {
    const e = createEngine({
      locales: [composeLocale(french, [percentFr, numberFr])],
      kinds: [percent, number],
    });
    expect(e.evaluate("30 % remise 50").formatted).toBe("35");
    // And the subtraction still says the same thing, which is what makes the
    // keyword a convenience rather than the only route.
    expect(e.evaluate("50 - 30% de 50").formatted).toBe("35");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion
  // it can be the target of comes from outside the kind. It needs `number`
  // registered, and it is tried through both of French's `in` keywords: "en" is
  // the ordinary conversion preposition and "vers" the directional one, and a
  // unit reachable through only one of them stops resolving the moment a user
  // picks the other.
  test("reads a conversion into percent through both `in` keywords", () => {
    const e = createEngine({
      locales: [composeLocale(french, [percentFr, numberFr])],
      kinds: [percent, number],
    });
    expect(e.evaluate("5 / 50 en pourcentage").formatted).toBe("10 %");
    expect(e.evaluate("5 / 50 vers %").formatted).toBe("10 %");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in the loop rather than beside it: French's U+202F is
    // folded to a plain space by `normalize()` and then held together by `lex`'s
    // three-digit lookahead, so "2 000 %" does lex back as one quantity — the
    // hazard Ukrainian's U+00A0 could not survive. The sum that lands on a
    // fraction is in it too, since a percentage of a percentage is the ordinary
    // way this kind reaches one.
    for (const input of [
      "2 pourcents",
      "5 pourcentages",
      "1,5 pourcent",
      "2000 pourcentage",
      "50 pct",
      "1 pourcent + 0,5 pourcent",
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
