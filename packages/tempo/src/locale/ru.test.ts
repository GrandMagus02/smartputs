import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoRu from "./ru";

const engine = () =>
  createEngine({
    locales: [composeLocale(russian, [tempoRu])],
    kinds: [tempo],
  });

/** The key `russian` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  russian.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "tempo",
    unit,
    slot,
  });

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

describe("tempo ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word". A
  // kind is two ratios and two unit ids; Cyrillic anywhere in the descriptor
  // would mean a translation had leaked into the language-free half.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/\p{Script=Cyrillic}/u);
  });

  test("bpm stays symbol-only and hz carries all eight keys", () => {
    // `en.ts` refuses `forms` on bpm because "beats per minute" is a compound
    // the lexer cannot read back; the Russian phrase is "ударов в минуту", three
    // words, and the middle one is core's `in` keyword — so Russian refuses it
    // for the same reason and more of it. hz is where the two-axis grammar
    // actually shows: English needed two identical categories ("hertz" is its
    // own plural), Russian needs four numbers in the nominative plus a
    // prepositional on top of them.
    expect(tempoRu.units.bpm?.forms).toBeUndefined();
    expect(Object.keys(tempoRu.units.hz?.forms ?? {}).sort()).toEqual(EIGHT_KEYS);
  });

  // The invariant the round-trip test below leans on, asserted instead of
  // described. A form the printer can emit that is not an alias is only readable
  // through `russian`'s suffix stripper, at its `-2` penalty — so it reads back
  // by accident rather than by declaration, and it stops reading back the moment
  // a stem falls under `minStem: 3`. The prepositional singular "герце" is the
  // one such form here.
  test("every form the printer can emit is also an alias", () => {
    for (const [unit, words] of Object.entries(tempoRu.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(russian, [tempoRu]), [tempo]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Russian that category is reached only by a fraction.
    // 1.5 is what makes the contract check `nom-other`/`loc-other`, the rows
    // this vocabulary is likeliest to get wrong because `nom-other` is a
    // genitive singular that looks like nothing in particular.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [tempoRu]), [tempo], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the genitive plural of `герц` is `герц`", () => {
    // A unit named after a person takes a zero-ending counting form (счётная
    // форма) after a numeral, exactly as `power`'s "5 ватт" does, so `nom-one`
    // and `nom-many` are one string here. `nom-few` and the fractional row take
    // the genitive singular in -а, which is the measure-noun ending rather than
    // the -у an ordinary inanimate masculine would show.
    const hz = tempoRu.units.hz?.forms;
    expect(hz?.[key("hz", "after-number", 1)]).toBe("герц");
    expect(hz?.[key("hz", "after-number", 2)]).toBe("герца");
    expect(hz?.[key("hz", "after-number", 5)]).toBe("герц");
    expect(hz?.[key("hz", "after-number", 1.5)]).toBe("герца");
    // The two counts that catch a hand-written plural rule: 21 is `one` in
    // Russian and 11 is `many`, and here both spell "герц" — for two different
    // grammatical reasons, which is why the keys are checked and not just the
    // strings.
    expect(key("hz", "after-number", 21)).toBe("nom-one");
    expect(key("hz", "after-number", 11)).toBe("nom-many");
    expect(key("hz", "after-number", 1.5)).toBe("nom-other");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract stated against the table rather than through the
    // formatter: one count, two cases. And a target with no count at all lands
    // on `loc-other` — "в герцах", the row a one-dimensional plural table had no
    // cell for, and the reason Russian carries a case axis at all.
    const hz = tempoRu.units.hz?.forms;
    expect(hz?.[key("hz", "after-number", 5)]).toBe("герц");
    expect(hz?.[key("hz", "conversion-target", 5)]).toBe("герцах");
    expect(key("hz", "conversion-target")).toBe("loc-other");
    expect(hz?.[key("hz", "conversion-target")]).toBe("герцах");
    // The prepositional singular is its own ending, so the case axis is not one
    // suffix applied to every count: "в 1 герце", not "в 1 герцах".
    expect(hz?.[key("hz", "conversion-target", 1)]).toBe("герце");
    // bpm is asked the same question and has no table to answer it from, which
    // is what "symbol-only" costs: the case axis is simply invisible there.
    expect(key("bpm", "conversion-target")).toBe("loc-other");
    expect(tempoRu.units.bpm?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Russian tempo", () => {
    const e = engine();
    // The numeral boundary, both sides of it.
    expect(e.evaluate("2 герца").formatted).toBe("2 герца");
    expect(e.evaluate("5 герц").formatted).toBe("5 герц");
    // 21 is `one` in CLDR's Russian rules — the category follows the last digit
    // — so "21 герц" is singular where "21 hertz" carries no number at all.
    expect(e.evaluate("21 герц").formatted).toBe("21 герц");
    // The fractional row, reached by a sum as well as typed: this is the
    // assertion that would read "1,5 герцев" if `nom-other` held the -ев plural
    // a reader might have written there.
    expect(e.evaluate("1,5 герца").formatted).toBe("1,5 герца");
    expect(e.evaluate("1 герц + 0,5 герца").formatted).toBe("1,5 герца");
    // bpm has no forms, so the renderer stays on the symbol and sets it tight
    // against the number — the same shape `en` prints "120bpm" through.
    expect(e.evaluate("120 bpm").formatted).toBe("120 бпм");
    expect(e.evaluate("120 бпм").formatted).toBe("120 бпм");
    expect(e.evaluate("120 ударов").formatted).toBe("120 бпм");
    // Two conversions, one in each direction across the ratio. Both print as
    // finished quantities rather than targets, so hz comes back nominative.
    expect(e.evaluate("3 гц в bpm").formatted).toBe("180 бпм");
    expect(e.evaluate("120 bpm в герцах").formatted).toBe("2 герца");
    // Latin in, Russian out: a `ru` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts` before the Cyrillic
    // spellings are appended to it.
    expect(e.evaluate("2 hertz").formatted).toBe("2 герца");
    // Russian groups thousands with U+00A0, written as an escape deliberately:
    // a literal NBSP is invisible in source and degrades to a plain space the
    // moment someone retypes the line.
    expect(e.evaluate("1000 герц").formatted).toBe("1\u00A0000 герц");
    // The -ев genitive plural a reader who has not read Rosenthal will type is
    // listed as an alias, and prints back as the counting form.
    expect(e.evaluate("5 герцев").formatted).toBe("5 герц");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // hz round-trips because every one of its eight forms is also an alias, and
    // bpm round-trips because its symbol is one — the two halves of the same
    // rule, reached by different routes, since bpm has no forms and prints the
    // symbol instead. A grouped input is in the list on purpose: Russian groups
    // thousands with U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP
    // included — to a plain space before `lex()` sees it, which used to split
    // "1\u00A0000 герц" into two numbers.
    for (const input of [
      "2 герца",
      "5 герц",
      "21 герц",
      "1,5 герца",
      "1000 герц",
      "1 бпм",
      "2 бпм",
      "5 бпм",
      "1,5 бпм",
      "5000 бпм",
      "120 bpm в герцах",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  // Why bpm's symbol is not "уд/мин", asserted from the other end. That is the
  // abbreviation on a metronome, and it contains "/" — the same fact `units.ts`
  // gives for refusing an "spb" unit — so a "/" symbol prints something the
  // lexer reads as a division rather than as a unit. `energy` and `datarate`
  // answer that by making the division true; tempo cannot, because its canonical
  // *is* beats per minute and there is no "beat" kind for the numerator to be.
  // This pins the constraint itself: no symbol in this vocabulary carries an
  // operator character, so no printed tempo can decompose into arithmetic.
  test("no symbol carries a character the lexer reads as an operator", () => {
    for (const [unit, words] of Object.entries(tempoRu.units)) {
      expect(words.symbol, `${unit}'s symbol is not one token`).not.toMatch(/[/*+\-^()]/);
    }
    const e = engine();
    const printed = e.evaluate("120 bpm").formatted;
    expect(printed).toBe("120 бпм");
    expect(e.evaluate(printed).value?.unit).toBe("bpm");
    // `canonical` is in the kind's canonical unit, which is `bpm`, so a thousand
    // hertz is sixty thousand beats a minute — the number to check is that the
    // whole "1 000" was read, not just the leading "1".
    const grouped = e.evaluate("1\u00A0000 герц").value;
    expect([grouped?.canonical.toString(), grouped?.unit]).toEqual(["60000", "hz"]);
  });
});
