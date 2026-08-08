import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateUk from "./uk";

const engine = createEngine({
  locales: [composeLocale(ukrainian, [datarateUk])],
  kinds: [datarate],
});

describe("datarate uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The decision `en.ts` records, restated for a language that would need eight
  // keys rather than two: a written Ukrainian rate is "мегабіт на секунду" or
  // "Мбіт/с", and neither lexes back as one unit token, so declaring forms here
  // would be prose no input could reach. The renderer stays on the symbol
  // because of it, which is why every expectation below is tight.
  test("no unit declares a written form", () => {
    for (const [unit, words] of Object.entries(datarateUk.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(datarate)).not.toMatch(/\p{Script=Cyrillic}/u);
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [datarateUk]), [datarate]),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Ukrainian datarate", () => {
    // Cyrillic abbreviation in, Ukrainian symbol out.
    expect(engine.evaluate("100 мбіт").formatted).toBe("100Мбіт/с");
    // The fractional case, which is where the decimal comma shows: Ukrainian
    // marks it ",", read from CLDR by `numberFormat: "intl"`.
    expect(engine.evaluate("1,5 мбіт").formatted).toBe("1,5Мбіт/с");
    // A conversion, and the U+00A0 group separator Ukrainian uses. Written as
    // an escape deliberately: a literal NBSP is invisible here and degrades to
    // a plain space the moment someone retypes the line.
    expect(engine.evaluate("2 гбіт в мбіт").formatted).toBe("2\u00A0000Мбіт/с");
  });

  test("the plural boundary moves the number and not the unit", () => {
    // 2 takes `few` and 5 takes `many` in Ukrainian, and this kind answers both
    // with the same symbol — the visible consequence of declaring no forms. The
    // two spellings are the ones a reader types at each end of that boundary.
    expect(engine.evaluate("2 мегабіти").formatted).toBe("2Мбіт/с");
    expect(engine.evaluate("5 мегабітів").formatted).toBe("5Мбіт/с");
    // Latin in, Ukrainian out: a uk engine reads both scripts.
    expect(engine.evaluate("5 mbps").formatted).toBe("5Мбіт/с");
  });

  test("a Ukrainian rate re-reads to the same value from every spelling of it", () => {
    const canonical = (input: string) => {
      const value = engine.evaluate(input).value;
      return [value?.canonical.toString(), value?.unit];
    };
    // The round trip the vocabulary can carry: every spelling of two gigabits
    // per second agrees on canonical value and unit, whichever way in.
    expect(canonical("2 гбіт")).toEqual(["2000000000", "gbps"]);
    expect(canonical("2 гігабіти")).toEqual(["2000000000", "gbps"]);
    expect(canonical("2 gbps")).toEqual(["2000000000", "gbps"]);
    expect(canonical("2 гбіт в мбіт")).toEqual(["2000000000", "mbps"]);
    expect(canonical("2000 мбіт")).toEqual(["2000000000", "mbps"]);
  });

  // Half of the round trip Ukrainian cannot carry, pinned rather than left to be
  // rediscovered. The cause that remains is in core, not here: "Мбіт/с" contains
  // "/", an operator character — the same fact `units.ts` gives for refusing
  // byte-per-second units. `PrintOptions` already documents that a symbol need
  // not lex back; in Ukrainian that applies to the only spelling the renderer
  // has.
  //
  // The other cause this test used to pin — Ukrainian groups thousands with
  // U+00A0, `normalize()` folds it to a plain space, and "2\u00A0000" reached the
  // lexer as two numbers — is fixed: `lex` accepts the folded separator when the
  // language's own separator is a non-breaking space. So that line is now the
  // equality its author asked whoever landed the fix to write.
  test("a grouped number lexes back, and the symbol still does not", () => {
    const symbolOnly = engine.evaluate("100 мбіт").formatted;
    expect(symbolOnly).toBe("100Мбіт/с");
    expect(() => engine.evaluate(symbolOnly)).toThrow();
    const grouped = engine.evaluate("2\u00A0000 мбіт").value;
    expect([grouped?.canonical.toString(), grouped?.unit]).toEqual([
      "2000000000",
      "mbps",
    ]);
  });
});
