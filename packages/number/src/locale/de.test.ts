import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberDe from "./de";

const locale = composeLocale(german, [numberDe]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Anything only German would write. The three umlauts and the ß are the whole
 * of what separates German orthography from ASCII, which is why this regex is
 * shorter than the Spanish one next door and much shorter than Ukrainian's — a
 * German word smuggled into the language-free half would not necessarily carry
 * one, so the test that uses this also greps for the words themselves.
 */
const GERMAN = /[äöüß]/i;

/** The closed key set `german.selectForm` can produce — no more, no fewer. */
const FOUR_KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

describe("number de vocabulary", () => {
  test("it targets German and names its kind by id", () => {
    expect(numberDe.locale).toBe("de");
    expect(numberDe.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on
  // the kind as a ratio-table key in any language — so this asserts the wrapper
  // the id was quoted inside is gone, exactly as `en.test.ts` does, and adds the
  // German half: neither an umlaut nor either of the two German words this file
  // argues about may reach the language-free side.
  test("the kind itself carries no German word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(GERMAN);
    expect(source).not.toMatch(/eins|einheit/i);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no German word was
  // smuggled in as an alias either. `german.numerals` claims "ein"/"eins"/"eine"
  // before any index is consulted, so an entry for them would be unreachable
  // machinery; "Einheit" is the mathematical unit and not a thing anyone counts.
  test("declares no forms and no German alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberDe.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const word of ["ein", "eins", "eine", "einheit"]) {
        expect(words.aliases, `${unit} claims ${word}`).not.toContain(word);
      }
    }
  });

  // "eins" would be unreachable as an alias because the numeral parser answers
  // first, and this is the measurement behind that claim rather than the
  // assertion that it was left out. The compound row is the German-only half:
  // "einundzwanzig" is one token, so it is `de-cardinals.ts`'s single-token
  // decomposer answering, not a run of words.
  test("the cardinal is read by the numeral parser, not by this table", () => {
    expect(engine.evaluate("eins").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("einundzwanzig").value?.canonical.toString()).toBe("21");
    expect(engine.evaluate("einundzwanzig plus eins").formatted).toBe("22");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `german.selectForm`'s `other`
    // category is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `de` vocabulary adds one — except
    // that here it can only confirm the absence of a `forms` table, since a unit
    // with none is skipped before any key is asked for. That is the honest shape
    // of this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes German numbers", () => {
    // German marks the decimal with "," and groups with "." — the exact inverse
    // of English, read out of CLDR by `numberFormat: "intl"`.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    // And this is the trap that inverse sets, pinned rather than avoided: "." is
    // the *group* separator here, so "1.5" is not rejected the way it is under
    // Ukrainian (whose NBSP group mark NFKC folds away) — it is read as the
    // grouped integer 15. A user typing an English decimal gets a wrong number
    // rather than an error, and no vocabulary can change that: both symbols come
    // from CLDR and the digits are grouped by `formatNumber` itself.
    expect(engine.evaluate("1.5").value?.canonical.toString()).toBe("15");
    // Grouped output, and — unlike Ukrainian's — output this engine can read
    // back: `normalize()`'s NFKC pass leaves "." alone where it folds U+00A0 to
    // a plain space, so the group mark survives to reach `lex`.
    expect(engine.evaluate("2000").formatted).toBe("2.000");
    expect(engine.evaluate("2.000").value?.canonical.toString()).toBe("2000");
    // German cardinals in, German digits out. Both of these are *single tokens*,
    // which is the whole reason `de` ships its own `numerals`: the shared
    // `cardinalNumerals` reads a run of words and would return null for either.
    expect(engine.evaluate("zweitausend").formatted).toBe("2.000");
    expect(engine.evaluate("dreihundertfünfundvierzig").formatted).toBe("345");
    // The arithmetic connectives this language declares, in the spellings `de.ts`
    // argues for: "mal" is `times`, and "geteilt durch" is one operator built
    // from `over` + `by`, exactly as English's "divided by" is.
    expect(engine.evaluate("3 mal 4").formatted).toBe("12");
    expect(engine.evaluate("5 geteilt durch 2").formatted).toBe("2,5");
    expect(engine.evaluate("5 dividiert durch 2").formatted).toBe("2,5");
    expect(engine.evaluate("10 minus 4").formatted).toBe("6");
    expect(engine.evaluate("10 plus 4").formatted).toBe("14");
  });

  // The cost `de.ts` states out loud rather than hides, asserted here because
  // this is the package where a bare arithmetic expression is the whole input:
  // "durch" is claimed as `by`, so a stray one fails at the parser. Claiming it
  // as `over` instead would break the commoner, fully spelled "geteilt durch",
  // and it is exactly English's arrangement — "10 by 2" does not parse there
  // either.
  test("a bare durch does not divide, and that is the stated trade", () => {
    expect(() => engine.evaluate("10 durch 2")).toThrow();
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in German claims the
  // Latin word — the suffix stripper cannot touch it either, since dropping "e"
  // would leave a two-letter stem under `minStem: 3` — so here the self-alias is
  // live, which is the alias earning its keep: `formatNumber` emits exactly this
  // string.
  test("the Latin self-alias is live under de, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("selectForm answers four keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      german.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(2, "after-number")).toBe("nom-other");
    expect(key(1, "conversion-target")).toBe("dat-one");
    // The two rows the default counts never reach: a fraction, and a conversion
    // target with no count at all (ruling R5). Both are `other`.
    expect(key(1.5, "after-number")).toBe("nom-other");
    expect(key(undefined, "conversion-target")).toBe("dat-other");
    // The closed set, so a language that grew a fifth key would have to come
    // back through this file.
    expect(
      [
        ...new Set(
          [1, 2, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
        ),
      ].sort(),
    ).toEqual(FOUR_KEYS);
    expect(numberDe.units.one?.forms).toBeUndefined();
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for both, which is the whole of what it contributes to
  // the German phase: nothing is appended after the numeral, so 1 and 2 are
  // byte-identical to their own digits, in either slot — and the dative the
  // conversion target selects is invisible for the same reason.
  test("the 1/2 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word — "in Metern"
    // next door. Here the word vanishes and the numeral is all that prints.
    expect(engine.evaluate("1 one in one").formatted).toBe("1");
    expect(engine.evaluate("2 one nach one").formatted).toBe("2");
  });

  // German is the first language to override `renderQuantity`, and it overrides
  // exactly the branch a `symbol: ""` unit would take: a symbol is set off from
  // the number by a space (DIN 1301-1), where the default sets it tight. If that
  // branch were reachable here, every German count would carry a trailing space.
  // It is not — `formatValue` returns the bare number text on `NUMBER_KIND`
  // before any symbol is read — and this is the assertion that says so.
  test("the empty symbol never reaches German's spaced-symbol branch", () => {
    expect(numberDe.units.one?.symbol).toBe("");
    expect(engine.evaluate("7,25").formatted).toBe("7,25");
    expect(engine.evaluate("7,25").formatted).not.toMatch(/\s$/);
  });

  test("round-trips its own output", () => {
    // A fractional (the "," decimal), a grouped integer (the "." the Ukrainian
    // row could not round-trip), two single-token German cardinals, and the
    // facade's own `${raw}one` string.
    for (const input of [
      "1,5",
      "2000",
      "zweitausend",
      "einundzwanzig plus eins",
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
