import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerFr from "./fr";

const locale = () => composeLocale(french, [powerFr]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

/** Every key `french.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 0.5, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({
          count: new Decimal(count),
          kind: "power",
          unit: "kw",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({ kind: "power", unit: "kw", slot }),
      ),
    ),
);

describe("power fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which French cannot borrow: the kind is Latin throughout and "watt" is an SI
  // name French and English share, so a script test would pass vacuously. The
  // equivalent claim is the one that can still be made — the word this file
  // *introduces* appears nowhere in the language-free half, which is five ratios,
  // five unit ids and the magnitude bands `typical` records.
  test("the kind itself carries no French word", () => {
    const descriptor = JSON.stringify(power);
    for (const word of ["mégawatt", "cheval", "chevaux"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`french` asks for exactly two keys, and every unit with forms fills both", () => {
    // CLDR's third French category (`many`, on exact non-zero millions) is
    // folded into `other` by `selectForm` — a French unit noun agrees with the
    // number, not with a scale word — so 1 000 000 does not appear as a third
    // key here.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(powerFr.units)) {
      if (words.forms === undefined) continue;
      expect(Object.keys(words.forms).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("French is singular below two, which is where an English port breaks", () => {
    const key = (count: number) =>
      french.selectForm({
        count: new Decimal(count),
        kind: "power",
        unit: "kw",
        slot: "bare",
      });
    expect(key(0)).toBe("one");
    expect(key(1.5)).toBe("one");
    expect(key(2)).toBe("other");
  });

  test("`hp` carries no French word, because no French word means this unit", () => {
    // The ruling the vocabulary's doc comment argues at length: "cheval",
    // "chevaux" and "ch" all name the *metric* horsepower (735,49875 W), and
    // this unit is mechanical horsepower (745,69987158227022 W). Registering any
    // of them would answer one question with the other, off by 1,4 %. Asserted
    // rather than trusted, because the failure is silent by construction.
    const hp = powerFr.units.hp;
    expect(hp?.forms).toBeUndefined();
    for (const word of ["ch", "cheval", "chevaux", "cv"]) {
      expect(hp?.aliases, `hp claims "${word}"`).not.toContain(word);
    }
    // ...and the gap this leaves is real: a French speaker typing the everyday
    // word gets a refusal rather than a wrong number, which is the outcome the
    // ruling chooses.
    expect(() => engine.evaluate("150 chevaux")).toThrow(/cheva/);
  });

  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(powerFr.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases.map((a) => a.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      // Rule 5: a form the printer emits must be a form the parser reads at full
      // weight, not one `french.analyze`'s `-2` suffix stripper happens to
      // recover.
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. In French that category is "one", not English's "other",
    // so a table ported by renaming columns would point every 1,5 row at the
    // plural and this sweep is the line that notices.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French power", () => {
    expect(engine.evaluate("5 kilowatts").formatted).toBe("5 kilowatts");
    expect(engine.evaluate("5 kW").formatted).toBe("5 kilowatts");
    expect(engine.evaluate("5 mégawatts").formatted).toBe("5 mégawatts");
    expect(engine.evaluate("5 megawatts").formatted).toBe("5 mégawatts");
    // The initialism, spaced by `french.renderQuantity` rather than by a `forms`
    // row — where English prints "150hp" tight.
    expect(engine.evaluate("150 hp").formatted).toBe("150 hp");
    // A conversion, written with "en", landing past the grouping threshold so
    // the narrow no-break space shows.
    expect(engine.evaluate("2 mégawatts en kilowatts").formatted).toBe(
      `2${NNBSP}000 kilowatts`,
    );
    // ...and with "vers", the directional preposition listed beside it.
    expect(engine.evaluate("1 kW vers watts").formatted).toBe(`1${NNBSP}000 watts`);
    // A sum landing on a fraction — the decimal comma, and the French singular
    // at exactly the value English pluralises.
    expect(engine.evaluate("1 kW + 500 watts").formatted).toBe("1,5 kilowatt");
    expect(engine.evaluate("1 kW + 1 kW").formatted).toBe("2 kilowatts");
  });

  test("its own output reads back to the same value", () => {
    // The round trip the narrow no-break space makes worth pinning: `normalize`
    // folds every `\s` run to one plain space before `lex` sees it, so
    // "2 000 kilowatts" arrives spelled with U+0020 and is held together by the
    // lexer's three-digit lookahead rather than by the character itself.
    for (const input of [
      "5 kilowatts",
      "1 kW + 500 watts",
      "2 mégawatts en kilowatts",
      "1,5 gigawatts",
      "150 hp",
      "2000 watts",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
