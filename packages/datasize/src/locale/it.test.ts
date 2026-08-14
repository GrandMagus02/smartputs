import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeIt from "./it";

const locale = () => composeLocale(italian, [datasizeIt]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** Every key `italian.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({
          count: new Decimal(count),
          kind: "datasize",
          unit: "mb",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({ kind: "datasize", unit: "mb", slot }),
      ),
    ),
);

describe("datasize it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which Italian cannot borrow: the kind is already full of Latin letters
  // ("kb", "mib"), so a script test would either pass vacuously or fail on the
  // unit ids themselves. The equivalent claim is that the words this file
  // *introduces* appear nowhere in the language-free half, which is ratios, unit
  // ids and the magnitude bands `typical` records.
  test("the kind itself carries no Italian word", () => {
    const descriptor = JSON.stringify(datasize);
    for (const word of ["ottetto", "ottetti", "chilobyte"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("every unit carries exactly the two keys `italian` can produce", () => {
    // The contract the language author pinned: `one` for a count of 1 and
    // `other` for everything else — 0, fractions, CLDR's `many` (folded away
    // because this engine never prints compact notation), and a conversion
    // target with no count at all. The slot is ignored throughout, Italian nouns
    // having no case, so there is one column and not two.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(datasizeIt.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}'s key set`).toEqual([
        "one",
        "other",
      ]);
    }
  });

  // The invariant loanword plural, pinned rather than left to the doc comment:
  // an Italian consonant-final borrowing does not inflect, so both rows of every
  // table hold the same string. The day someone "fixes" one of them into
  // "megabytes", this is the line that objects.
  test("both rows of every table hold the same word", () => {
    for (const [unit, words] of Object.entries(datasizeIt.units)) {
      const forms = words.forms as Record<string, string>;
      expect(forms.other, `${unit} inflects its loanword`).toBe(forms.one);
      expect(forms.one, `${unit} looks pluralised`).not.toMatch(/s$/);
    }
  });

  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datasizeIt.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases.map((a) => a.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      // Rule 5, the one that catches a printed form recovered only by the
      // penalised analyzer: every word this table prints must be a word the
      // alias list already holds outright.
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Italian folds that into `other` like every other non-1
    // count, which is precisely the claim worth sampling rather than assuming:
    // if `selectForm` ever grows CLDR's third row, this notices before a user
    // does.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Italian datasize", () => {
    // The word is spaced because a `forms` entry is a word, where a symbol is
    // set tight — and it is the same word at one and at two, which is the whole
    // Italian claim this file makes.
    expect(engine.evaluate("1 megabyte").formatted).toBe("1 megabyte");
    expect(engine.evaluate("2 megabyte").formatted).toBe("2 megabyte");
    // The Italian numeral fold reaches the same value through the welded word.
    expect(engine.evaluate("due megabyte").formatted).toBe("2 megabyte");
    // The native calque reads, in both its numbers, and prints as the borrowing.
    expect(engine.evaluate("500 ottetti").formatted).toBe("500 byte");
    // A conversion with "in", and the group separator that makes it worth
    // asserting: `Intl.NumberFormat("it")` groups with ".", so a thousand
    // megabytes is "1.000" and not one.
    expect(engine.evaluate("1 gb in mb").formatted).toBe("1.000 megabyte");
    // The binary row, which must never fold onto the decimal one: 1 KiB is 1024
    // bytes and 1 kB would be 1000.
    expect(engine.evaluate("1 kib in b").formatted).toBe("1.024 byte");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is not an Italian number.
    expect(engine.evaluate("1 mb + 500 kb").formatted).toBe("1,5 megabyte");
    // ...and the same sum spelled with Italian's own word for the operator.
    expect(engine.evaluate("1 mb più 500 kb").formatted).toBe("1,5 megabyte");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 megabyte",
      "2 megabyte",
      "1 mb + 500 kb",
      "1 gb in mb",
      "1,5 gigabyte",
      "500 ottetti",
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
