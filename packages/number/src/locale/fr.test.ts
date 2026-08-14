import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberFr from "./fr";

const locale = composeLocale(french, [numberFr]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/** Anything only French would write — the accented vowels and the cedilla. */
const FRENCH = /[àâçéèêëîïôùûüÿœ]/i;

/**
 * The group separator this runtime's CLDR hands `numberFormat: "intl"` for
 * French: U+202F NARROW NO-BREAK SPACE, not the U+00A0 Ukrainian groups with and
 * not the plain space a fixture would show. Written as an escape so the
 * codepoint is visible in the source, which is the whole reason it is named.
 */
const NNBSP = "\u202f";

describe("number fr vocabulary", () => {
  test("it targets French and names its kind by id", () => {
    expect(numberFr.locale).toBe("fr");
    expect(numberFr.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on
  // the kind as a ratio-table key in any language — so this asserts the wrapper
  // the id was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // French half: no accented word may reach the language-free side.
  test("the kind itself carries no French word", () => {
    expect(JSON.stringify(number)).not.toMatch(/alias|symbol|lexicon/i);
    expect(JSON.stringify(number)).not.toMatch(FRENCH);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no French word was
  // smuggled in as an alias either. `french.numerals` claims "un" and "une"
  // before any index is consulted, so an entry for them would be unreachable
  // machinery; "unité" *would* be reachable, since the numeral fold matches whole
  // words against its four tables and that word is in none of them, and it is
  // refused on the meaning instead — it is the mathematical unit, not a countable
  // noun.
  test("declares no forms and no French alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberFr.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const cardinal of ["un", "une"]) {
        expect(words.aliases, `${unit} claims the cardinal`).not.toContain(cardinal);
      }
      expect(words.aliases, `${unit} claims a French noun`).not.toContain("unité");
    }
  });

  // "un" would be unreachable as an alias because the numeral parser answers
  // first, and this is the measurement behind that claim rather than the
  // assertion that it was left out. "unité" is the other half of the same
  // measurement: the fold matches whole words and has no entry for it, so the
  // word is free — which is why its absence upstairs is a lexical decision and
  // not a mechanical one.
  test("the cardinal is read by the numeral parser, and the noun is not", () => {
    expect(engine.evaluate("un").value?.canonical.toString()).toBe("1");
    // The feminine, which is a second key on the value 1 and never the spelling.
    expect(engine.evaluate("une").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("un plus un").formatted).toBe("2");
    expect(() => engine.evaluate("unité")).toThrow();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `french.selectForm`'s fractional
    // row is never reached at all — and in French that row is the *singular* one,
    // which makes it the row a table ported from English gets wrong. A fractional
    // count is added for the same reason every other `fr` vocabulary adds one —
    // except that here it can only confirm the absence of a `forms` table, since
    // a unit with none is skipped before any key is asked for. That is the honest
    // shape of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French numbers", () => {
    // French marks the decimal with "," — read out of CLDR by
    // `numberFormat: "intl"` — so "1,5" is the number and "1.5" is not. Unlike
    // Italian and Spanish, where "." is the *group* mark and "1.5" quietly reads
    // as 15, French groups with a space, so the English decimal has no reading at
    // all here and is refused rather than misread.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    expect(() => engine.evaluate("1.5")).toThrow();
    // The separator that is the whole French hazard: an invisible *and* narrow
    // space. Pinned by codepoint, because a plain space in a fixture would pass
    // against an implementation that had hardcoded Ukrainian's U+00A0 and lost
    // every French group.
    expect(engine.evaluate("2000").formatted).toBe(`2${NNBSP}000`);
    expect(engine.evaluate("1234567").formatted).toBe(`1${NNBSP}234${NNBSP}567`);
    // And the round trip that separator has to survive. `normalize()` folds every
    // whitespace run to one plain space before `lex` sees it, so the string above
    // arrives back as "2 000" — which stays one number only because `lex`'s
    // three-digit lookahead says so. Both spellings are asserted: the engine's
    // own output, and the plain space a user retypes.
    expect(engine.evaluate(`2${NNBSP}000`).value?.canonical.toString()).toBe("2000");
    expect(engine.evaluate("2 000").value?.canonical.toString()).toBe("2000");
    // The lookahead's other side: three digits after the space is a group, two is
    // two numbers, and the second one has nothing to be.
    expect(() => engine.evaluate("2 30")).toThrow();
    // French cardinals in, French digits out. "quatre-vingts" is the vigesimal 80
    // `fr-cardinals.ts` needed a rule of its own for, and "quatre-vingt-dix-sept"
    // is that product plus a teen — the hyphens are absorbed by `foldNumerals`'
    // run collector, so the parser is offered a run of plain words.
    expect(engine.evaluate("vingt-deux plus un").formatted).toBe("23");
    expect(engine.evaluate("quatre-vingts").formatted).toBe("80");
    expect(engine.evaluate("quatre-vingt-dix-sept").formatted).toBe("97");
    expect(engine.evaluate("deux mille trois cents").formatted).toBe(`2${NNBSP}300`);
    // The four arithmetic connectives this language declares, in the spellings
    // `fr.ts` argues for: "fois" is the bare `times` and "multiplié par" the
    // phrasal one, whose "par" is swallowed by `foldWordOps`.
    expect(engine.evaluate("3 fois 4").formatted).toBe("12");
    expect(engine.evaluate("3 multiplié par 4").formatted).toBe("12");
    expect(engine.evaluate("5 divisé par 2").formatted).toBe("2,5");
    expect(engine.evaluate("10 moins 4").formatted).toBe("6");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in French claims the
  // Latin word — it is in none of the four cardinal tables — so here the
  // self-alias is live, which is the alias earning its keep, since `formatNumber`
  // emits exactly this string.
  test("the Latin self-alias is live under fr, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      french.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The three rows that separate French from English, and the reason a table
    // ported by renaming columns would be wrong: 0 is singular, and so is every
    // fraction below two. English calls both "other".
    expect(key(0, "after-number")).toBe("one");
    expect(key(1.5, "after-number")).toBe("one");
    expect(key(1.9, "after-number")).toBe("one");
    // A conversion target with no count at all (ruling R5) is `other`, which is
    // also correct French — the target of a conversion is named in the plural.
    expect(key(undefined, "conversion-target")).toBe("other");
    // CLDR's third French category, folded into `other` by the language: an exact
    // million is `many` upstream and `other` here, which is why no table in this
    // repo carries a third key.
    expect(key(1_000_000, "after-number")).toBe("other");
    expect(numberFr.units.one?.forms).toBeUndefined();
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for all of them, which is the whole of what it
  // contributes to the French phase: nothing is appended after the numeral, so 1
  // and 2 are byte-identical to their own digits, in either slot — and so is the
  // fraction French would have written singular.
  test("the 1/2 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    // A conversion, where every other kind prints a target word — "en grammes"
    // next door. Here the word vanishes and the numeral is all that prints, and
    // both of French's `in` keywords are tried: a unit reachable through only one
    // of them stops resolving the moment a user picks the other.
    expect(engine.evaluate("1 one en one").formatted).toBe("1");
    expect(engine.evaluate("2 one vers one").formatted).toBe("2");
  });

  test("round-trips its own output", () => {
    // A fractional (the "," decimal), a grouped integer (the U+202F the sibling
    // languages' "." never has to survive), a vigesimal cardinal, a sum that
    // lands on a fraction, and the facade's own `${raw}one` string.
    for (const input of [
      "1,5",
      "2000",
      "1234567",
      "quatre-vingt-dix-sept plus un",
      "5 divisé par 2",
      "999one",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
