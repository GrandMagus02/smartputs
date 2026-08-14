import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizePt from "./pt";

const locale = () => composeLocale(portuguese, [datasizePt]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "datasize",
    unit,
    slot,
  });
  return (datasizePt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `portuguese.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    portuguese.selectForm({ kind: "datasize", unit: "mb", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      portuguese.selectForm({
        count: new Decimal(count),
        kind: "datasize",
        unit: "mb",
        slot,
      }),
    ),
  ]),
);

describe("datasize pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizePt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizePt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Portuguese
  // cannot borrow: the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids. The words themselves are the check that
  // survives translation — and for this kind they are the same words `en.test.ts`
  // looks for, because Portuguese borrowed the family whole, plus the two
  // readings this vocabulary adds.
  test("the kind itself carries no Portuguese word", () => {
    expect(JSON.stringify(datasize)).not.toMatch(
      /byte|kilobyte|megabyte|gigabyte|terabyte|kibibyte|mebibyte|gibibyte|tebibyte|octeto|quilobyte/i,
    );
  });

  test("`portuguese` asks for exactly two keys, and every unit fills exactly those", () => {
    // The contract the language author pinned: one axis, two rows, no case or
    // slot dimension — a conversion target ("em megabytes") is spelled like a
    // bare quantity. `other` also absorbs CLDR's third Portuguese category
    // `many`, which `Intl` really returns at 1e6 and its multiples; the sweep
    // above includes 1e6 so that fold is sampled rather than read from a doc
    // comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(datasizePt.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // The half `assertLocaleContract` walks the alias list for, asserted from
    // the vocabulary's own side: a form recovered only by `portuguese`'s suffix
    // stripper reads back at a -2 penalty, by accident rather than by
    // declaration. Here every form is an alias `units.ts` already declared,
    // which is the whole reason this file adds no plural spellings.
    for (const [unit, words] of Object.entries(datasizePt.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Portuguese answers it with `one`, not with `other` — the
    // opposite of what English and Spanish do — so this is the sample that would
    // catch a table written with only the plural row filled in.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, and the singular reaches further than English's", () => {
    expect(word("mb", 1)).toBe("megabyte");
    expect(word("mb", 2)).toBe("megabytes");
    // The two counts a translator borrowing an English intuition gets wrong.
    // CLDR's Portuguese rule is `i = 0..1`, so the integer part decides: 0 and
    // 1,5 both take the singular ("0 megabyte", "1,5 megabyte"), where English
    // and Spanish both say "megabytes".
    expect(word("mb", 0)).toBe("megabyte");
    expect(word("mb", 1.5)).toBe("megabyte");
    // 21 is plural, which is where a rule copied from Ukrainian would break.
    expect(word("mb", 21)).toBe("megabytes");
    // A conversion target has no count at all, and R5 says every language must
    // still answer. Portuguese answers with the plural, which is how the target
    // of "2 gb em megabytes" is written.
    expect(word("mb", undefined, "conversion-target")).toBe("megabytes");
  });

  test("an engine built from it reads and writes Portuguese datasize", () => {
    // The decimal comma, read and written. "1.5" is not a Portuguese number —
    // the full stop is the *group* separator here — so writing the test with one
    // would exercise a different code path entirely. And the noun is singular
    // after it, which is the Portuguese rule this locale exists to get right.
    expect(engine.evaluate("1,5 kilobytes").formatted).toBe("1,5 kilobyte");
    // A sum landing on a fraction, which no integer count can reach.
    expect(engine.evaluate("1 kb + 500 b").formatted).toBe("1,5 kilobyte");
    // Conversions, with both prepositions the language lists under `in`.
    expect(engine.evaluate("2 gb em mb").formatted).toBe("2.000 megabytes");
    expect(engine.evaluate("2 gb para megabytes").formatted).toBe("2.000 megabytes");
    // The lusophone calque, in — and the borrowed word out, because a
    // Brazilian-default `pt` prints "bytes".
    expect(engine.evaluate("512 octetos").formatted).toBe("512 bytes");
    // The Portuguese-prefixed spelling, likewise read and not printed.
    expect(engine.evaluate("2 quilobytes").formatted).toBe("2 kilobytes");
    // The binary units are their own units, and the number proves it: a
    // gibibyte is 1024 mebibytes, not 1000.
    expect(engine.evaluate("1 gib em mib").formatted).toBe("1.024 mebibytes");
    // Singular, the one integer count that takes the `one` row on its own.
    expect(engine.evaluate("1 mb").formatted).toBe("1 megabyte");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1,5 kilobytes",
      "1 kb + 500 b",
      "2 gb em mb",
      "1 gib em mib",
      "512 octetos",
      "2 quilobytes",
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
