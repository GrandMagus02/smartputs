import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeDe from "./de";

const locale = () => composeLocale(german, [datasizeDe]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** Every key `german.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({
          count: new Decimal(count),
          kind: "datasize",
          unit: "b",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({ kind: "datasize", unit: "b", slot }),
      ),
    ),
);

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "datasize",
    unit,
    slot,
  });
  return (datasizeDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("datasize de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex, and
  // German cannot borrow it: this kind's words *are* the English ones, so a
  // word-list check would fail on `units.ts` itself. What German has instead is
  // orthography. Every German noun is capitalised and every SI/IEC symbol has a
  // capital in it, so the two columns this file actually contributes — the
  // printed capitalisation and the symbol casing — are exactly the strings a
  // capital-letter sweep finds, and the kind (ratios, unit ids and magnitude
  // bands) has no capital anywhere in it.
  test("the kind itself carries no German word", () => {
    const descriptor = JSON.stringify(datasize);
    expect(descriptor).not.toMatch(/\p{Lu}/u);
    for (const [unit, words] of Object.entries(datasizeDe.units)) {
      expect(descriptor, `the kind mentions ${unit}'s symbol`).not.toContain(
        words.symbol as string,
      );
      for (const form of Object.values(words.forms ?? {})) {
        expect(descriptor, `the kind mentions "${form}"`).not.toContain(form);
      }
    }
  });

  test("every unit carries exactly the four keys `german` can ask for", () => {
    // The contract the language author pinned: case from the slot (a conversion
    // target is dative, everything else nominative) crossed with the two
    // categories `Intl.PluralRules("de")` declares. A count-free target lands on
    // `dat-other` (ruling R5), which is why the sweep above includes the
    // countless call. Rule 6 wants exactly this set — no more, no fewer.
    expect([...KEYS].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
    for (const [unit, words] of Object.entries(datasizeDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}'s keys`).toEqual(
        [...KEYS].sort(),
      );
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives.
    for (const [unit, words] of Object.entries(datasizeDe.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
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
    // The default counts are all integers, so they never reach the category a
    // fraction takes. German folds that into `other`, which is the claim worth
    // sampling rather than assuming: if `selectForm` ever grows a third CLDR
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the number axis is inert and the case axis is not", () => {
    // The German rule stated as four assertions rather than as a paragraph:
    // `Byte` is a neuter measure noun, so a numeral leaves it in the singular
    // and three of the four rows are the same string. The fourth is the dative
    // plural, where the loanword's `-s` finally shows — and it is what stops the
    // three-way equality above from being a table that stopped halfway.
    expect(word("b", 1)).toBe("Byte");
    expect(word("b", 512)).toBe("Byte");
    expect(word("b", 1.5)).toBe("Byte");
    expect(word("b", 1, "conversion-target")).toBe("Byte");
    expect(word("b", 512, "conversion-target")).toBe("Bytes");
    // The row no one-dimensional plural model can express at all: a conversion
    // target has no magnitude to agree with (ruling R5), and "in Bytes" is what
    // German writes for it.
    expect(word("b", undefined, "conversion-target")).toBe("Bytes");
    // The same shape one prefix up, so the claim is about the noun and not about
    // one lucky row.
    expect(word("mb", 500)).toBe("Megabyte");
    expect(word("mb", undefined, "conversion-target")).toBe("Megabytes");
  });

  test("an engine built from it reads and writes German datasize", () => {
    // A word wins over the symbol in `renderQuantity`, so these are spaced;
    // `symbols: true` is what reaches "512 B".
    expect(engine.evaluate("512 Byte").formatted).toBe("512 Byte");
    expect(engine.evaluate("1 byte").formatted).toBe("1 Byte");
    // Case-folding, both directions: the alias index lowercases, so the capital
    // a German writes and the lowercase a search box gets are one key.
    expect(engine.evaluate("5 KILOBYTE").formatted).toBe("5 Kilobyte");
    // A conversion, with each of the three prepositions the language lists under
    // `in`. The group separator is a full stop — the exact inverse of English —
    // so "1.000" is a thousand bytes and not one.
    expect(engine.evaluate("1 kb in Byte").formatted).toBe("1.000 Byte");
    expect(engine.evaluate("1 kb nach Byte").formatted).toBe("1.000 Byte");
    // The binary family stays a separate unit, never a second name for the
    // decimal one: 1 KiB is 1024 bytes and 1 kB is 1000.
    expect(engine.evaluate("1 kib zu Byte").formatted).toBe("1.024 Byte");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is fifteen hundred in German, so a
    // test spelled with a full stop would be exercising the group separator.
    expect(engine.evaluate("1 mb + 500 kb").formatted).toBe("1,5 Megabyte");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "512 Byte",
      "1 mb + 500 kb",
      "1 kb in Byte",
      "1,5 Gigabyte",
      "2 Kibibyte",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
