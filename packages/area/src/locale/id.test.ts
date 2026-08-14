import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaId from "./id";

const engine = () =>
  createEngine({
    locales: [composeLocale(indonesian, [areaId])],
    kinds: [area],
  });

/** The only key `indonesian.selectForm` can produce. */
const KEYS = ["other"];

/** The units this vocabulary deliberately gives no `forms` table. */
const SQUARED = ["m2", "cm2", "km2"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("area id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Indonesian word", () => {
    // Naming the word is the whole check, as it is in `nl.test.ts`: Indonesian
    // is written in plain ASCII, so there is no script class to sweep for the
    // way `ja.test.ts` sweeps for kana. `hektar` catches both the spelling this
    // file prints and the shorter one it lists, and cannot match the English
    // `hectare`, which is spelled with a `c`.
    expect(JSON.stringify(area)).not.toMatch(/hektar/i);
  });

  test("the squared units print their symbol, because Indonesian names them with two words", () => {
    // The decision this file takes against `@smartput/area/locale/de`, which
    // gives all three a table because German writes the concept as the single
    // token `Quadratmeter`. The Indonesian name is `meter persegi` — qualifier
    // after the head, as every Indonesian modifier goes — and `lex` ends a word
    // token at a space, so a printed form would be text no analyzer is ever
    // handed whole, which `assertLocaleContract` fails by name.
    for (const unit of SQUARED) {
      expect(areaId.units[unit as "m2"]?.forms, unit).toBeUndefined();
    }
    expect(areaId.units.m2?.symbol).toBe("m²");
    // And, unlike Dutch, there is no closed-up spelling to list for *reading*
    // either: `nl.ts` can offer `vierkantemeter` because Dutch compounds, and
    // `meterpersegi` is a word nobody types. These three units are reachable
    // exactly through what `units.ts` declares.
    for (const unit of SQUARED) {
      expect(areaId.units[unit as "m2"]?.aliases.length, unit).toBe(3);
    }
    const e = engine();
    expect(e.evaluate("10 m2").value.unit).toBe("m2");
    expect(e.evaluate("10 sqm").value.unit).toBe("m2");
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
            kind: "area",
            unit: "hectare",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // The three squared units have no table at all — asserted above, and skipped
    // here rather than softened, because a *partial* table is the failure this
    // check exists to catch.
    for (const [unit, words] of Object.entries(areaId.units)) {
      if (SQUARED.includes(unit)) continue;
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs:
    // Indonesian capitalises no noun. That is load-bearing here in a way it is
    // not in a language with morphology — `indonesian.analyze` is `identity()`
    // alone, so there is no stripper to recover a printed word at a penalty.
    for (const [unit, words] of Object.entries(areaId.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("`are` is left unclaimed, because it is a different unit", () => {
    // Indonesian has a live unit spelled `are` — 100 m², the hundredth of a
    // hectare the word *hektare* is built from — and this kind declares no 100 m²
    // unit for it to resolve to. Pointing it at the acre would be a fortyfold
    // error on a word Indonesian really uses, so it stays out entirely: a
    // refusal says "this engine does not know *are*", and a wrong number says
    // nothing at all.
    for (const words of Object.values(areaId.units)) {
      expect(words.aliases).not.toContain("are");
    }
    expect(() => engine().evaluate("2 are")).toThrow();
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [areaId]), [area]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Indonesian that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [areaId]), [area], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    for (const unit of ["hectare", "acre"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("hectare", 40)).toBe("hektare");
    expect(word("acre", 200)).toBe("acre");
  });

  test("an engine built from it reads and writes Indonesian area", () => {
    const e = engine();
    expect(e.evaluate("2 hektare").formatted).toBe("2 hektare");
    // The shorter spelling reads and answers with the printed one.
    expect(e.evaluate("1 hektar").formatted).toBe("1 hektare");
    expect(e.evaluate("2 acre").formatted).toBe("2 acre");
    // Arithmetic landing on a fraction, with the decimal comma CLDR supplies.
    expect(e.evaluate("1 hektare tambah 0,5 hektare").formatted).toBe("1,5 hektare");
    expect(e.evaluate("100 m2 dalam hektare").formatted).toBe("0,01 hektare");
    // The squared units answer with their symbol, and it is set **tight**:
    // `indonesian` ships no `renderQuantity`, and `defaultRenderQuantity` only
    // spaces the word branch. This is the one place these six packages pay for
    // that decision — Indonesian typography, following SI, would write "10 m²"
    // — and it is the same string `en` and `uk` already produce.
    expect(e.evaluate("10 m2").formatted).toBe("10m²");
    // With the group separator, the exact inverse of English's.
    expect(e.evaluate("1 hektare ke m2").formatted).toBe("10.000m²");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `id`
    // groups with "." and the lexer reads that back as a group separator, so
    // "10.000m²" is 10000 m² and not 10.
    const e = engine();
    for (const input of [
      "1 hektare tambah 0,5 hektare",
      "100 m2 dalam hektare",
      "1 hektare ke m2",
      "10 m2",
      "2 acre",
      "5 km2",
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
