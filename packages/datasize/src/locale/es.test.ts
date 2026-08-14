import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeEs from "./es";

const locale = () => composeLocale(spanish, [datasizeEs]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** The key `spanish` hands this kind for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "datasize",
    unit,
    slot,
  });
  return (datasizeEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `spanish.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    spanish.selectForm({ kind: "datasize", unit: "mb", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      spanish.selectForm({
        count: new Decimal(count),
        kind: "datasize",
        unit: "mb",
        slot,
      }),
    ),
  ]),
);

describe("datasize es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Spanish
  // cannot borrow: the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids. The words themselves are the check that
  // survives translation — and for this kind they are the same words `en.test.ts`
  // looks for, because Spanish borrowed the family whole, plus the one calque
  // this vocabulary adds.
  test("the kind itself carries no Spanish word", () => {
    expect(JSON.stringify(datasize)).not.toMatch(
      /byte|kilobyte|megabyte|gigabyte|terabyte|kibibyte|mebibyte|gibibyte|tebibyte|octeto/i,
    );
  });

  test("`spanish` asks for exactly two keys, and every unit fills exactly those", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count,
    // and CLDR's `many` (1e6 and its multiples), which `selectForm` folds into
    // `other` because this engine never prints compact notation. The sweep
    // above includes 1e6 precisely so that fold is sampled here rather than
    // taken from the doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(datasizeEs.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // The half `assertLocaleContract` walks the alias list for, asserted from
    // the vocabulary's own side: a form recovered only by `spanish`'s suffix
    // stripper reads back at a -2 penalty, by accident rather than by
    // declaration, and stops reading back the day a stem falls under its
    // `minStem: 3`. Here every form is an alias `units.ts` already declared,
    // which is the whole reason this file adds no plural spellings.
    for (const [unit, words] of Object.entries(datasizeEs.units)) {
      const symbol = words.symbol as string;
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
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Spanish answers it with `other`, the same row 2 and 5
    // take — but that is a decision `selectForm` makes, not a fact about
    // arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, and 1 is the only singular", () => {
    expect(word("mb", 1)).toBe("megabyte");
    expect(word("mb", 2)).toBe("megabytes");
    expect(word("mb", 0)).toBe("megabytes");
    // The row a one-dimensional "n === 1" rule gets right by luck and a
    // CLDR-shaped one gets wrong: Spanish keeps 21 plural where Ukrainian makes
    // it singular, and a fraction is plural too ("1,5 megabytes").
    expect(word("mb", 21)).toBe("megabytes");
    expect(word("mb", 1.5)).toBe("megabytes");
    // A conversion target has no count at all, and R5 says every language must
    // still answer. Spanish answers with the plural, which is how the target of
    // "2 gb en megabytes" is written.
    expect(word("mb", undefined, "conversion-target")).toBe("megabytes");
  });

  test("an engine built from it reads and writes Spanish datasize", () => {
    // The decimal comma, read and written. "1.5" is not a Spanish number — the
    // full stop is the *group* separator here — so writing the test with one
    // would exercise a different code path entirely.
    expect(engine.evaluate("1,5 kilobytes").formatted).toBe("1,5 kilobytes");
    // A sum landing on a fraction, which no integer count can reach.
    expect(engine.evaluate("1 kb + 500 b").formatted).toBe("1,5 kilobytes");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 gb en mb").formatted).toBe("2.000 megabytes");
    expect(engine.evaluate("2 gb a megabytes").formatted).toBe("2.000 megabytes");
    // The RAE's calque, in and Spanish out.
    expect(engine.evaluate("512 octetos").formatted).toBe("512 bytes");
    // The binary units are their own units, and the number proves it: a
    // gibibyte is 1024 mebibytes, not 1000.
    expect(engine.evaluate("1 gib en mib").formatted).toBe("1.024 mebibytes");
    // Singular, the one count that takes the `one` row.
    expect(engine.evaluate("1 mb").formatted).toBe("1 megabyte");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1,5 kilobytes",
      "1 kb + 500 b",
      "2 gb en mb",
      "1 gib en mib",
      "512 octetos",
      "1 mb",
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
