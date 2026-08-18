import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measurePl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [measurePl])],
    kinds: [measure],
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
    kind: "measure",
    unit,
    slot,
  });
  return (measurePl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measurePl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measurePl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Polish word", () => {
    // Polish shares the unit ids' script, so a bare "no non-ASCII" sweep would
    // pass a kind that had grown a `punkt`. The nouns first — `pika` is spelled
    // like the English alias `pica` only if one squints, and `cal` is short
    // enough to want a word boundary — then the Polish diacritics, which neither
    // a ratio, a magnitude band nor the `px` closure can contain.
    expect(JSON.stringify(measure)).not.toMatch(/punkt|piksel|\bpika\b|\bcal\b|metr/i);
    expect(JSON.stringify(measure)).not.toMatch(/[ąćęłńóśźż]/i);
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
            kind: "measure",
            unit: "pt",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(EIGHT_KEYS);

    for (const unit of Object.keys(measurePl.units)) {
      expect(Object.keys(measurePl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // A printed form that is not a listed alias still round-trips whenever
  // `polish`'s suffix stripper happens to recover it — at `weight: -2`, a guess
  // rather than an entry. Every locative singular in this file is out of the
  // stripper's reach entirely: "punkcie", "pice" and "milimetrze" each change a
  // consonant, so the stem left behind matches no alias.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(measurePl.units)) {
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
      assertLocaleContract(composeLocale(polish, [measurePl]), [measure]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is fractions and nothing else.
    // 1.5 is what makes the contract sample the `nom-other` row, and `pt`'s
    // entry there is the one with a different ending from the rest.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [measurePl]), [measure], {
        counts: [0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("21 is genitive plural, which is where Polish leaves Ukrainian", () => {
    // `uk.test.ts` next door agrees a compound with its final digit and would
    // print a nominative singular here. Polish sends every -1 above twenty to
    // `many`.
    expect(word("pt", 21)).toBe("punktów");
    expect(word("pt", 101)).toBe("punktów");
    expect(word("pt", 22)).toBe("punkty");
    expect(word("pt", 0)).toBe("punktów");
  });

  test("the two -other rows hold different words", () => {
    // `nom-other` is reached only with a fractional count, where Polish takes
    // the genitive singular; `loc-other` only without a count, where the word is
    // the locative plural. One word in both cells is wrong in both directions.
    expect(word("pt", 1.5)).toBe("punktu");
    expect(word("pt", undefined, "conversion-target")).toBe("punktach");
    expect(word("pc", 1.5)).toBe("piki");
    expect(word("pc", undefined, "conversion-target")).toBe("pikach");
  });

  test("the genitive singular is -a except on the point", () => {
    // The ending Polish units of measure take as a class, and the one unit here
    // that keeps its own: `punkt` is an ordinary abstract masculine and takes
    // -u. "1,5 punkta" is not a word, and no other assertion here would notice
    // it.
    expect(word("inch", 1.5)).toBe("cala");
    expect(word("mm", 1.5)).toBe("milimetra");
    expect(word("px", 1.5)).toBe("piksela");
    expect(word("pt", 1.5)).toBe("punktu");
  });

  test("case follows the slot, not the count", () => {
    // The same count picks a nominative form after a number and a locative one
    // as a conversion target, and every locative singular here carries an
    // alternation or a soft ending: t→ć on `punkt`, k→c on the feminine `pika`,
    // r→rz on `milimetr`, the soft -u on `cal` and `piksel`.
    expect(word("pt", 5, "after-number")).toBe("punktów");
    expect(word("pt", 5, "conversion-target")).toBe("punktach");
    expect(word("pt", 1, "conversion-target")).toBe("punkcie");
    expect(word("pc", 1, "conversion-target")).toBe("pice");
    expect(word("mm", 1, "conversion-target")).toBe("milimetrze");
    expect(word("inch", 1, "conversion-target")).toBe("calu");
    expect(word("px", 1, "conversion-target")).toBe("pikselu");
  });

  test("an engine built from it reads and writes Polish typographic units", () => {
    const e = engine();
    // 72 lands on `few`, not on `many`: the category follows the final digit
    // outside the 12–14 band, so 72 agrees like 2 does.
    expect(e.evaluate("72 punkty").formatted).toBe("72 punkty");
    expect(e.evaluate("5 punktów").formatted).toBe("5 punktów");
    expect(e.evaluate("21 punktów").formatted).toBe("21 punktów");
    // The fractional row on the unit whose genitive singular ends in -u.
    expect(e.evaluate("1,5 punktu").formatted).toBe("1,5 punktu");
    // The feminine unit: bare-stem genitive plural where the masculines take
    // -ów, and a 2/3/4 row spelled like its own fractional row.
    expect(e.evaluate("2 piki").formatted).toBe("2 piki");
    expect(e.evaluate("5 pik").formatted).toBe("5 pik");
    // Conversions written with the Polish preposition. The target is spelled in
    // the locative, and the result — a finished quantity, not a target — comes
    // back nominative.
    expect(e.evaluate("1 cal w punktach").formatted).toBe("72 punkty");
    expect(e.evaluate("1 cal w pikselach").formatted).toBe("96 pikseli");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("20 cali w pikselach").formatted).toBe("1\u00A0920 pikseli");
    // The Latin aliases from `units.ts` still read, and print back in Polish.
    expect(e.evaluate("72 pt").formatted).toBe("72 punkty");
    expect(e.evaluate("2 piksele").formatted).toBe("2 piksele");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose: `parse/normalize.ts`
    // folds every `\s` — NBSP included — to a plain space before `lex()` sees
    // it, and `lex` accepts that folded separator when the language's own group
    // separator is a non-breaking space. That is what lets a Polish engine read
    // the one input it is guaranteed to be handed: its own output.
    for (const input of [
      "1,5 punktu",
      "5 pik",
      "1 cal w punktach",
      "12 pt w calach",
      "20 cali w pikselach",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
    }
  });
});
