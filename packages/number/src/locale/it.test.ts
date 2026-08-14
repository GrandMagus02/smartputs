import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberIt from "./it";

const locale = composeLocale(italian, [numberIt]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/** Anything only Italian would write — the five accented vowels it uses. */
const ITALIAN = /[àèéìòù]/i;

describe("number it vocabulary", () => {
  test("it targets Italian and names its kind by id", () => {
    expect(numberIt.locale).toBe("it");
    expect(numberIt.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on
  // the kind as a ratio-table key in any language — so this asserts the wrapper
  // the id was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // Italian half: no accented word may reach the language-free side.
  test("the kind itself carries no Italian word", () => {
    expect(JSON.stringify(number)).not.toMatch(/alias|symbol|lexicon/i);
    expect(JSON.stringify(number)).not.toMatch(ITALIAN);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Italian word
  // was smuggled in as an alias either. `italian.numerals` claims "uno", "un"
  // and "una" before any index is consulted, so an entry for them would be
  // unreachable machinery; "unità" *would* be reachable and is refused on the
  // meaning instead, being the mathematical unit rather than a countable noun.
  test("declares no forms and no Italian alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberIt.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const cardinal of ["uno", "un", "una"]) {
        expect(words.aliases, `${unit} claims the cardinal`).not.toContain(cardinal);
      }
      expect(words.aliases, `${unit} claims an Italian noun`).not.toContain("unità");
    }
  });

  // "uno" would be unreachable as an alias because the numeral parser answers
  // first, and this is the measurement behind that claim rather than the
  // assertion that it was left out. "unità" is the other half of the same
  // measurement: the welded-numeral parser must consume a whole token, refuses
  // this one outright, and so leaves the word free — which is why its absence
  // upstairs is a lexical decision and not a mechanical one.
  test("the cardinal is read by the numeral parser, and the noun is not", () => {
    expect(engine.evaluate("uno").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("un").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("uno più uno").formatted).toBe("2");
    expect(() => engine.evaluate("unità")).toThrow();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `italian.selectForm`'s `other`
    // category is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `it` vocabulary adds one — except
    // that here it can only confirm the absence of a `forms` table, since a unit
    // with none is skipped before any key is asked for. That is the honest shape
    // of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Italian numbers", () => {
    // Italian marks the decimal with "," — read out of CLDR by
    // `numberFormat: "intl"` — so "1,5" is the number and "1.5" is not.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    // And this is the Italian trap, the same one Spanish has, pinned rather than
    // avoided: "." is the *group* separator here, so "1.5" is not rejected the
    // way it is under Ukrainian (whose NBSP group mark NFKC folds away) — it is
    // read as the grouped integer 15. A user typing an English decimal gets a
    // wrong number rather than an error, and no vocabulary can change that: the
    // two symbols come from CLDR and the digits are grouped by `formatNumber`.
    expect(engine.evaluate("1.5").value?.canonical.toString()).toBe("15");
    // Grouped output, and — unlike Ukrainian's — output this engine can read
    // back: `normalize()`'s NFKC pass leaves "." alone where it folds U+00A0 to
    // a plain space, so the group mark survives to reach `lex`.
    expect(engine.evaluate("2000").formatted).toBe("2.000");
    expect(engine.evaluate("2.000").value?.canonical.toString()).toBe("2000");
    // Italian cardinals in, Italian digits out. Every one of them is a single
    // welded word — "ventidue", never "venti due" — which is the shape
    // `it-cardinals.ts` exists to read, and "centoundici" is the row that pins
    // the elision rule as being keyed on the value: 111 does not elide.
    expect(engine.evaluate("ventidue più uno").formatted).toBe("23");
    expect(engine.evaluate("centoundici").formatted).toBe("111");
    expect(engine.evaluate("duemilatrecento").formatted).toBe("2.300");
    // The accent-free spelling of a keyword, declared beside the accented one
    // because a keyboard without accents is the commoner keyboard.
    expect(engine.evaluate("uno piu uno").formatted).toBe("2");
    // The four arithmetic connectives this language declares, in the spellings
    // `it.ts` argues for: "per" is `times` (never `by`), "diviso" is a complete
    // operator with no helper word after it.
    expect(engine.evaluate("3 per 4").formatted).toBe("12");
    expect(engine.evaluate("5 diviso 2").formatted).toBe("2,5");
    expect(engine.evaluate("10 meno 4").formatted).toBe("6");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Italian claims the
  // Latin word — "one" has no remainder `decompose` can read — so here the
  // self-alias is live, which is the alias earning its keep, since
  // `formatNumber` emits exactly this string.
  test("the Latin self-alias is live under it, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      italian.selectForm({
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
    // CLDR's third Italian category, folded into `other` by the language: an
    // exact million is `many` upstream and `other` here, which is why no table
    // in this repo carries a third key.
    expect(key(1_000_000, "after-number")).toBe("other");
    expect(numberIt.units.one?.forms).toBeUndefined();
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for both, which is the whole of what it contributes to
  // the Italian phase: nothing is appended after the numeral, so 1 and 2 are
  // byte-identical to their own digits, in either slot.
  test("the 1/2 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word — "in metri"
    // next door. Here the word vanishes and the numeral is all that prints, and
    // both of Italian's `in` keywords are tried: a unit reachable through only
    // one of them stops resolving the moment a user picks the other.
    expect(engine.evaluate("1 one in one").formatted).toBe("1");
    expect(engine.evaluate("2 one a one").formatted).toBe("2");
  });

  test("round-trips its own output", () => {
    // A fractional (the "," decimal), a grouped integer (the "." the Ukrainian
    // row could not round-trip), a welded cardinal, a sum that lands on a
    // fraction, and the facade's own `${raw}one` string.
    for (const input of ["1,5", "2000", "ventidue più uno", "5 diviso 2", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
