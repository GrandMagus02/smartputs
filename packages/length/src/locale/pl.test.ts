import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthPl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [lengthPl])],
    kinds: [length],
  });

/** The eight keys `polish.selectForm` can produce, sorted. */
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

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = polish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "length",
    unit,
    slot,
  });
  return (lengthPl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Polish word", () => {
    // Polish shares the unit ids' script, so a bare "no non-ASCII" sweep would
    // pass a kind that had grown a `stopa`. The nouns first, then the Polish
    // diacritics, which no ratio or magnitude band can contain.
    expect(JSON.stringify(length)).not.toMatch(/metr|stopa|jard|mila|\bcal\b/i);
    expect(JSON.stringify(length)).not.toMatch(/[ąćęłńóśźż]/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows eight is all `polish.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean
    // something (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000]) {
        produced.add(
          polish.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(EIGHT_KEYS);

    for (const unit of Object.keys(lengthPl.units)) {
      expect(Object.keys(lengthPl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // A printed form that is not a listed alias still round-trips whenever
  // `polish`'s suffix stripper happens to recover it — at `weight: -2`, a guess
  // rather than an entry. And the alternating forms in this file ("metrze",
  // "jardzie", "stóp") are recovered by nothing at all, because the stem a
  // stripper would leave is spelled differently from the one the aliases list.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(lengthPl.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(polish, [lengthPl]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is fractions and nothing else.
    // 1.5 is what makes the contract sample the `nom-other` row.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [lengthPl]), [length], {
        counts: [0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("21 is genitive plural, which is where Polish leaves Ukrainian", () => {
    // `uk.test.ts` next door has "21 метр", the nominative singular, because
    // Ukrainian agrees a compound with its final digit. Polish does not.
    expect(word("m", 21)).toBe("metrów");
    expect(word("m", 101)).toBe("metrów");
    expect(word("m", 22)).toBe("metry");
    expect(word("m", 0)).toBe("metrów");
  });

  test("the two -other rows hold different words", () => {
    // `nom-other` is reached only with a fractional count, where Polish takes
    // the genitive singular; `loc-other` only without a count, where the word is
    // the locative plural. One word in both cells is wrong in both directions.
    expect(word("m", 1.5)).toBe("metra");
    expect(word("m", undefined, "conversion-target")).toBe("metrach");
    expect(word("mi", 1.5)).toBe("mili");
    expect(word("mi", undefined, "conversion-target")).toBe("milach");
  });

  test("the three non-metric paradigms are three paradigms", () => {
    // The soft masculine: `-e`/`-i` where the hard stems take `-y`/`-ów`.
    expect(word("in", 2)).toBe("cale");
    expect(word("in", 5)).toBe("cali");
    expect(word("in", 1, "conversion-target")).toBe("calu");
    // The hard feminine, whose genitive plural is a bare stem with an o→ó
    // ablaut, and whose 2/3/4 row and fractional row are the same string.
    expect(word("ft", 2)).toBe("stopy");
    expect(word("ft", 5)).toBe("stóp");
    expect(word("ft", 1.5)).toBe("stopy");
    // The soft feminine, where those same two rows are different strings.
    expect(word("mi", 2)).toBe("mile");
    expect(word("mi", 1.5)).toBe("mili");
    expect(word("mi", 5)).toBe("mil");
  });

  test("case follows the slot, not the count", () => {
    // The same count picks a nominative form after a number and a locative one
    // as a conversion target, and the locative singular carries an alternation
    // on every masculine stem here: r→rz on `metr`, d→dz on `jard`.
    expect(word("m", 5, "after-number")).toBe("metrów");
    expect(word("m", 5, "conversion-target")).toBe("metrach");
    expect(word("m", 1, "conversion-target")).toBe("metrze");
    expect(word("yd", 1, "conversion-target")).toBe("jardzie");
  });

  test("an engine built from it reads and writes Polish length", () => {
    const e = engine();
    expect(e.evaluate("2 metry").formatted).toBe("2 metry");
    expect(e.evaluate("5 metrów").formatted).toBe("5 metrów");
    expect(e.evaluate("21 metrów").formatted).toBe("21 metrów");
    // Arithmetic landing on a fraction: genitive singular, not a plural. This is
    // the assertion that would read "1,5 metrów" if `nom-other` held one.
    expect(e.evaluate("1 m + 50 cm").formatted).toBe("1,5 metra");
    // The feminine pair, on both sides of the 2/3/4 boundary.
    expect(e.evaluate("2 mile").formatted).toBe("2 mile");
    expect(e.evaluate("5 mil").formatted).toBe("5 mil");
    expect(e.evaluate("3 stopy").formatted).toBe("3 stopy");
    expect(e.evaluate("5 stóp").formatted).toBe("5 stóp");
    // A conversion written with the Polish preposition. A foot is exactly 12
    // inches, and the result is a finished quantity rather than a target, so it
    // prints nominative.
    expect(e.evaluate("1 stopa w calach").formatted).toBe("12 cali");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("2 km w m").formatted).toBe("2\u00A0000 metrów");
    // The Latin aliases from `units.ts` still read, and print back in Polish.
    expect(e.evaluate("2 km").formatted).toBe("2 kilometry");
    expect(e.evaluate("500 mm").formatted).toBe("500 milimetrów");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose: `parse/normalize.ts`
    // folds every `\s` — NBSP included — to a plain space before `lex()` sees
    // it, and `lex` accepts that folded separator when the language's own group
    // separator is a non-breaking space. That is what lets a Polish engine read
    // the one input it is guaranteed to be handed: its own output.
    for (const input of [
      "1 m + 50 cm",
      "5 stóp",
      "1 stopa w calach",
      "500 mm",
      "2 km w m",
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
