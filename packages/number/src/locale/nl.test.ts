import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberNl from "./nl";

const locale = composeLocale(dutch, [numberNl]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Anything only Dutch would write. The trema and the acute are the whole of what
 * separates Dutch orthography from ASCII — and unlike German's `[äöüß]` this
 * catches almost nothing, because Dutch spells "een", "eenheid" and every
 * measure noun in bare Latin letters. So the test that uses it greps for the
 * words themselves beside it, which is the half that has teeth.
 */
const DUTCH = /[ëïéèöü]/i;

/** The closed key set `dutch.selectForm` can produce — no more, no fewer. */
const TWO_KEYS = ["one", "other"];

describe("number nl vocabulary", () => {
  test("it targets Dutch and names its kind by id", () => {
    expect(numberNl.locale).toBe("nl");
    expect(numberNl.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on the
  // kind as a ratio-table key in any language — so this asserts the wrapper the id
  // was quoted inside is gone, exactly as `en.test.ts` does, and adds the Dutch
  // half: neither a trema nor either of the two Dutch words this file argues about
  // may reach the language-free side.
  test("the kind itself carries no Dutch word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(DUTCH);
    expect(source).not.toMatch(/eenheid|\been\b/i);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Dutch word was
  // smuggled in as an alias either. `dutch.numerals` claims "een"/"één" before any
  // index is consulted, so an entry for them would be unreachable machinery;
  // "eenheid" is the mathematical unit and not a thing anyone counts.
  test("declares no forms and no Dutch alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test above
    // owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberNl.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const word of ["een", "één", "eenheid"]) {
        expect(words.aliases, `${unit} claims ${word}`).not.toContain(word);
      }
    }
  });

  // "een" would be unreachable as an alias because the numeral parser answers
  // first, and this is the measurement behind that claim rather than the assertion
  // that it was left out. The compound rows are the Dutch-only half:
  // "eenentwintig" and "tweeduizend" are single tokens, so it is
  // `nl-cardinals.ts`'s own reader answering, not a run of words — and "één" with
  // its Taalunie accents is the standalone spelling of the same 1.
  test("the cardinal is read by the numeral parser, not by this table", () => {
    expect(engine.evaluate("een").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("één").value?.canonical.toString()).toBe("1");
    expect(engine.evaluate("eenentwintig").value?.canonical.toString()).toBe("21");
    expect(engine.evaluate("eenentwintig plus één").formatted).toBe("22");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `dutch.selectForm`'s `other`
    // category is never reached through a fraction at all. A fractional count is
    // added for the same reason every other `nl` vocabulary adds one — except that
    // here it can only confirm the absence of a `forms` table, since a unit with
    // none is skipped before any key is asked for. That is the honest shape of
    // this kind's coverage.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Dutch numbers", () => {
    // Dutch marks the decimal with "," and groups with "." — German's pair, and
    // the exact inverse of English's, read out of CLDR by `numberFormat: "intl"`.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    // And this is the trap that inverse sets, pinned rather than avoided: "." is
    // the *group* separator here, so "1.5" is not rejected the way it is under
    // Ukrainian (whose NBSP group mark NFKC folds away) — it is read as the
    // grouped integer 15. A user typing an English decimal gets a wrong number
    // rather than an error, and no vocabulary can change that: both symbols come
    // from CLDR and the digits are grouped by `formatNumber` itself.
    expect(engine.evaluate("1.5").value?.canonical.toString()).toBe("15");
    // Grouped output, and — like German's, unlike Ukrainian's — output this engine
    // can read back: `normalize()`'s NFKC pass leaves "." alone where it folds
    // U+00A0 to a plain space, so the group mark survives to reach `lex`.
    expect(engine.evaluate("2000").formatted).toBe("2.000");
    expect(engine.evaluate("2.000").value?.canonical.toString()).toBe("2000");
    // Dutch cardinals in, Dutch digits out. Both of these are *single tokens*,
    // which is the whole reason `nl` ships its own `numerals`: the shared
    // `cardinalNumerals` reads a run of words and would return null for either.
    expect(engine.evaluate("tweeduizend").formatted).toBe("2.000");
    expect(engine.evaluate("driehonderdvijfenveertig").formatted).toBe("345");
    // The arithmetic connectives this language declares, in the spellings `nl.ts`
    // argues for: "maal" is the worksheet multiplier and "keer" the spoken one,
    // and "gedeeld door" is one operator built from `over` + `by`, exactly as
    // English's "divided by" and German's "geteilt durch" are.
    expect(engine.evaluate("3 maal 4").formatted).toBe("12");
    expect(engine.evaluate("3 keer 4").formatted).toBe("12");
    expect(engine.evaluate("5 gedeeld door 2").formatted).toBe("2,5");
    // "minus" and not "min": `nl.ts` gives the whole argument, and the short
    // version is that "min" is the minute's language-neutral symbol and a
    // keyword is consumed by `lex` before any alias index is reached.
    expect(engine.evaluate("10 minus 4").formatted).toBe("6");
    expect(engine.evaluate("10 plus 4").formatted).toBe("14");
  });

  // The cost `nl.ts` states out loud rather than hides, asserted here because this
  // is the package where a bare arithmetic expression is the whole input: "door"
  // is claimed as `by`, so a stray one fails at the parser. Claiming it as `over`
  // instead would break the commoner, fully spelled "gedeeld door", and it is
  // exactly English's and German's arrangement — "10 by 2" does not parse there
  // either.
  test("a bare door does not divide, and that is the stated trade", () => {
    expect(() => engine.evaluate("10 door 2")).toThrow();
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Dutch claims the Latin
  // word — the suffix stripper cannot touch it either, since "one" ends in none of
  // `s`, `'s`, `n`, and `compoundSplitter`'s `minPart: 3` leaves a three-letter
  // word with no legal cut — so here the self-alias is live, which is the alias
  // earning its keep: `formatNumber` emits exactly this string.
  test("the Latin self-alias is live under nl, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      dutch.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The slot is read and discarded: Dutch lost its case marking on common nouns,
    // so a conversion target selects the same key a bare quantity does. This is the
    // single line that separates the Dutch contract from the German one next door,
    // where the same call returns "dat-one".
    expect(key(1, "conversion-target")).toBe("one");
    // The two rows the default counts never reach: a fraction, and a conversion
    // target with no count at all (ruling R5). Both are `other`.
    expect(key(1.5, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    // The closed set, so a language that grew a third key would have to come back
    // through this file.
    expect(
      [
        ...new Set(
          [1, 2, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
        ),
      ].sort(),
    ).toEqual(TWO_KEYS);
    expect(numberNl.units.one?.forms).toBeUndefined();
  });

  // The plural boundary every sibling row turns into two different words. This
  // kind has one answer for both, which is the whole of what it contributes to the
  // Dutch phase: nothing is appended after the numeral, so 1 and 2 are
  // byte-identical to their own digits, in either slot.
  test("the 1/2 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("1").formatted).toBe("1");
    expect(engine.evaluate("2").formatted).toBe("2");
    // A conversion, where every other kind prints a target word — "in meter" next
    // door. Here the word vanishes and the numeral is all that prints.
    expect(engine.evaluate("1 one in one").formatted).toBe("1");
    expect(engine.evaluate("2 one naar one").formatted).toBe("2");
  });

  // Dutch overrides `renderQuantity` for the same reason German does, and it
  // overrides exactly the branch a `symbol: ""` unit would take: a symbol is set
  // off from the number by a space, per SI, where the default sets it tight. If
  // that branch were reachable here, every Dutch count would carry a trailing
  // space. It is not — `formatValue` returns the bare number text on `NUMBER_KIND`
  // before any symbol is read — and this is the assertion that says so.
  test("the empty symbol never reaches Dutch's spaced-symbol branch", () => {
    expect(numberNl.units.one?.symbol).toBe("");
    expect(engine.evaluate("7,25").formatted).toBe("7,25");
    expect(engine.evaluate("7,25").formatted).not.toMatch(/\s$/);
  });

  test("round-trips its own output", () => {
    // A fractional (the "," decimal), a grouped integer (the "." the Ukrainian row
    // could not round-trip), two single-token Dutch cardinals, and the facade's own
    // `${raw}one` string.
    for (const input of [
      "1,5",
      "2000",
      "tweeduizend",
      "eenentwintig plus één",
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
