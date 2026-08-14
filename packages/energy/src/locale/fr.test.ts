import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyFr from "./fr";

const locale = () => composeLocale(french, [energyFr]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

/** Every key `french.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 0.5, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({
          count: new Decimal(count),
          kind: "energy",
          unit: "kwh",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({ kind: "energy", unit: "kwh", slot }),
      ),
    ),
);

describe("energy fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which French cannot borrow: the kind is Latin throughout and "joule" is a
  // French word English kept unchanged, so a script test would pass vacuously.
  // The equivalent claim is the one that can still be made — the words this file
  // *introduces* appear nowhere in the language-free half, which is nine ratios,
  // nine unit ids, magnitude bands and four bridge signatures naming their
  // operands by string.
  test("the kind itself carries no French word", () => {
    const descriptor = JSON.stringify(energy);
    for (const word of ["wattheure", "kilowattheure", "mégawattheure", "mégajoule"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`french` asks for exactly two keys, and every unit with forms fills both", () => {
    // CLDR's third French category (`many`, on exact non-zero millions) is
    // folded into `other` by `selectForm` — a French unit noun agrees with the
    // number, not with a scale word — so 1 000 000 does not show up here as a
    // third key.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(energyFr.units)) {
      if (words.forms === undefined) continue;
      expect(Object.keys(words.forms).sort(), `${unit}`).toEqual(["one", "other"]);
    }
    // `btu` is the one row with no table at all, and that is the ruling the
    // vocabulary's doc comment records rather than an omission: a borrowed
    // initialism is invariable in French, and unlike Spanish this language needs
    // no `forms` entry to buy the space before it — `french.renderQuantity`
    // spaces every label.
    expect(energyFr.units.btu?.forms).toBeUndefined();
  });

  test("French is singular below two, which is where an English port breaks", () => {
    const key = (count: number) =>
      french.selectForm({
        count: new Decimal(count),
        kind: "energy",
        unit: "kwh",
        slot: "bare",
      });
    expect(key(0)).toBe("one");
    expect(key(1.5)).toBe("one");
    expect(key(2)).toBe("other");
  });

  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(energyFr.units)) {
      const symbol = words.symbol as string;
      // The watt-hour family is where this check has teeth in French. Every
      // other language in the repo prints a symbol for these three because its
      // spelled-out name carries a hyphen or a space; French writes the noun
      // solid, so it prints a word — and a printed word must be a declared
      // alias, not one the `-2` suffix stripper happens to recover.
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases.map((a) => a.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  test("the hyphenated variant is absent, not merely unprinted", () => {
    // "kilowatt-heure" is the other spelling French dictionaries give, and it
    // could only ever be a dead alias: `lex` reads "-" as subtraction, so no
    // token containing one reaches the alias index at all. Listing it would be
    // coverage that matches nothing — the same reason `french.keywords` declines
    // to declare "d'".
    for (const words of Object.values(energyFr.units)) {
      for (const a of words.aliases) expect(a).not.toMatch(/-/);
    }
    // And the demonstration: the hyphen ends the word token, so the engine
    // never sees "kilowatt-heures" at all — it sees "kilowatt", minus, "heures".
    expect(() => engine.evaluate("5 kilowatt-heures")).toThrow(/kilowatt/);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [energy])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. In French that category is "one", not English's "other",
    // so a table ported by renaming columns would point every 1,5 row at the
    // plural and this sweep is the line that notices.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French energy", () => {
    // The solid noun in and back out — the thing no other language in this repo
    // can do for this family.
    expect(engine.evaluate("5 kilowattheures").formatted).toBe("5 kilowattheures");
    expect(engine.evaluate("5 kWh").formatted).toBe("5 kilowattheures");
    // "joule" needed no line in the vocabulary: it is a French word `units.ts`
    // already carries.
    expect(engine.evaluate("5 joules").formatted).toBe("5 joules");
    expect(engine.evaluate("5 mégajoules").formatted).toBe("5 mégajoules");
    expect(engine.evaluate("5 megajoules").formatted).toBe("5 mégajoules");
    // The initialism, spaced by the language rather than by a `forms` row.
    expect(engine.evaluate("5 btu").formatted).toBe("5 BTU");
    // A conversion, written with "en", landing past the grouping threshold so
    // the narrow no-break space shows.
    expect(engine.evaluate("2 mégajoules en kilojoules").formatted).toBe(
      `2${NNBSP}000 kilojoules`,
    );
    // ...and with "vers", the directional preposition listed beside it.
    expect(engine.evaluate("1 kWh vers wattheures").formatted).toBe(
      `1${NNBSP}000 wattheures`,
    );
    // A sum landing on a fraction — the decimal comma, and the French singular
    // at exactly the value English pluralises.
    expect(engine.evaluate("1 kWh + 500 wattheures").formatted).toBe("1,5 kilowattheure");
    expect(engine.evaluate("1 kJ + 1 kJ").formatted).toBe("2 kilojoules");
  });

  test("its own output reads back to the same value", () => {
    // The round trip the narrow no-break space makes worth pinning: `normalize`
    // folds every `\s` run to one plain space before `lex` sees it, so
    // "2 000 kilojoules" arrives spelled with U+0020 and is held together by
    // the lexer's three-digit lookahead rather than by the character itself.
    for (const input of [
      "5 kilowattheures",
      "1 kWh + 500 wattheures",
      "2 mégajoules en kilojoules",
      "1,5 kilocalories",
      "2000 wattheures",
      "5 btu",
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
