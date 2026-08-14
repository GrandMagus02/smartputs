import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateRu from "./ru";

const engine = createEngine({
  locales: [composeLocale(russian, [datarateRu])],
  kinds: [datarate],
});

describe("datarate ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The decision `en.ts` records, restated for a language that would need eight
  // keys rather than two: a written Russian rate is "мегабит в секунду" or
  // "Мбит/с", and neither lexes back as one unit token — a space ends a word
  // token and "/" ends it too — so declaring forms here would be prose no input
  // could reach. The renderer stays on the symbol because of it, which is why
  // every expectation below is tight against the number.
  test("no unit declares a written form", () => {
    for (const [unit, words] of Object.entries(datarateRu.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a
  // kind is ratios and unit ids, so no script but ASCII may reach it. Cyrillic
  // anywhere in the descriptor would mean a translation had leaked into the half
  // of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(datarate)).not.toMatch(/\p{Script=Cyrillic}/u);
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(russian, [datarateRu]), [datarate]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the CLDR
    // "other" category at all — in Russian that category is reached only by a
    // fraction. The kind declares no forms for a fraction to select, so this
    // second call proves the *absence* is uniform rather than merely untested:
    // a unit that grew a partial `forms` table would fail here and nowhere else.
    expect(() =>
      assertLocaleContract(composeLocale(russian, [datarateRu]), [datarate], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  // The mechanism behind every round trip below, asserted directly rather than
  // left to be inferred from one. This kind's symbols re-read *because they are
  // aliases* of the unit that prints them — the only route open to it.
  // `speed:mps` and `energy:kwh` re-read their compound symbols the other way,
  // as arithmetic over their operand kinds, and that needs a registered
  // signature: `length ÷ duration` and `power × duration` both exist,
  // `datarate ÷ duration` does not and should not, since dividing a rate by a
  // time is not a rate. So if a later edit restores the orthographically correct
  // "Мбит/с", this fails first and names the cause.
  test("every symbol is an alias of the unit that prints it", () => {
    for (const [unit, words] of Object.entries(datarateRu.units)) {
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

  test("an engine built from it reads and writes Russian datarate", () => {
    // Cyrillic abbreviation in, Russian symbol out, joined tight because the
    // kind declares no forms.
    expect(engine.evaluate("100 мбит").formatted).toBe("100Мбит");
    // The fractional case, which is where the decimal comma shows: Russian marks
    // it ",", read from CLDR by `numberFormat: "intl"`. Spelled with a comma on
    // purpose — "1.5" is not a Russian number, so a test written with one
    // exercises the fallback rather than this locale.
    expect(engine.evaluate("1,5 мбит").formatted).toBe("1,5Мбит");
    // A sum that lands on a fraction, which is the input `mass` uses to catch a
    // plural written into the fractional row. Here it can only move the number,
    // because there is no word to agree with it — the visible consequence of
    // declaring no forms.
    expect(engine.evaluate("1 гбит + 500 мбит").formatted).toBe("1,5Гбит");
    // A conversion, and the U+00A0 group separator Russian uses. Written as an
    // escape deliberately: a literal NBSP is invisible here and degrades to a
    // plain space the moment someone retypes the line.
    expect(engine.evaluate("2 гбит в мбит").formatted).toBe("2\u00A0000Мбит");
    // Latin in, Russian out: a `ru` engine reads both scripts, because the
    // aliases derive from the one alias map in `units.ts` before the Cyrillic
    // spellings are appended to it.
    expect(engine.evaluate("5 mbps").formatted).toBe("5Мбит");
  });

  test("the numeral boundary moves the number and not the unit", () => {
    // 2 takes `few` and 5 takes `many` in Russian, and this kind answers both
    // with the same symbol. The two spellings are the ones a reader types at
    // each end of that boundary: "2 мегабита" is a genitive singular and
    // "5 мегабит" the bare counting form, and both come back as "Мбит".
    expect(engine.evaluate("2 мегабита").formatted).toBe("2Мбит");
    expect(engine.evaluate("5 мегабит").formatted).toBe("5Мбит");
    // The -ов genitive plural a reader who has not read Rosenthal will type is
    // listed too, and reads to the same unit.
    expect(engine.evaluate("5 мегабитов").formatted).toBe("5Мбит");
  });

  test("every unit re-reads its own printed output at every magnitude", () => {
    // The property `assertLocaleContract` does *not* fully check: it walks the
    // alias list and proves each alias resolves, and it skips any printed
    // surface carrying an operator character on the grounds that such a surface
    // is arithmetic. This kind has no arithmetic to fall back on, so the check
    // is made here, unit by unit — the failure it guards was uniform across the
    // kind in Ukrainian and a spot check on one unit would have passed on a
    // partial fix.
    const spellings: Record<string, string> = {
      bps: "бит",
      kbps: "кбит",
      mbps: "мбит",
      gbps: "гбит",
      tbps: "тбит",
    };
    for (const [unit, word] of Object.entries(spellings)) {
      // 1 is `one`, 2 is `few`, 5 is `many`, 1,5 is `other`: all four Russian
      // plural categories, since the category steers the renderer and a fix that
      // held for only one of them would be no fix.
      for (const n of ["1", "2", "5", "1,5"]) {
        const printed = engine.evaluate(`${n} ${word}`);
        const reread = engine.evaluate(printed.formatted).value;
        expect(
          [reread?.canonical.toString(), reread?.unit],
          `${unit}: "${n} ${word}" printed "${printed.formatted}"`,
        ).toEqual([printed.value?.canonical.toString(), printed.value?.unit]);
      }
    }
  });

  test("round-trips its own output", () => {
    // The grouped conversion is in this list on purpose. Russian groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "2\u00A0000Мбит" would come back as
    // two numbers if `lex` did not accept that folded separator for a language
    // whose own separator is a non-breaking space. This is the one input a
    // Russian engine is guaranteed to be handed: its own output.
    for (const input of [
      "100 мбит",
      "1,5 мбит",
      "1 гбит + 500 мбит",
      "2 гбит в мбит",
      "5 mbps",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
