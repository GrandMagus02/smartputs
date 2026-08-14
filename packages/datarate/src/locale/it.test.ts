import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateIt from "./it";

const locale = () => composeLocale(italian, [datarateIt]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

/** Every key `italian.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({ kind: "datarate", unit: "mbps", slot }),
      ),
    ),
);

describe("datarate it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which is exactly the check Italian cannot borrow: the kind is already full
  // of Latin letters ("bps", "mbps"), so a script test would either pass
  // vacuously or fail on the unit ids themselves. The equivalent claim is the
  // one that can still be made — the *words* this file introduces appear nowhere
  // in the language-free half, which is ratios, unit ids, magnitude bands and
  // four bridge signatures naming their operands by string.
  test("the kind itself carries no Italian word", () => {
    const descriptor = JSON.stringify(datarate);
    for (const word of ["chilobit", "mega", "giga", "bit"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`italian` asks for exactly two keys, and no unit declares any", () => {
    // The contract the language author pinned: `one` for a count of 1 and
    // `other` for everything else — 0, fractions, CLDR's `many` (which
    // `selectForm` folds away because this engine never prints compact
    // notation), and a conversion target with no count at all. The slot is
    // ignored throughout, Italian nouns having no case.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    // And this kind fills neither, for the reason the vocabulary's doc comment
    // gives: "megabit al secondo" is three words, and a unit word is one token.
    // Rule 6 is satisfied by an empty key set, not by two rows of unreachable
    // Italian.
    for (const [unit, words] of Object.entries(datarateIt.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The property `assertLocaleContract` checks for aliases, checked here for the
  // other half of the printer's output. With no `forms` anywhere, the symbol is
  // the only string this vocabulary can emit, so it is the only one that has to
  // read back — and it does so by being an alias of its own unit, case-folded,
  // which is what lets "Mbps" and the derived "mbps" be one key.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datarateIt.units)) {
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

  // Every alias here is a consonant-final loanword, which is the invariant class
  // `it.ts` describes: no row of `pluralFold` fires on it and none should. This
  // pins the claim the vocabulary makes rather than leaving it to prose — if a
  // plural spelling is ever added out of habit, this is where it shows.
  test("no Italian alias carries a plural ending", () => {
    for (const [unit, words] of Object.entries(datarateIt.units)) {
      for (const word of words.aliases) {
        expect(word, `${unit}: "${word}" looks pluralised`).not.toMatch(/(bits|megas)$/i);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Italian folds that into `other` like every other non-1
    // count, which is precisely the claim worth sampling rather than assuming:
    // if `selectForm` ever grows CLDR's third row, this is the line that notices
    // before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Italian datarate", () => {
    // Italian noun in, symbol out, joined tight because this kind declares no
    // forms.
    expect(engine.evaluate("100 megabit").formatted).toBe("100Mbps");
    expect(engine.evaluate("100 mega").formatted).toBe("100Mbps");
    // The invariant plural, which is the whole point of the table: "cento
    // megabit" is a hundred of them and the noun does not move.
    expect(engine.evaluate("cento megabit").formatted).toBe("100Mbps");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Italian spellings are appended to it.
    expect(engine.evaluate("100 mbps").formatted).toBe("100Mbps");
    // A conversion written with "in", the preposition the language lists first,
    // and with "a", the directional one listed beside it. The group separator is
    // a full stop, which is what `Intl.NumberFormat("it")` produces on this
    // runtime: "2.000" is two thousand megabits per second, not two of them.
    expect(engine.evaluate("2 gbps in mbps").formatted).toBe("2.000Mbps");
    expect(engine.evaluate("2 gbps a mbps").formatted).toBe("2.000Mbps");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is not an Italian number, so a test
    // spelled that way would be exercising the group separator instead.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5Mbps");
    // ...and the same sum spelled with Italian's own word for the operator.
    expect(engine.evaluate("1 mbps più 500 kbps").formatted).toBe("1,5Mbps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 megabit",
      "1 mbps + 500 kbps",
      "2 gbps in mbps",
      "1,5 gigabit",
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
