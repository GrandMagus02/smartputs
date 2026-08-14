import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { length } from "../index";
import lengthId from "./id";

const engine = () =>
  createEngine({
    locales: [composeLocale(indonesian, [lengthId])],
    kinds: [length],
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
    kind: "length",
    unit,
    slot,
  });
  return (lengthId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("length id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Indonesian word", () => {
    // Naming the words is the whole check, as it is in `nl.test.ts`: Indonesian
    // is written in plain ASCII, so there is no script class to sweep for the
    // way `ja.test.ts` sweeps for kana. Three of the four are bounded because
    // an English alias contains them as a prefix — `mil` sits inside `mile` and
    // `inci` would sit inside nothing, but the boundary costs nothing and says
    // what is meant.
    expect(JSON.stringify(length)).not.toMatch(/sentimeter|\binci\b|\bkaki\b|\bmil\b/i);
  });

  test("`in` stays out of the aliases", () => {
    // The reservation this file makes for the second of English's two reasons:
    // `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
    // without consulting a locale, so an Indonesian `in` would put the word back
    // in front of `@smartput/datetime`'s accept-gate for any engine that also
    // speaks English. Indonesian's own conversion words are `ke` and `dalam`,
    // so nothing is lost — and unlike English this vocabulary has a short form
    // of its own to print, which is why it needs no `skipPrintable` waiver.
    for (const words of Object.values(lengthId.units)) {
      expect(words.aliases).not.toContain("in");
    }
    expect(lengthId.units.in?.symbol).toBe("inci");
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
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
            kind: "length",
            unit: "m",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(lengthId.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs:
    // Indonesian capitalises no noun. That is load-bearing here in a way it is
    // not in a language with morphology — `indonesian.analyze` is `identity()`
    // alone, so there is no stripper to recover a printed word at a penalty.
    for (const [unit, words] of Object.entries(lengthId.units)) {
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
      assertLocaleContract(composeLocale(indonesian, [lengthId]), [length]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Indonesian that row is the same
    // word as every other row, where German's is a plural and Ukrainian's a
    // genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [lengthId]), [length], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // The Dutch measure rule and the Dutch counted-noun exception both
    // disappear here: there is no number axis to have an exception on.
    for (const unit of ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("m", 10)).toBe("meter");
    expect(word("cm", 50)).toBe("sentimeter");
    expect(word("ft", 6)).toBe("kaki");
  });

  test("an engine built from it reads and writes Indonesian length", () => {
    const e = engine();
    expect(e.evaluate("5 kilometer").formatted).toBe("5 kilometer");
    expect(e.evaluate("1,5 meter").formatted).toBe("1,5 meter");
    // The three Indonesian spellings this file adds, and the three imperial
    // nouns Indonesian translated.
    expect(e.evaluate("100 milimeter").value.unit).toBe("mm");
    expect(e.evaluate("2,5 sentimeter").value.unit).toBe("cm");
    expect(e.evaluate("12 inci").value.unit).toBe("in");
    expect(e.evaluate("3 kaki").value.unit).toBe("ft");
    expect(e.evaluate("5 mil").value.unit).toBe("mi");
    expect(e.evaluate("2 yard").value.unit).toBe("yd");
    // Arithmetic landing on a fraction, across two units: the decimal comma
    // comes from CLDR through `numberFormat: "intl"` and the noun does not move.
    expect(e.evaluate("1 meter tambah 50 sentimeter").formatted).toBe("1,5 meter");
    // Both conversion keywords, and the group separator — the exact inverse of
    // English's pair.
    expect(e.evaluate("2 km dalam meter").formatted).toBe("2.000 meter");
    expect(e.evaluate("100 milimeter ke sentimeter").formatted).toBe("10 sentimeter");
    // The English spellings `units.ts` gives keep working, and answer in
    // Indonesian — the two registers side by side.
    expect(e.evaluate("2 kilometers").formatted).toBe("2 kilometer");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `id`
    // groups with "." and the lexer reads that back as a group separator, so
    // "2.000 meter" is 2000 m and not 2.
    const e = engine();
    for (const input of [
      "1 meter tambah 50 sentimeter",
      "2 km dalam meter",
      "100 milimeter ke sentimeter",
      "12 inci",
      "3 kaki",
      "5 mil",
      "1,5 meter",
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
