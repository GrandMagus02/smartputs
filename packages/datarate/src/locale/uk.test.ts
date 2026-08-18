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

  // The property `assertLocaleContract` above does *not* check, and the one this
  // vocabulary's symbols were chosen to satisfy. That assertion walks the alias
  // list and proves each alias resolves; it never asks whether the strings the
  // *printer* emits are among them. Those are different sets, and the whole of
  // this file's defect lived in the gap: the symbols used to be "Мбіт/с" and
  // friends, which the printer emitted and the lexer then split on "/" into
  // `datarate ÷ duration` — a signature that does not exist. Every unit is
  // checked, at three magnitudes, because the failure was uniform across the
  // kind and a spot check on one unit would have passed on a partial fix.
  test("every unit re-reads its own printed output at every magnitude", () => {
    // The first Cyrillic alias of each unit — what a reader types, and the
    // shortest input that reaches the printer.
    const spellings: Record<string, string> = {
      bps: "біт",
      kbps: "кбіт",
      mbps: "мбіт",
      gbps: "гбіт",
      tbps: "тбіт",
    };
    for (const [unit, word] of Object.entries(spellings)) {
      // 1 is `one`, 2 is `few`, 5 is `many`: the three Ukrainian plural
      // categories a whole number can select. The category steers the renderer,
      // so a fix that held for only one of them would be no fix.
      for (const n of ["1", "2", "5"]) {
        const printed = engine.evaluate(`${n} ${word}`);
        const reread = engine.evaluate(printed.formatted).value;
        expect(
          [reread?.canonical.toString(), reread?.unit],
          `${unit}: "${n} ${word}" printed "${printed.formatted}"`,
        ).toEqual([printed.value?.canonical.toString(), printed.value?.unit]);
      }
    }
  });

  test("an engine built from it reads and writes Ukrainian datarate", () => {
    // Cyrillic abbreviation in, Ukrainian symbol out.
    expect(engine.evaluate("100 мбіт").formatted).toBe("100 Мбіт");
    // The fractional case, which is where the decimal comma shows: Ukrainian
    // marks it ",", read from CLDR by `numberFormat: "intl"`. Spelled with a
    // comma on purpose — "1.5" is not a Ukrainian number, so a test written
    // with one exercises the fallback rather than this locale.
    expect(engine.evaluate("1,5 мбіт").formatted).toBe("1,5 Мбіт");
    // ...and it round-trips too, which the whole-number loop above cannot
    // reach: a fraction takes `other`, a fourth plural category.
    expect(engine.evaluate(engine.evaluate("1,5 мбіт").formatted).formatted).toBe(
      "1,5 Мбіт",
    );
    // A conversion, and the U+00A0 group separator Ukrainian uses. Written as
    // an escape deliberately: a literal NBSP is invisible here and degrades to
    // a plain space the moment someone retypes the line.
    expect(engine.evaluate("2 гбіт в мбіт").formatted).toBe("2\u00A0000 Мбіт");
  });

  test("the plural boundary moves the number and not the unit", () => {
    // 2 takes `few` and 5 takes `many` in Ukrainian, and this kind answers both
    // with the same symbol — the visible consequence of declaring no forms. The
    // two spellings are the ones a reader types at each end of that boundary.
    expect(engine.evaluate("2 мегабіти").formatted).toBe("2 Мбіт");
    expect(engine.evaluate("5 мегабітів").formatted).toBe("5 Мбіт");
    // Latin in, Ukrainian out: a uk engine reads both scripts.
    expect(engine.evaluate("5 mbps").formatted).toBe("5 Мбіт");
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

  // The mechanism behind the round trip, asserted directly rather than left to
  // be inferred from it. This kind's symbols re-read *because they are aliases*
  // of the unit that prints them — the only route open to it. `speed:mps` and
  // `energy:kwh` re-read their compound symbols the other way, as arithmetic
  // over their operand kinds, and that needs a registered signature: `length ÷
  // duration` and `power × duration` both exist, `datarate ÷ duration` does not
  // and should not, since dividing a rate by a time is not a rate.
  //
  // So if a later edit restores the orthographically correct "Мбіт/с", this
  // fails first and names the cause, instead of leaving the round trip above to
  // report a confusing "Cannot apply operation to datarate and duration".
  test("every symbol is an alias of the unit that prints it", () => {
    for (const [unit, words] of Object.entries(datarateUk.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases.map((word) => word.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
    }
  });

  // The other half of the round trip, and the half that never depended on this
  // vocabulary. Ukrainian groups thousands with
  // U+00A0, `normalize()` folds it to a plain space, and "2\u00A0000" reached the
  // lexer as two numbers — is fixed: `lex` accepts the folded separator when the
  // language's own separator is a non-breaking space. Kept as an equality
  // because it is what lets the four-digit conversion above survive re-reading.
  test("a grouped number lexes back", () => {
    const grouped = engine.evaluate("2\u00A0000 мбіт").value;
    expect([grouped?.canonical.toString(), grouped?.unit]).toEqual([
      "2000000000",
      "mbps",
    ]);
  });
});
