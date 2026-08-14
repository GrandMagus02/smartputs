import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeId from "./id";

const engine = () =>
  createEngine({
    locales: [composeLocale(indonesian, [volumeId])],
    kinds: [volume],
  });

/** The only key `indonesian.selectForm` can produce. */
const KEYS = ["other"];

/** The unit this vocabulary deliberately gives no `forms` table. */
const WORDLESS = ["m3"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Indonesian word", () => {
    // Naming the words is the whole check, as it is in `nl.test.ts`: Indonesian
    // is written in plain ASCII, so there is no script class to sweep for the
    // way `ja.test.ts` sweeps for kana. Both words are spelled with one `l`
    // where the English aliases double it, so neither can match `millilitre` or
    // `gallon`.
    expect(JSON.stringify(volume)).not.toMatch(/mililiter|galon/i);
  });

  test("the cubic metre prints its symbol, because Indonesian names it with two words", () => {
    // The decision this file takes against `@smartput/volume/locale/de`, which
    // gives the unit a table because German writes the concept as the single
    // token `Kubikmeter`. The Indonesian name is `meter kubik` — qualifier after
    // the head, as every Indonesian modifier goes — and `lex` ends a word token
    // at a space, so a printed form would be text no analyzer is ever handed
    // whole, which `assertLocaleContract` fails by name. Dutch is in the same
    // position and can at least list the closed-up `kubiekemeter` for reading;
    // Indonesian does not compound, so there is nothing to list.
    expect(volumeId.units.m3?.forms).toBeUndefined();
    expect(volumeId.units.m3?.symbol).toBe("m³");
    expect(engine().evaluate("1,5 m3").value.unit).toBe("m3");
  });

  test("every unit with a table carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `indonesian.selectForm` can ever ask
    // for, which is what makes the exact-match assertion on each table mean
    // something (rule 6). The slot loop is the load-bearing half — a language
    // that had grown a case axis would show up as a second key.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 11, 21, 100, 1000]) {
        produced.add(
          indonesian.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // The cubic metre has no table at all — asserted above, and skipped here
    // rather than softened, because a *partial* table is the failure this check
    // exists to catch.
    for (const [unit, words] of Object.entries(volumeId.units)) {
      if (WORDLESS.includes(unit)) continue;
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs:
    // Indonesian capitalises no noun. That is load-bearing here in a way it is
    // not in a language with morphology — `indonesian.analyze` is `identity()`
    // alone, so there is no stripper to recover a printed word at a penalty.
    for (const [unit, words] of Object.entries(volumeId.units)) {
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
      assertLocaleContract(composeLocale(indonesian, [volumeId]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Indonesian that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [volumeId]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    for (const unit of ["l", "ml", "gal", "pint"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("l", 2)).toBe("liter");
    expect(word("ml", 500)).toBe("mililiter");
    expect(word("gal", 1)).toBe("galon");
  });

  test("an engine built from it reads and writes Indonesian volume", () => {
    const e = engine();
    expect(e.evaluate("2 liter").formatted).toBe("2 liter");
    expect(e.evaluate("500 mililiter").value.unit).toBe("ml");
    // `galon` is claimed for the measure a dictionary and a spec sheet mean by
    // it; the nineteen-litre drinking-water bottle everyday speech calls by the
    // same word is a container, and this kind has no unit for a container.
    expect(e.evaluate("1 galon").formatted).toBe("1 galon");
    expect(e.evaluate("3 pint").formatted).toBe("3 pint");
    // Arithmetic landing on a fraction, with the decimal comma CLDR supplies.
    expect(e.evaluate("1 liter tambah 0,5 liter").formatted).toBe("1,5 liter");
    // Both conversion keywords, and the group separator — the exact inverse of
    // English's pair.
    expect(e.evaluate("2 liter dalam mililiter").formatted).toBe("2.000 mililiter");
    expect(e.evaluate("500 mililiter ke liter").formatted).toBe("0,5 liter");
    // The one unit with no word answers with its symbol, set tight because
    // `indonesian` ships no `renderQuantity` — the language's one recorded cost,
    // and the same string `en` and `uk` already produce.
    expect(e.evaluate("1,5 m3").formatted).toBe("1,5m³");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `id`
    // groups with "." and the lexer reads that back as a group separator, so
    // "2.000 mililiter" is 2000 ml and not 2.
    const e = engine();
    for (const input of [
      "1 liter tambah 0,5 liter",
      "2 liter dalam mililiter",
      "500 mililiter ke liter",
      "1 galon",
      "3 pint",
      "1,5 m3",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
    }
  });
});
