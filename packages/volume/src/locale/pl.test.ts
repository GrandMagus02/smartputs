import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumePl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [volumePl])],
    kinds: [volume],
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
    kind: "volume",
    unit,
    slot,
  });
  return (volumePl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumePl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumePl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Polish word", () => {
    // Polish shares the unit ids' script, so a bare "no non-ASCII" sweep would
    // pass a kind that had grown a `litr`. The nouns first — `pint` is the unit
    // key as well as the Polish genitive plural, so it is deliberately not in
    // this list — then the Polish diacritics, which no ratio or magnitude band
    // can contain.
    expect(JSON.stringify(volume)).not.toMatch(/litr|galon|pinta|sześcienn/i);
    expect(JSON.stringify(volume)).not.toMatch(/[ąćęłńóśźż]/i);
  });

  test("only the units Polish declines carry forms", () => {
    // Same per-unit decision as `en`, and forced by the same rule: "metr
    // sześcienny" is two words, and `assertLocaleContract` refuses a printed
    // surface containing a space because `lex` ends a word token there.
    expect(volumePl.units.m3?.forms).toBeUndefined();

    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows eight is all `polish.selectForm` can ever ask for,
    // which is what makes the exact-match assertion below mean something.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000]) {
        produced.add(
          polish.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(EIGHT_KEYS);

    for (const unit of ["l", "ml", "gal", "pint"] as const) {
      expect(Object.keys(volumePl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // A printed form that is not a listed alias still round-trips whenever
  // `polish`'s suffix stripper happens to recover it — at `weight: -2`, a guess
  // rather than an entry. "litrze" and "pincie" are recovered by nothing at all:
  // the r→rz and t→ć alternations leave stems no alias here is built on.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(volumePl.units)) {
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
      assertLocaleContract(composeLocale(polish, [volumePl]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is fractions and nothing else.
    // 1.5 is what makes the contract sample the `nom-other` row.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [volumePl]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("21 is genitive plural, which is where Polish leaves Ukrainian", () => {
    // `uk.test.ts` next door agrees a compound with its final digit and would
    // print a nominative singular here. Polish sends every -1 above twenty to
    // `many`.
    expect(word("l", 21)).toBe("litrów");
    expect(word("l", 101)).toBe("litrów");
    expect(word("l", 22)).toBe("litry");
    expect(word("l", 0)).toBe("litrów");
  });

  test("the two -other rows hold different words", () => {
    // `nom-other` is reached only with a fractional count, where Polish takes
    // the genitive singular; `loc-other` only without a count, where the word is
    // the locative plural. One word in both cells is wrong in both directions.
    expect(word("l", 1.5)).toBe("litra");
    expect(word("l", undefined, "conversion-target")).toBe("litrach");
    expect(word("pint", 1.5)).toBe("pinty");
    expect(word("pint", undefined, "conversion-target")).toBe("pintach");
  });

  test("case follows the slot, not the count", () => {
    // The same count picks a nominative form after a number and a locative one
    // as a conversion target, and each locative singular is its own alternation
    // rather than one suffix: r→rz on `litr`, plain -ie on `galon`, t→ć on the
    // feminine `pinta`.
    expect(word("l", 5, "after-number")).toBe("litrów");
    expect(word("l", 5, "conversion-target")).toBe("litrach");
    expect(word("l", 1, "conversion-target")).toBe("litrze");
    expect(word("gal", 1, "conversion-target")).toBe("galonie");
    expect(word("pint", 1, "conversion-target")).toBe("pincie");
  });

  test("an engine built from it reads and writes Polish volume", () => {
    const e = engine();
    // The plural boundary, both sides: 2 takes `nom-few` (nominative plural)
    // and 5 takes `nom-many` (genitive plural in -ów).
    expect(e.evaluate("2 litry").formatted).toBe("2 litry");
    expect(e.evaluate("5 litrów").formatted).toBe("5 litrów");
    expect(e.evaluate("21 litrów").formatted).toBe("21 litrów");
    // Arithmetic landing on a fraction: genitive *singular*. This is the
    // assertion that would read "1,5 litrów" if `nom-other` held a plural.
    expect(e.evaluate("1 l + 500 ml").formatted).toBe("1,5 litra");
    // The feminine unit declines differently from the three masculine ones:
    // "5 pint" is a bare stem where they take -ów.
    expect(e.evaluate("2 pinty").formatted).toBe("2 pinty");
    expect(e.evaluate("5 pint").formatted).toBe("5 pint");
    expect(e.evaluate("1,5 pinty").formatted).toBe("1,5 pinty");
    // A conversion written with the Polish preposition, landing on a fraction
    // and therefore on the genitive singular again.
    expect(e.evaluate("1 galon w litrach").formatted).toBe("3,785411784 litra");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("2 l w ml").formatted).toBe("2\u00A0000 mililitrów");
    // The unit with no forms renders through its symbol, spaced — PN-EN ISO
    // 80000, which `polish.renderQuantity` implements against the default
    // template's tight `3m³`.
    expect(e.evaluate("3 m3").formatted).toBe("3 m³");
    // The Latin aliases from `units.ts` still read, and print back in Polish.
    expect(e.evaluate("2 l").formatted).toBe("2 litry");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose: `parse/normalize.ts`
    // folds every `\s` — NBSP included — to a plain space before `lex()` sees
    // it, and `lex` accepts that folded separator when the language's own group
    // separator is a non-breaking space. That is what lets a Polish engine read
    // the one input it is guaranteed to be handed: its own output.
    for (const input of [
      "1 l + 500 ml",
      "5 pint",
      "1 galon w litrach",
      "3 m3",
      "2 l w ml",
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
