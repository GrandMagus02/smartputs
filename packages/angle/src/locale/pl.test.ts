import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import anglePl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [anglePl])],
    kinds: [angle],
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
    kind: "angle",
    unit,
    slot,
  });
  return (anglePl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(anglePl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(anglePl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Polish word", () => {
    // Polish shares the unit ids' script, so a bare "no non-ASCII" sweep would
    // pass a kind that had grown a `stopień`. The nouns first — `grad` and `gon`
    // are unit ids and English aliases as well as Polish words, so they are
    // deliberately not in this list — then the Polish diacritics, which no ratio
    // or magnitude band can contain.
    expect(JSON.stringify(angle)).not.toMatch(/stopie|stopni|obrot|obrót|radiana/i);
    expect(JSON.stringify(angle)).not.toMatch(/[ąćęłńóśźż]/i);
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
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(EIGHT_KEYS);

    for (const unit of Object.keys(anglePl.units)) {
      expect(Object.keys(anglePl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // A printed form that is not a listed alias still round-trips whenever
  // `polish`'s suffix stripper happens to recover it — at `weight: -2`, a guess
  // rather than an entry. Most of this file is out of the stripper's reach
  // anyway: `stopień` loses a vowel in every oblique form and `obrót` changes
  // one, so no ending taken off the nominative reaches the stem they inflect on.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(anglePl.units)) {
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
      assertLocaleContract(composeLocale(polish, [anglePl]), [angle]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is fractions and nothing else.
    // 1.5 is what makes the contract sample the `nom-other` row, and `turn`'s
    // entry there is the one with a different ending from all the rest.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [anglePl]), [angle], {
        counts: [0, 1, 1.5, 2, 5, 12, 21, 22, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("21 is genitive plural, which is where Polish leaves Ukrainian", () => {
    // `uk.test.ts` next door agrees a compound with its final digit and would
    // print a nominative singular here. Polish sends every -1 above twenty to
    // `many`.
    expect(word("deg", 21)).toBe("stopni");
    expect(word("deg", 101)).toBe("stopni");
    expect(word("deg", 22)).toBe("stopnie");
    expect(word("deg", 0)).toBe("stopni");
  });

  test("the two -other rows hold different words", () => {
    // `nom-other` is reached only with a fractional count, where Polish takes
    // the genitive singular; `loc-other` only without a count, where the word is
    // the locative plural. One word in both cells is wrong in both directions.
    expect(word("deg", 1.5)).toBe("stopnia");
    expect(word("deg", undefined, "conversion-target")).toBe("stopniach");
    expect(word("turn", 1.5)).toBe("obrotu");
    expect(word("turn", undefined, "conversion-target")).toBe("obrotach");
  });

  test("the genitive singular is -a everywhere except turn", () => {
    // The rule Polish units of measure follow, and the one unit here that does
    // not: `obrót` takes -u. Writing "obrota" would be a word nobody says, and
    // no other assertion in this file would notice it.
    expect(word("rad", 1.5)).toBe("radiana");
    expect(word("deg", 1.5)).toBe("stopnia");
    expect(word("grad", 1.5)).toBe("grada");
    expect(word("turn", 1.5)).toBe("obrotu");
  });

  test("case follows the slot, not the count", () => {
    // The same count picks a nominative form after a number and a locative one
    // as a conversion target, and each locative singular is its own alternation:
    // -ie on `radian`, the soft -u on `stopień`, d→dz on `grad`, t→ć plus the
    // ó→o stem change on `obrót`.
    expect(word("deg", 5, "after-number")).toBe("stopni");
    expect(word("deg", 5, "conversion-target")).toBe("stopniach");
    expect(word("rad", 1, "conversion-target")).toBe("radianie");
    expect(word("deg", 1, "conversion-target")).toBe("stopniu");
    expect(word("grad", 1, "conversion-target")).toBe("gradzie");
    expect(word("turn", 1, "conversion-target")).toBe("obrocie");
  });

  test("an engine built from it reads and writes Polish angle", () => {
    const e = engine();
    // The plural boundary, both sides: 2 takes `nom-few` (nominative plural,
    // and for this soft stem that is -e) and 5 takes `nom-many`.
    expect(e.evaluate("2 stopnie").formatted).toBe("2 stopnie");
    expect(e.evaluate("5 stopni").formatted).toBe("5 stopni");
    expect(e.evaluate("21 stopni").formatted).toBe("21 stopni");
    expect(e.evaluate("180 stopni").formatted).toBe("180 stopni");
    // The fractional row — genitive *singular*. This is the assertion that would
    // read "1,5 stopni" if `nom-other` held a plural.
    expect(e.evaluate("1,5 stopnia").formatted).toBe("1,5 stopnia");
    // The same row on the unit whose genitive singular ends in -u instead.
    expect(e.evaluate("0,5 obrotu").formatted).toBe("0,5 obrotu");
    // Conversions written with the Polish preposition. The target is spelled in
    // the locative ("w stopniach"), and the result — a finished quantity, not a
    // target — comes back nominative.
    expect(e.evaluate("1 obrót w stopniach").formatted).toBe("360 stopni");
    expect(e.evaluate("1 obrót w gradach").formatted).toBe("400 gradów");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("10 obrotów w stopniach").formatted).toBe("3\u00A0600 stopni");
    // The Latin aliases from `units.ts` still read, and print back in Polish.
    expect(e.evaluate("2 rad").formatted).toBe("2 radiany");
    expect(e.evaluate("2 grady").formatted).toBe("2 grady");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose: `parse/normalize.ts`
    // folds every `\s` — NBSP included — to a plain space before `lex()` sees
    // it, and `lex` accepts that folded separator when the language's own group
    // separator is a non-breaking space. That is what lets a Polish engine read
    // the one input it is guaranteed to be handed: its own output.
    for (const input of [
      "1,5 stopnia",
      "0,5 obrotu",
      "1 obrót w stopniach",
      "90 stopni w radianach",
      "10 obrotów w stopniach",
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
