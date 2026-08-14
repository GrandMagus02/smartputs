import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "../index";
import numberPl from "./pl";

const locale = composeLocale(polish, [numberPl]);
const engine = createEngine({ locales: [locale], kinds: [number] });

/**
 * Anything only Polish would write. Polish shares the Latin alphabet, so unlike
 * Ukrainian's Cyrillic range this cannot prove on its own that no Polish word
 * leaked into the language-free half — a Polish word need not carry a diacritic.
 * The test that uses it therefore greps for the candidate words as well, exactly
 * as `de.test.ts` does for German.
 */
const POLISH = /[ąćęłńóśźż]/i;

/** The closed key set `polish.selectForm` can produce — no more, no fewer. */
const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

describe("number pl vocabulary", () => {
  test("it targets Polish and names its kind by id", () => {
    expect(numberPl.locale).toBe("pl");
    expect(numberPl.kind).toBe("number");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This one
  // has none to grep — its single unit is *named* `one`, and that id stays on the
  // kind as a ratio-table key in any language — so this asserts the wrapper the
  // id was quoted inside is gone, and adds the Polish half: neither a Polish
  // diacritic nor any of the three words this file argues about may reach the
  // language-free side.
  test("the kind itself carries no Polish word", () => {
    const source = JSON.stringify(number);
    expect(source).not.toMatch(/alias|symbol|lexicon/i);
    expect(source).not.toMatch(POLISH);
    expect(source).not.toMatch(/jeden|jedynka|jednostka/i);
  });

  // The contract check below is vacuous on the `forms` half — there is no table
  // to index — so this pins the absence itself, and pins that no Polish word was
  // smuggled in as an alias either. `polish.numerals` claims "jeden"/"jedna"/
  // "jedno" before any index is consulted, so an entry for them would be
  // unreachable machinery; "jedynka" is the *figure* one and "jednostka" the
  // mathematical unit, and neither is a thing anyone counts five of.
  test("declares no forms and no Polish alias", () => {
    // Over the entries rather than `units.one?.forms`, so a table that lost the
    // unit entirely cannot make this pass by being empty — the coverage test
    // above owns that failure, and this one should not double as it.
    for (const [unit, words] of Object.entries(numberPl.units)) {
      expect(words.forms, `${unit} declares forms`).toBeUndefined();
      for (const word of ["jeden", "jedna", "jedno", "jedynka", "jednostka"]) {
        expect(words.aliases, `${unit} claims ${word}`).not.toContain(word);
      }
    }
    expect(JSON.stringify(numberPl)).not.toMatch(POLISH);
  });

  // `selectForm` still answers for this unit — it is a function of the count and
  // the slot and knows nothing about which units carry tables — so what makes the
  // two-axis grammar unreachable here is the missing `forms`, not a missing key.
  // The boundaries pinned are the ones a table would have had to key against, and
  // 21 is the one Polish disagrees with Ukrainian about: `uk.test.ts` next door
  // asserts `nom-one` for it ("двадцять один кілограм"), Polish counts it by its
  // final 1 the way it counts 5.
  test("selectForm still produces keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      polish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "number",
        unit: "one",
        slot,
      });
    expect(key(1, "after-number")).toBe("nom-one");
    expect(key(2, "after-number")).toBe("nom-few");
    expect(key(5, "after-number")).toBe("nom-many");
    expect(key(21, "after-number")).toBe("nom-many");
    expect(key(22, "after-number")).toBe("nom-few");
    expect(key(1.5, "after-number")).toBe("nom-other");
    expect(key(5, "conversion-target")).toBe("loc-many");
    // Ruling R5: a conversion target has no count, and the category CLDR requires
    // every locale to define as its generic one answers for it.
    expect(key(undefined, "conversion-target")).toBe("loc-other");
    // Eight keys and no more, which is the set a `forms` table here would owe.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as const) {
      for (const count of [0, 1, 2, 5, 11, 21, 22, 100, 1000, 1.5]) {
        produced.add(
          polish.selectForm({
            count: new Decimal(count),
            kind: "number",
            unit: "one",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(EIGHT_KEYS);
    expect(numberPl.units.one?.forms).toBeUndefined();
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [number])).not.toThrow();
    // The default counts are all integers, so `polish.selectForm`'s `other`
    // category — the *fractional* row, "1,5 kilograma" next door — is never
    // reached through a fraction at all. A fractional count is added for the same
    // reason every other `pl` vocabulary adds one, except that here it can only
    // confirm the absence of a `forms` table: a unit with none is skipped before
    // any key is asked for.
    expect(() =>
      assertLocaleContract(locale, [number], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Polish numbers", () => {
    // Polish marks the decimal with "," — so the English "1.5" is not a number in
    // this locale at all, and "1,5" is.
    expect(engine.evaluate("1,5").formatted).toBe("1,5");
    expect(() => engine.evaluate("1.5")).toThrow();
    // Thousands group with U+00A0 — Ukrainian's and Russian's separator rather
    // than German's "." — read out of CLDR by `numberFormat: "intl"`. Written as
    // an escape on purpose: a literal non-breaking space is invisible in source
    // and degrades to a plain one when someone retypes it.
    //
    // Output only. This exact string does NOT read back, and the cause is upstream
    // of this file: `normalize()` folds U+00A0 to a plain space, and `lex` then
    // looks for `numberSymbols(pl).group` — still U+00A0 — inside the digit run
    // and never finds it, so "2 000" lexes as two adjacent numbers. Nothing a
    // vocabulary can reach fixes it, so the round-trip below stays under the
    // grouping boundary. Do not "fix" it by weakening the assertion.
    expect(engine.evaluate("2000").formatted).toBe("2\u00A0000");
    // Polish cardinals in, Polish digits out. `polishSpeller` and `polish.numerals`
    // read the one set of tables in `pl-cardinals.ts`, which is what keeps
    // "dwadzieścia dwa" the same 22 in both directions.
    expect(engine.evaluate("dwadzieścia dwa plus jeden").formatted).toBe("23");
    // The hundreds are fused words that *add* — "dwieście" is not "dwa sto" — and
    // that is exactly why `pl.ts` hand-writes its numeral tables instead of taking
    // the shared `cardinalNumerals`/`cardinalSpeller` pair.
    expect(engine.evaluate("dwieście pięćdziesiąt minus sto pięć").formatted).toBe("145");
    // "razy" needs no particle after it; "podzielić" takes "przez", and the two
    // words fold into one division operator exactly as English's "divided by" do.
    expect(engine.evaluate("trzy razy cztery").formatted).toBe("12");
    expect(engine.evaluate("10 podzielić przez 4").formatted).toBe("2,5");
  });

  // The plural boundary every sibling row turns into different words. This kind
  // has one answer for all of them, which is the whole of what it contributes to
  // the Polish phase: nothing is appended after the numeral, so 2 (`nom-few`), 5
  // and 21 (both `nom-many`) are byte-identical to their own digits.
  test("the 2/5/21 boundary appends no word, in either slot", () => {
    expect(engine.evaluate("2").formatted).toBe("2");
    expect(engine.evaluate("5").formatted).toBe("5");
    expect(engine.evaluate("21").formatted).toBe("21");
    // A conversion, where `polish.selectForm` asks for a locative — "w 5
    // kilogramach" is the shape this slot has next door. Here the target word
    // vanishes and the numeral is all that prints.
    expect(engine.evaluate("2 one w one").formatted).toBe("2");
    expect(engine.evaluate("5 one w one").formatted).toBe("5");
    expect(engine.evaluate("21 one w one").formatted).toBe("21");
    // And the fractional row, which in every inflecting sibling is a genitive
    // singular and here is again just the digits.
    expect(engine.evaluate("1,5 one w one").formatted).toBe("1,5");
  });

  // `en.test.ts` asserts that `1one` *throws*, because English's cardinal parser
  // claims "one" before the alias index sees it. Nothing in Polish claims the
  // English word — `CARDINALS` is Polish throughout — so here the self-alias is
  // live, which is the alias earning its keep, since `formatNumber` emits exactly
  // this string.
  test("the Latin self-alias is live under pl, where en shadows it", () => {
    const parsed = engine.evaluate("1one");
    expect(parsed.value?.unit).toBe("one");
    expect(parsed.formatted).toBe("1");
  });

  // Three inputs: a fractional (the "," decimal), a spelled cardinal, and the
  // facade's own `${raw}one` string. All three stay under 1000 on purpose — see
  // the grouping note above for the reason a four-digit result cannot.
  test("round-trips its own output", () => {
    for (const input of ["1,5", "dwadzieścia dwa plus jeden", "999one"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
