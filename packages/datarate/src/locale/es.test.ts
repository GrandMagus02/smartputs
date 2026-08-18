import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateEs from "./es";

const locale = () => composeLocale(spanish, [datarateEs]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

/** Every key `spanish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        spanish.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        spanish.selectForm({ kind: "datarate", unit: "mbps", slot }),
      ),
    ),
);

describe("datarate es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian files next door assert this with a Cyrillic script regex,
  // which is exactly the check Spanish cannot borrow: the kind is already full
  // of Latin letters ("bps", "mbps"), so a script test would either pass
  // vacuously or fail on the unit ids themselves. The equivalent claim is the
  // one that can still be made — the *words* this file introduces appear
  // nowhere in the language-free half, which is ratios, unit ids, magnitude
  // bands and four bridge signatures naming their operands by string.
  test("the kind itself carries no Spanish word", () => {
    const descriptor = JSON.stringify(datarate);
    for (const word of ["bit", "kilobit", "megabit", "gigabit", "terabit", "mega"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`spanish` asks for exactly two keys, and no unit declares any", () => {
    // The contract the language author pinned: `one` for a count of 1 and
    // `other` for everything else — 0, fractions, CLDR's `many` (which
    // `selectForm` folds away because this engine never prints compact
    // notation), and a conversion target with no count at all.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    // And this kind fills neither, for the reason the vocabulary's doc comment
    // gives: "megabits por segundo" is three words and the middle one is the
    // `times` keyword, so a `forms` table here would be prose the lexer reads
    // as multiplication rather than as a unit. Rule 6 is satisfied by an empty
    // key set, not by two rows of unreachable Spanish.
    for (const [unit, words] of Object.entries(datarateEs.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The property `assertLocaleContract` checks for aliases and this file checks
  // for the other half of the printer's output. With no `forms` anywhere, the
  // symbol is the only string this vocabulary can emit, so it is the only one
  // that has to read back — and it does so by being an alias of its own unit
  // (case-folded, which is what lets "Mbps" and the derived "mbps" be one key).
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datarateEs.units)) {
      const symbol = words.symbol as string;
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

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Spanish folds that into `other` like every other non-1
    // count, which is precisely the claim worth sampling rather than assuming:
    // if `selectForm` ever grows the third CLDR row, this is the line that
    // notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Spanish datarate", () => {
    // Spanish noun in, Spanish symbol out, joined tight because this kind
    // declares no forms.
    expect(engine.evaluate("100 megabits").formatted).toBe("100 Mbps");
    expect(engine.evaluate("100 megas").formatted).toBe("100 Mbps");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Spanish spellings are appended to it.
    expect(engine.evaluate("100 mbps").formatted).toBe("100 Mbps");
    // A conversion, written with "en" — the locative preposition the language
    // lists first under `in`. The group separator is a full stop, which is what
    // `Intl.NumberFormat("es")` produces on this runtime; "2.000" is two
    // thousand megabits per second and not two of them.
    expect(engine.evaluate("2 gbps en mbps").formatted).toBe("2.000 Mbps");
    // ...and with "a", the directional preposition listed beside it.
    expect(engine.evaluate("2 gbps a mbps").formatted).toBe("2.000 Mbps");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is not a Spanish number, so a test
    // written with one would be exercising the group separator instead.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5 Mbps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 megabits",
      "1 mbps + 500 kbps",
      "2 gbps en mbps",
      "1,5 gigabits",
      "2000 mbps",
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
