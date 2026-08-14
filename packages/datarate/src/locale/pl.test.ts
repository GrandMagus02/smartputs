import { describe, expect, test } from "bun:test";
import { aliasesFor, composeLocale, createEngine } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import { DATARATE_UNITS, type DatarateUnit } from "../units";
import dataratePl from "./pl";

const engine = createEngine({
  locales: [composeLocale(polish, [dataratePl])],
  kinds: [datarate],
});

describe("datarate pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(dataratePl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(dataratePl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The decision `en.ts` records, restated for a language that would need eight
  // keys rather than two: a written Polish rate is "megabitów na sekundę" or
  // "Mbit/s", and neither lexes back as one unit token — a space ends a word
  // token, "/" ends it too, and the middle word of the phrase is this language's
  // `in` keyword — so declaring forms here would be prose no input could reach.
  // The renderer stays on the symbol because of it, which is why every
  // expectation below is a spaced number-plus-symbol.
  test("no unit declares a written form", () => {
    for (const [unit, words] of Object.entries(dataratePl.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The mirror of `ru.test.ts`'s "the kind itself carries no Russian word", and
  // it needs two halves rather than one because Polish is written in the Latin
  // alphabet. A Cyrillic-block regex is a complete proxy for Russian — any
  // Cyrillic letter in the descriptor is a leak — and Polish has no such block
  // to point at. So the diacritics do the first half, and the vocabulary's own
  // distinctively Polish stems do the second: between them, a translation that
  // had leaked into the language-free part of the package has nowhere to hide.
  test("the kind itself carries no Polish word", () => {
    const descriptor = JSON.stringify(datarate);
    expect(descriptor).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
    for (const stem of ["bit", "kilobit", "megabit", "mega", "giga"]) {
      expect(descriptor, `the kind names "${stem}"`).not.toContain(stem);
    }
  });

  // The mechanism behind every round trip below, asserted directly rather than
  // left to be inferred from one. This kind's symbols re-read *because they are
  // aliases* of the unit that prints them — the only route open to it.
  // `speed:mps` and `energy:kwh` re-read their compound symbols the other way,
  // as arithmetic over their operand kinds, and that needs a registered
  // signature: `length ÷ duration` and `power × duration` both exist,
  // `datarate ÷ duration` does not and should not, since dividing a rate by a
  // time is not a rate. So if a later edit restores the typographically correct
  // "Mbit/s", this fails first and names the cause.
  test("every symbol is an alias of the unit that prints it", () => {
    for (const [unit, words] of Object.entries(dataratePl.units)) {
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

  // The byte symbols this file deliberately does not spell. `@smartput/datasize`
  // owns "kB"/"MB" in Polish, the alias index is one flat map with no kind in
  // the key, and both fold to lowercase before indexing — so a "Mb" here would
  // land on the same entry as that package's "MB" and hand "100 MB" two
  // readings in the `@smartput/kinds` barrel.
  test("no unit claims a byte spelling", () => {
    for (const [unit, words] of Object.entries(dataratePl.units)) {
      for (const word of words.aliases) {
        expect(word.toLowerCase(), `${unit} claims a byte spelling`).not.toMatch(
          /^[kmgt]?b$/,
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(polish, [dataratePl]), [datarate]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the CLDR
    // "other" category at all — in Polish that category is reached only by a
    // fraction. The kind declares no forms for a fraction to select, so this
    // second call proves the *absence* is uniform rather than merely untested:
    // a unit that grew a partial `forms` table would fail here and nowhere else.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [dataratePl]), [datarate], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Polish datarate", () => {
    // Polish abbreviation in, Polish symbol out, and set off from the number by
    // a space — `polish.renderQuantity` overrides the default's tight symbol
    // branch for PN-EN ISO 80000, so this is "100 Mbit" where the Russian
    // vocabulary next door prints "100Мбит".
    expect(engine.evaluate("100 mbit").formatted).toBe("100 Mbit");
    // The fractional case, which is where the decimal comma shows: Polish marks
    // it ",", read from CLDR by `numberFormat: "intl"`. Spelled with a comma on
    // purpose — "1.5" is not a Polish number, so a test written with one
    // exercises the fallback rather than this locale.
    expect(engine.evaluate("1,5 mbit").formatted).toBe("1,5 Mbit");
    // A sum that lands on a fraction, which is the input `datasize` uses to
    // catch a plural written into the fractional row. Here it can only move the
    // number, because there is no word to agree with it — the visible
    // consequence of declaring no forms.
    expect(engine.evaluate("1 gbit + 500 mbit").formatted).toBe("1,5 Gbit");
    // A conversion, written with "w", and the U+00A0 group separator Polish
    // uses. Written as an escape deliberately: a literal NBSP is invisible here
    // and degrades to a plain space the moment someone retypes the line.
    expect(engine.evaluate("2 gbit w mbit").formatted).toBe("2\u00A0000 Mbit");
    // Latin in, Polish out: a `pl` engine reads both spellings, because the
    // aliases derive from the one alias map in `units.ts` before the Polish
    // words are appended to it.
    expect(engine.evaluate("5 mbps").formatted).toBe("5 Mbit");
    // The genitive plural with its ending *on*: Polish writes "21 megabitów"
    // where Russian's measure nouns take a bare counting form. 21 is `many` in
    // Polish, which is the boundary this language does not share with Ukrainian
    // — but the kind declares no forms, so all it can do here is prove the word
    // reads.
    expect(engine.evaluate("21 megabitów").formatted).toBe("21 Mbit");
    // The colloquial elision, which is how a Polish speaker recovers the
    // per-second the symbol had to give up.
    expect(engine.evaluate("100 mega").formatted).toBe("100 Mbit");
  });

  test("every unit re-reads its own printed output at every magnitude", () => {
    // The property `assertLocaleContract` does *not* fully check: it walks the
    // alias list and proves each alias resolves, and it skips any printed
    // surface carrying an operator character on the grounds that such a surface
    // is arithmetic. This kind has no arithmetic to fall back on, so the check
    // is made here, unit by unit.
    const spellings: Record<string, string> = {
      bps: "bit",
      kbps: "kbit",
      mbps: "mbit",
      gbps: "gbit",
      tbps: "tbit",
    };
    for (const [unit, word] of Object.entries(spellings)) {
      // 1 is `one`, 2 is `few`, 5 is `many`, 21 is `many` too — the cell Polish
      // does not share with Ukrainian — and 1,5 is `other`: all four Polish
      // plural categories, since the category steers the renderer and a fix that
      // held for only one of them would be no fix.
      for (const n of ["1", "2", "5", "21", "1,5"]) {
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
    // The grouped conversion is in this list on purpose. Polish groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "2\u00A0000 Mbit" would come back
    // as two numbers if `lex` did not accept that folded separator for a
    // language whose own separator is a non-breaking space. This is the one
    // input a Polish engine is guaranteed to be handed: its own output.
    for (const input of [
      "100 mbit",
      "1,5 mbit",
      "1 gbit + 500 mbit",
      "2 gbit w mbit",
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

  test("the Latin aliases are derived, never retyped", () => {
    // What keeps the micro path (`parseDatarate`) and the engine path in step:
    // every alias `units.ts` declares for a unit is still an alias of that unit
    // here, and the Polish spellings are an addition rather than a replacement.
    for (const unit of Object.keys(dataratePl.units) as DatarateUnit[]) {
      for (const derived of aliasesFor(DATARATE_UNITS, unit)) {
        expect(dataratePl.units[unit]?.aliases, `${unit} dropped "${derived}"`).toContain(
          derived,
        );
      }
    }
  });
});
