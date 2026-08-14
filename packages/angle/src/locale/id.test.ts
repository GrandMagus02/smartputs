import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleId from "./id";

const engine = () =>
  createEngine({
    locales: [composeLocale(indonesian, [angleId])],
    kinds: [angle],
  });

/** The only key `indonesian.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Indonesian word", () => {
    // Naming the words is the whole check, as it is in `nl.test.ts`: Indonesian
    // is written in plain ASCII, so there is no script class to sweep for the
    // way `ja.test.ts` sweeps for kana. Neither word is a substring of any
    // English alias, so neither needs a boundary.
    expect(JSON.stringify(angle)).not.toMatch(/derajat|putaran/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `indonesian.selectForm` can ever ask
    // for, which is what makes the exact-match assertion on each table mean
    // something (rule 6). This is the kind where the languages that mark number
    // show it — Dutch writes `graad`/`graden` here and keeps `meter` invariant
    // next door — so a sweep that produced two keys would be the interesting
    // failure.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 11, 21, 100, 1000]) {
        produced.add(
          indonesian.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(angleId.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs:
    // Indonesian capitalises no noun. That is load-bearing here in a way it is
    // not in a language with morphology — `indonesian.analyze` is `identity()`
    // alone, so there is no stripper to recover a printed word at a penalty,
    // which is why `°` had to be written into `aliases` by hand.
    for (const [unit, words] of Object.entries(angleId.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
      // And the symbol, which is the other thing the printer can emit — `°` is
      // the one string here that `units.ts` does not declare.
      expect(words.aliases, `${unit} prints symbol ${words.symbol}`).toContain(
        words.symbol as string,
      );
    }
  });

  test("the gradian keeps `grad`, which German had to give up", () => {
    // `@smartput/angle/locale/de` spends its header on the reservation: the
    // German word for an angular degree *is* `Grad`, the string `units.ts`
    // declares as the abbreviation for the gradian. The Indonesian word is
    // `derajat`, which collides with nothing, so both units keep everything the
    // alias map gave them.
    expect(angleId.units.grad?.aliases).toContain("grad");
    expect(angleId.units.deg?.aliases).toContain("derajat");
    const e = engine();
    expect(e.evaluate("100 grad").value.unit).toBe("grad");
    expect(e.evaluate("100 gon").value.unit).toBe("grad");
    expect(e.evaluate("90 derajat").value.unit).toBe("deg");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [angleId]), [angle]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Indonesian that row is the same
    // word as every other row, where Dutch's is a plural (`graden`) because an
    // angle is counted.
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [angleId]), [angle], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // The sharpest place to say it: this is the kind where Dutch and German do
    // mark number, on the reasoning that an angle is counted rather than
    // measured out. Indonesian has no number to mark, so the distinction has
    // nowhere to land.
    for (const unit of ["rad", "deg", "grad", "turn"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("deg", 90)).toBe("derajat");
    expect(word("turn", 2)).toBe("putaran");
    expect(word("rad", 1)).toBe("radian");
  });

  test("an engine built from it reads and writes Indonesian angle", () => {
    const e = engine();
    expect(e.evaluate("90 derajat").formatted).toBe("90 derajat");
    expect(e.evaluate("1 radian").formatted).toBe("1 radian");
    expect(e.evaluate("100 gon").formatted).toBe("100 gon");
    // The English `turn`/`turns` from `units.ts` read, and answer in Indonesian.
    expect(e.evaluate("2 turn").formatted).toBe("2 putaran");
    // Arithmetic, and a conversion in both directions through both keywords.
    expect(e.evaluate("90 derajat tambah 45 derajat").formatted).toBe("135 derajat");
    expect(e.evaluate("1 putaran dalam derajat").formatted).toBe("360 derajat");
    expect(e.evaluate("360 derajat ke putaran").formatted).toBe("1 putaran");
    // A conversion landing on a fraction, with the decimal comma CLDR supplies.
    expect(e.evaluate("180 derajat ke putaran").formatted).toBe("0,5 putaran");
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "90 derajat tambah 45 derajat",
      "1 putaran dalam derajat",
      "180 derajat ke putaran",
      "100 gon",
      "1 radian",
      "2 turn",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      // Compared at 20 decimals rather than digit for digit, exactly as
      // `nl.test.ts` compares them: this kind's canonical is radians and its
      // ratios are 30-digit literals, so re-reading a printed degree count
      // rounds in the last of the 28 configured digits. That is the kind's
      // arithmetic and not the language's — the mass and length round trips
      // beside this one are exact.
      expect(again.value.canonical.toFixed(20), input).toBe(
        first.value.canonical.toFixed(20),
      );
    }
  });
});
