import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeNl from "./nl";

const locale = () => composeLocale(dutch, [datasizeNl]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "datasize",
    unit,
    slot,
  });
  return (datasizeNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `dutch.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    dutch.selectForm({ kind: "datasize", unit: "mb", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "datasize",
        unit: "mb",
        slot,
      }),
    ),
  ]),
);

describe("datasize nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Dutch
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute (every German noun carries a capital, so a stray one shows up as
  // one) does not transfer either, because Dutch capitalises no noun. So the
  // words are the check. The nine Dutch nouns are English's nine, so what this
  // asserts is that the *kind* names none of them: it is ratios, unit ids,
  // magnitude bands and bridge signatures naming their operands by id string,
  // and "kilobyte" is bound in `units.ts` as an alias, which is the other half.
  test("the kind itself carries no Dutch word", () => {
    const descriptor = JSON.stringify(datasize);
    for (const word_ of ["byte", "kilobyte", "megabyte", "gigabyte", "kibibyte"]) {
      expect(descriptor, `the kind mentions "${word_}"`).not.toMatch(
        new RegExp(`\\b${word_}s?\\b`, "i"),
      );
    }
  });

  test("`dutch` asks for exactly two keys, and every unit fills exactly those", () => {
    // The contract the language author pinned: one axis, the CLDR plural
    // category, and nothing else. `slot` is read and discarded, because modern
    // Dutch has no case marking left on common nouns — "in megabyte" governs the
    // same word "megabyte" does standing alone — so the four-key table `de.ts`
    // needs collapses to English's two. The sweep includes a count-free call
    // because a conversion target has no magnitude to agree with and must still
    // answer (R5); Dutch answers `other`. 1e6 is in it so CLDR's `many`, if this
    // locale ever declared one, would show up here rather than at a user.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(datasizeNl.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it, so the SI capital
    // in "MB" meets the derived lowercase "mb" and a symbol never has to be
    // listed twice. What this catches is the other thing — a printed word
    // reachable only through `dutch`'s suffix stripper, at its −2 penalty, so by
    // accident rather than by declaration.
    for (const [unit, words] of Object.entries(datasizeNl.units)) {
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
    // fraction takes. Dutch folds it into `other`, the row 0 and 5 take — but
    // that is `selectForm`'s decision, not arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows hold one word, because Dutch does not count measures", () => {
    // The Taalunie's rule for maten en gewichten: a unit of measure stays
    // singular after a numeral. So both rows are "megabyte" — deliberately, and
    // not because the table was left half-written. `@smartput/duration`'s Dutch
    // file is the control that keeps this from being vacuous: *uur* behaves like
    // this and *dag*/*week* do not, so the axis is live in the language even
    // where it is inert in this kind.
    expect(word("mb", 1)).toBe("megabyte");
    expect(word("mb", 2)).toBe("megabyte");
    expect(word("mb", 512)).toBe("megabyte");
    expect(word("mb", 1.5)).toBe("megabyte");
    // A conversion target carries no count and every language must still answer
    // (R5). Dutch answers `other`, and the slot changes nothing, which is the
    // whole substance of the one-axis contract.
    expect(word("b", undefined, "conversion-target")).toBe("byte");
    expect(word("b", 5, "conversion-target")).toBe(word("b", 5));
  });

  test("an engine built from it reads and writes Dutch datasize", () => {
    // The invariant measure noun, on both sides of the plural boundary.
    expect(engine.evaluate("1 byte").formatted).toBe("1 byte");
    expect(engine.evaluate("512 byte").formatted).toBe("512 byte");
    // The English `-s` plural still reads, and is answered with the Dutch
    // invariant: recognition is many-to-one, generation stays one.
    expect(engine.evaluate("512 bytes").formatted).toBe("512 byte");
    expect(engine.evaluate("5 megabyte").formatted).toBe("5 megabyte");
    // Conversions, with both prepositions the language lists under `in`. The
    // group separator is a full stop — the inverse of English — so "2.000" is
    // two thousand megabytes and not two of them.
    expect(engine.evaluate("2 gb in megabyte").formatted).toBe("2.000 megabyte");
    expect(engine.evaluate("2 gb naar megabyte").formatted).toBe("2.000 megabyte");
    // The decimal/binary contrast, which is why `k` and `Ki` are two symbols and
    // not two spellings of one.
    expect(engine.evaluate("1 kib in byte").formatted).toBe("1.024 byte");
    expect(engine.evaluate("1 kb in byte").formatted).toBe("1.000 byte");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Dutch, so a
    // test written with a full stop would be exercising the group separator.
    expect(engine.evaluate("1 mb + 500 kb").formatted).toBe("1,5 megabyte");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "512 byte",
      "5 megabyte",
      "1 mb + 500 kb",
      "2 gb in megabyte",
      "1 kib in byte",
      "2000 kb",
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
