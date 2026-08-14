import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeNl from "./nl";

const engine = () =>
  createEngine({
    locales: [composeLocale(dutch, [volumeNl])],
    kinds: [volume],
  });

/** The two keys `dutch.selectForm` can produce, sorted. */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("volume nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Dutch word", () => {
    // Only the nouns, and there is no second sweep to back them up: Dutch is
    // written in plain ASCII, so the umlaut-and-`ß` check that catches a stray
    // German word in `de.test.ts` has no Dutch equivalent. Naming the words is
    // the whole check here.
    expect(JSON.stringify(volume)).not.toMatch(/liter|kubieke|gallon|pinten/i);
  });

  test("`m3` prints its symbol, because Dutch names it with two words", () => {
    // The decision this file takes against `@smartput/volume/locale/de`, which
    // does give `m3` a table. German writes the concept as the single token
    // `Kubikmeter`; the Dutch name is `kubieke meter`, an inflected adjective
    // plus a noun, and `lex` ends a word token at a space — so a printed form
    // would be text no analyzer is ever handed whole, which
    // `assertLocaleContract` fails by name.
    expect(volumeNl.units.m3?.forms).toBeUndefined();
    expect(volumeNl.units.m3?.symbol).toBe("m³");
    // Listed for *reading* all the same: the closed-up spelling is one token, so
    // the index can hold it, and reading a word and printing it are separate
    // decisions.
    expect(volumeNl.units.m3?.aliases).toContain("kubiekemeter");
    const e = engine();
    expect(e.evaluate("10 kubiekemeter").value.unit).toBe("m3");
    expect(e.evaluate("10 kubiekemeter").formatted).toBe("10 m³");
  });

  test("every unit with a table carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows two is all `dutch.selectForm` can ever ask for. The
    // slot loop is the load-bearing half here — Dutch reads `slot` and discards
    // it, so a language that had grown a case axis would show up as a third key
    // (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          dutch.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "volume",
            unit: "l",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // `m3` is the one unit with no table at all — asserted above, and skipped
    // here rather than softened, because a *partial* table is the failure this
    // check exists to catch.
    for (const [unit, words] of Object.entries(volumeNl.units)) {
      if (unit === "m3") continue;
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs. Dutch
    // capitalises no noun, so the table prints `liter` and the alias index holds
    // `liter` — the two halves of this file are the same strings, and asserting
    // that is the point rather than an oversight.
    for (const [unit, words] of Object.entries(volumeNl.units)) {
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
      assertLocaleContract(composeLocale(dutch, [volumeNl]), [volume]),
    ).not.toThrow();
    // The default counts are all integers, so `Intl.PluralRules("nl")` answers
    // from the integer side alone and the fractional reading of `other` is never
    // reached. 1.5 is what makes the contract sample it — and in Dutch that row
    // holds the same invariant noun as every other count ("1,5 liter").
    expect(() =>
      assertLocaleContract(composeLocale(dutch, [volumeNl]), [volume], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("no volume noun moves on the number axis", () => {
    // The Dutch measure rule: "twee liter", "vijf gallon", "drie pint". Both
    // rows of every table are one word. `@smartput/volume/locale/de` disagrees
    // on exactly one of them — `die Gallone` is feminine and prints "zwei
    // Gallonen" — which is the whole difference between the two languages here.
    for (const unit of ["l", "ml", "gal", "pint"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2));
      expect(word(unit, 1), unit).toBe(word(unit, 1.5));
    }
    expect(word("l", 2)).toBe("liter");
    expect(word("gal", 5)).toBe("gallon");
    expect(word("pint", 3)).toBe("pint");
  });

  test("a conversion target is spelled like a bare quantity", () => {
    // `in` and `naar` govern nothing in Dutch, so the count-free target (ruling
    // R5 sends it to `other`) is the bare noun — "in liter", not the dative "in
    // Litern" that `de.ts` needs a second axis to hold.
    for (const unit of ["l", "ml", "gal", "pint"]) {
      expect(word(unit, undefined, "conversion-target"), unit).toBe(word(unit, 1));
    }
    expect(word("l", undefined, "conversion-target")).toBe("liter");
    expect(word("ml", undefined, "conversion-target")).toBe("milliliter");
  });

  test("an engine built from it reads and writes Dutch volume", () => {
    const e = engine();
    expect(e.evaluate("1 liter").formatted).toBe("1 liter");
    expect(e.evaluate("2 liters").formatted).toBe("2 liter");
    // The native `-en` plural of `pint`, which `units.ts` does not declare —
    // read, and answered with the measure form.
    expect(e.evaluate("3 pinten").formatted).toBe("3 pint");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun does not move.
    expect(e.evaluate("1 l + 500 ml").formatted).toBe("1,5 liter");
    // Conversions written with both Dutch keywords, which is `dutch.keywords`'
    // doing and not this file's.
    expect(e.evaluate("1 gallon in liter").formatted).toBe("3,785411784 liter");
    expect(e.evaluate("500 ml naar liter").formatted).toBe("0,5 liter");
    expect(e.evaluate("1 pint in ml").formatted).toBe("473,176473 milliliter");
    // The unit that renders through its symbol, spaced — `dutch.renderQuantity`
    // sets a symbol off from the number the way SI asks, where the default
    // template writes English's tight "2m³".
    expect(e.evaluate("2 m3").formatted).toBe("2 m³");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(e.evaluate("1 m3 in liter").formatted).toBe("1.000 liter");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: Dutch groups with ".", which the lexer does not
    // read back as a group, so a grouped output is asserted above as a string
    // instead.
    const e = engine();
    for (const input of [
      "1 l + 500 ml",
      "1 gallon in liter",
      "500 ml naar liter",
      "3 pinten",
      "0,5 m3",
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
