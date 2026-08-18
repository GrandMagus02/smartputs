import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaPl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [areaPl])],
    kinds: [area],
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
    kind: "area",
    unit,
    slot,
  });
  return (areaPl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Polish word", () => {
    // Polish shares the unit ids' script, so a bare "no non-ASCII" sweep would
    // pass a kind that had grown a `hektar`. The nouns first, then the Polish
    // diacritics, which no ratio or magnitude band can contain.
    expect(JSON.stringify(area)).not.toMatch(/hektar|\bakr|kwadratow/i);
    expect(JSON.stringify(area)).not.toMatch(/[ąćęłńóśźż]/i);
  });

  test("only the units Polish declines carry forms", () => {
    // Same per-unit decision as `en`, and forced by the same rule: Polish names
    // these "metr kwadratowy" and friends, two words each, and
    // `assertLocaleContract` refuses a printed surface containing a space
    // because `lex` ends a word token there. They render through their symbol.
    expect(areaPl.units.m2?.forms).toBeUndefined();
    expect(areaPl.units.cm2?.forms).toBeUndefined();
    expect(areaPl.units.km2?.forms).toBeUndefined();

    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows eight is all `polish.selectForm` can ever ask for,
    // which is what makes the exact-match assertion below mean something.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000]) {
        produced.add(
          polish.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "area",
            unit: "hectare",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(EIGHT_KEYS);

    for (const unit of ["hectare", "acre"] as const) {
      expect(Object.keys(areaPl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // A printed form that is not a listed alias still round-trips whenever
  // `polish`'s suffix stripper happens to recover it — at `weight: -2`, a guess
  // rather than an entry. "hektarze" and "akrze" are recovered by nothing at
  // all: the r→rz alternation leaves a stem no alias here is built on.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(areaPl.units)) {
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
      assertLocaleContract(composeLocale(polish, [areaPl]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is fractions and nothing else.
    // 1.5 is what makes the contract sample the `nom-other` row.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [areaPl]), [area], {
        counts: [0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("21 is genitive plural, which is where Polish leaves Ukrainian", () => {
    // `uk.test.ts` next door agrees a compound with its final digit and would
    // print a nominative singular here. Polish sends every -1 above twenty to
    // `many`.
    expect(word("hectare", 21)).toBe("hektarów");
    expect(word("hectare", 101)).toBe("hektarów");
    expect(word("hectare", 22)).toBe("hektary");
    expect(word("hectare", 0)).toBe("hektarów");
  });

  test("the two -other rows hold different words", () => {
    // `nom-other` is reached only with a fractional count, where Polish takes
    // the genitive singular; `loc-other` only without a count, where the word is
    // the locative plural. One word in both cells is wrong in both directions.
    expect(word("hectare", 1.5)).toBe("hektara");
    expect(word("hectare", undefined, "conversion-target")).toBe("hektarach");
    expect(word("acre", 1.5)).toBe("akra");
    expect(word("acre", undefined, "conversion-target")).toBe("akrach");
  });

  test("case follows the slot, not the count", () => {
    // The same count picks a nominative form after a number and a locative one
    // as a conversion target, and the locative singular is not a suffix on
    // either stem: both take r→rz.
    expect(word("hectare", 5, "after-number")).toBe("hektarów");
    expect(word("hectare", 5, "conversion-target")).toBe("hektarach");
    expect(word("hectare", 1, "conversion-target")).toBe("hektarze");
    expect(word("acre", 1, "conversion-target")).toBe("akrze");
  });

  test("an engine built from it reads and writes Polish area", () => {
    const e = engine();
    // The plural boundary, both sides: 2 takes `nom-few` (nominative plural)
    // and 5 takes `nom-many` (genitive plural in -ów).
    expect(e.evaluate("2 hektary").formatted).toBe("2 hektary");
    expect(e.evaluate("5 hektarów").formatted).toBe("5 hektarów");
    expect(e.evaluate("21 hektarów").formatted).toBe("21 hektarów");
    // Arithmetic landing on a fraction: genitive *singular*. This is the
    // assertion that would read "1,5 hektarów" if `nom-other` held a plural.
    expect(e.evaluate("1 ha + 5000 m2").formatted).toBe("1,5 hektara");
    expect(e.evaluate("5 akrów").formatted).toBe("5 akrów");
    // A conversion landing on a unit with no forms: it renders through the
    // symbol branch, and in Polish that branch is *spaced* — PN-EN ISO 80000,
    // which `polish.renderQuantity` implements. The number is grouped by
    // U+00A0, written as an escape because a literal NBSP is invisible in
    // source and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("1 hektar w m2").formatted).toBe("10 000 m²");
    expect(e.evaluate("3 m2").formatted).toBe("3 m²");
    // The Latin aliases from `units.ts` still read, and print back in Polish.
    expect(e.evaluate("2 ha").formatted).toBe("2 hektary");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list where `uk`'s is not, and the
    // difference is the space: Ukrainian renders "20 000м²" tight, which no
    // lexer reads back as one quantity, while Polish's ISO spacing gives
    // "10 000 m²" — a number whose folded NBSP `lex` accepts, then a unit.
    for (const input of ["1 ha + 5000 m2", "5 akrów", "5 ha w akrach", "1 hektar w m2"]) {
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
