import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleNl from "./nl";

const engine = () =>
  createEngine({
    locales: [composeLocale(dutch, [angleNl])],
    kinds: [angle],
  });

/** The two keys `dutch.selectForm` can produce, sorted. */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Dutch word", () => {
    // Only the nouns, and there is no second sweep to back them up: Dutch is
    // written in plain ASCII, so the umlaut-and-`ß` check that catches a stray
    // German word in `de.test.ts` has no Dutch equivalent. Naming the words is
    // the whole check here.
    expect(JSON.stringify(angle)).not.toMatch(/graad|graden|radiaal|omwenteling/i);
  });

  test("the degree keeps `graad` without taking `grad` from the gradian", () => {
    // The reservation `@smartput/angle/locale/de` cannot avoid and this file
    // does not need: German's word for a degree *is* `Grad`, which `units.ts`
    // declares for the gradian, so one unit had to yield there. Dutch spells its
    // degree with the long vowel `aa`, and nothing else in this kind claims that
    // string.
    expect(angleNl.units.deg?.aliases).toContain("graad");
    expect(angleNl.units.grad?.aliases).toContain("grad");
    expect(angleNl.units.deg?.aliases).not.toContain("grad");
    const e = engine();
    expect(e.evaluate("90 graad").value.unit).toBe("deg");
    expect(e.evaluate("90 grad").value.unit).toBe("grad");
  });

  test("`graden` does not leak into the gradian through the analyzer", () => {
    // The other half of the same escape, and the language's doing rather than
    // this file's. `@smartput/core/locale/nl` strips `s`, `'s` and `n` and
    // deliberately not `en`; had it stripped `en`, `graden` would have been
    // offered as `grad` and every Dutch degree would carry a penalised reading
    // of a different unit *inside the same kind* — the one collision
    // `assertLocaleContract` cannot settle by weight. The `-n` rule gives
    // `grade`, which nothing claims.
    const e = engine();
    expect(e.evaluate("90 graden").value.unit).toBe("deg");
    expect(e.evaluate("200 gon").value.unit).toBe("grad");
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows two is all `dutch.selectForm` can ever ask for. The
    // slot loop is the load-bearing half — Dutch reads `slot` and discards it,
    // so a language that had grown a case axis would show up as a third key
    // (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          dutch.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(angleNl.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs. Dutch
    // capitalises no noun, so the table prints `graden` and the alias index
    // holds `graden` — the two halves of this file are the same strings, and
    // asserting that is the point rather than an oversight.
    for (const [unit, words] of Object.entries(angleNl.units)) {
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
      assertLocaleContract(composeLocale(dutch, [angleNl]), [angle]),
    ).not.toThrow();
    // The default counts are all integers, so `Intl.PluralRules("nl")` answers
    // from the integer side alone and the fractional reading of `other` is never
    // reached. 1.5 is what makes the contract sample it, and this is the one
    // kind of the six where that row is a real plural ("1,5 graden") rather than
    // a second copy of the singular.
    expect(() =>
      assertLocaleContract(composeLocale(dutch, [angleNl]), [angle], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("three of the four units mark their plural", () => {
    // An angle is counted, not measured out, so the Dutch rule that keeps a
    // measure noun singular after a numeral ("tien meter") does not reach here:
    // "90 graden" and "in radialen" are what everyone writes. This is the kind
    // that proves the rule elsewhere is a rule and not a shrug.
    expect(word("deg", 1)).toBe("graad");
    expect(word("deg", 2)).toBe("graden");
    expect(word("deg", 1.5)).toBe("graden");
    expect(word("rad", 1)).toBe("radiaal");
    expect(word("rad", 2)).toBe("radialen");
    expect(word("turn", 1)).toBe("omwenteling");
    expect(word("turn", 2)).toBe("omwentelingen");
    // `gon` is the exception: a coined symbol-word, invariant like every other
    // abbreviation Dutch turned into a noun.
    expect(word("grad", 1)).toBe("gon");
    expect(word("grad", 400)).toBe("gon");
  });

  test("a conversion target is spelled like a bare quantity", () => {
    // The substantive difference from German: `in` and `naar` govern nothing in
    // Dutch, so a count-free target (ruling R5 sends it to `other`) is simply
    // the plural — "in graden", the same word as "twee graden". `de.ts` needs a
    // whole second axis to say this.
    for (const unit of ["rad", "deg", "grad", "turn"]) {
      expect(word(unit, undefined, "conversion-target"), unit).toBe(word(unit, 2));
      expect(word(unit, 1, "conversion-target"), unit).toBe(word(unit, 1));
    }
    expect(word("deg", undefined, "conversion-target")).toBe("graden");
    expect(word("rad", undefined, "conversion-target")).toBe("radialen");
  });

  test("an engine built from it reads and writes Dutch angles", () => {
    const e = engine();
    // The CLDR boundary in both directions, on a noun that moves.
    expect(e.evaluate("1 graad").formatted).toBe("1 graad");
    expect(e.evaluate("90 graden").formatted).toBe("90 graden");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and 1,5 selects the plural row.
    expect(e.evaluate("1 graad + 0,5 graad").formatted).toBe("1,5 graden");
    // Conversions written with both Dutch keywords, which is `dutch.keywords`'
    // doing and not this file's.
    expect(e.evaluate("1 omwenteling in graden").formatted).toBe("360 graden");
    expect(e.evaluate("0,5 omwenteling naar graden").formatted).toBe("180 graden");
    expect(e.evaluate("400 gon in omwentelingen").formatted).toBe("1 omwenteling");
    // The spoken word for a revolution, read but never printed.
    expect(e.evaluate("3 toeren").value.unit).toBe("turn");
    // Latin input still reads, and answers in Dutch.
    expect(e.evaluate("2 rad").formatted).toBe("2 radialen");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: Dutch groups with ".", which the lexer does not
    // read back as a group.
    const e = engine();
    for (const input of [
      "1 graad + 0,5 graad",
      "1 omwenteling in graden",
      "0,5 omwenteling naar graden",
      "2 radialen",
      "200 gon",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toFixed(20), input).toBe(
        first.value.canonical.toFixed(20),
      );
    }
  });
});
