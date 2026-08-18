import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import dataratePt from "./pt";

const locale = () => composeLocale(portuguese, [dataratePt]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

/** Every key `portuguese.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    portuguese.selectForm({ kind: "datarate", unit: "mbps", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      portuguese.selectForm({
        count: new Decimal(count),
        kind: "datarate",
        unit: "mbps",
        slot,
      }),
    ),
  ]),
);

describe("datarate pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(dataratePt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(dataratePt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door makes this claim with a Cyrillic script regex,
  // which is exactly the check Portuguese cannot borrow: the kind is already
  // full of Latin letters ("bps", "mbps"), so a script test would either pass
  // vacuously or fail on the unit ids themselves. The equivalent claim is the
  // one that can still be made — the *words* this file introduces appear nowhere
  // in the language-free half, which is ratios, unit ids, magnitude bands and
  // four bridge signatures naming their operands by string.
  test("the kind itself carries no Portuguese word", () => {
    const descriptor = JSON.stringify(datarate);
    for (const word of ["bit", "quilobit", "megabit", "gigabit", "terabit", "mega"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`portuguese` asks for exactly two keys, and no unit declares any", () => {
    // The contract the language author pinned: one axis, two rows. `one` covers
    // 1 — and also 0 and 1,5, which is the Portuguese rule (`i = 0..1`) and the
    // opposite of English's; `other` covers everything else, including CLDR's
    // third Portuguese category `many`, which `Intl` really returns for whole
    // multiples of a million and which `selectForm` folds away because it is a
    // fact about the numeral ("1 milhão") and not about the noun. 1e6 is in the
    // sweep above precisely so that fold is sampled rather than trusted.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    // And this kind fills neither, for the reason the vocabulary's doc comment
    // gives: "megabits por segundo" is three words and the middle one is this
    // language's `times` keyword, so a `forms` table here would be prose the
    // lexer reads as multiplication rather than as a unit. Rule 6 is satisfied
    // by an empty key set, not by two rows of unreachable Portuguese.
    for (const [unit, words] of Object.entries(dataratePt.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The property `assertLocaleContract` checks for aliases, checked here for the
  // other half of the printer's output. With no `forms` anywhere the symbol is
  // the only string this vocabulary can emit, so it is the only one that has to
  // read back — and it does so by being an alias of its own unit, case-folded,
  // which is what lets "Mbps" and the derived "mbps" be one key.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(dataratePt.units)) {
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
    // fraction takes. Portuguese sends it to `one` rather than to `other` —
    // "1,5 megabit", not "1,5 megabits" — which is the row a translator
    // borrowing an English intuition gets wrong, and the reason this is sampled
    // instead of assumed.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Portuguese datarate", () => {
    // Portuguese noun in, Portuguese symbol out, joined tight because this kind
    // declares no forms.
    expect(engine.evaluate("100 megabits").formatted).toBe("100 Mbps");
    // The Brazilian colloquial, which is what an ISP advertises.
    expect(engine.evaluate("100 megas").formatted).toBe("100 Mbps");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Portuguese spellings are appended to it.
    expect(engine.evaluate("100 mbps").formatted).toBe("100 Mbps");
    // A conversion, written with "em" — the locative preposition the language
    // lists first under `in`. The group separator is a full stop, which is what
    // `Intl.NumberFormat("pt")` produces on this runtime; "2.000" is two
    // thousand megabits per second and not two of them.
    expect(engine.evaluate("2 gbps em mbps").formatted).toBe("2.000 Mbps");
    // ...and with "para", the directional preposition listed beside it.
    expect(engine.evaluate("2 gbps para mbps").formatted).toBe("2.000 Mbps");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is not a Portuguese number, so a
    // test written with one would be exercising the group separator instead.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5 Mbps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 megabits",
      "1 mbps + 500 kbps",
      "2 gbps em mbps",
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
