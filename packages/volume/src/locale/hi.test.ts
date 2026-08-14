import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { volume } from "../index";
import volumeHi from "./hi";

const hi = () => composeLocale(hindi, [volumeHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [volume] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "volume",
    unit,
    slot,
  });
  return (volumeHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts the
 * tables agree with the list. Sweeping the counts that move a plural rule in any
 * language in this repo against all three slots is what shows the answer is two
 * keys on one axis.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "volume", unit: "l", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "volume", unit: "l", slot }),
      ),
    ]),
  ),
].sort();

/** The units that have a spelled Hindi noun at all. See `hi.ts` on `m3`. */
const SPELLED = ["l", "ml", "gal", "pint"];

describe("volume hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the four nouns: the kind is ratios,
    // unit ids, magnitude bands and the `area * length` signature, so any
    // character from a script no ratio could contain is the failure.
    expect(JSON.stringify(volume)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("every unit that has forms carries exactly that key set", () => {
    // `m3` carries none at all, and that is the assertion rather than an
    // exemption: "घन मीटर" is two words, `lex` ends a word token at the space,
    // and the printer's spelled path only ever emits what the parser can read
    // back. It renders through मी³.
    for (const [unit, words] of Object.entries(volumeHi.units)) {
      const keys = Object.keys(words.forms ?? {}).sort();
      expect(keys, unit).toEqual(SPELLED.includes(unit) ? KEYS : []);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `hindi`'s suffix
  // stripper recovers it — at `weight: -2`. The stripper knows ों and would
  // quietly cover a printed लीटरों while leaving the matra-level variants
  // (मिलिलीटर, पिंट) unreachable, so the containment below is what proves each
  // printed word is reached by an exact hit and not a guess.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(volumeHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("both spellings of the cubic symbol are listed", () => {
    // `normalize()` runs NFKC, which folds ³ to a plain 3 before the lexer sees
    // it, while `assertLocaleContract` looks the *symbol* up in the alias index
    // unfolded. One spelling would fail one of the two paths, and the failure is
    // silent in whichever path is not being tested at the time.
    const symbol = volumeHi.units.m3?.symbol as string;
    expect(volumeHi.units.m3?.aliases).toContain(symbol);
    expect(volumeHi.units.m3?.aliases).toContain(symbol.normalize("NFKC"));
    expect(symbol.normalize("NFKC")).not.toBe(symbol);
  });

  test("every Devanagari string in the file survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and Devanagari has two traps in it: ड़ and ज़ are Unicode composition
    // *exclusions*, so NFKC decomposes U+095C/U+095B into a consonant plus the
    // nukta U+093C. A table written with the precomposed characters tests green
    // against this object and is unreachable through the engine. Volume has no
    // nukta today; the assertion is here so the day one arrives it is caught in
    // this package rather than in core's. The superscript symbol is the
    // deliberate exception, and is covered by the assertion above instead.
    for (const [unit, words] of Object.entries(volumeHi.units)) {
      const strings = [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ].filter((s) => !/[²³]/u.test(s));
      for (const s of strings) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [volume])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, so 0.5 and 1.5 land on opposite
    // rows and neither is reached by an integer sweep at all. Half a litre is
    // the commonest volume anyone writes, so the row is not a corner case.
    expect(() =>
      assertLocaleContract(hi(), [volume], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("both rows hold one word, because a Hindi measure noun does not count", () => {
    // Not a half-finished table: "पाँच लीटर" is five litres and "पाँच लीटरें" is
    // not Hindi. The numeral carries the count and the noun does not repeat it.
    // Every unit named here is a consonant-final masculine borrowing, which is
    // the shape that makes the direct singular and the direct plural one word.
    for (const unit of SPELLED) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("l", 5)).toBe("लीटर");
    expect(word("pint", 1)).toBe("पाइंट");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("l", count, "conversion-target")).toBe(
        word("l", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("l", undefined)).toBe("लीटर");
  });

  test("an engine built from it reads and writes Hindi volume", () => {
    const e = engine();
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // लीटर में कितने मिलीलीटर".
    expect(e.evaluate("1 लीटर में मिलीलीटर").formatted).toBe("1,000 मिलीलीटर");
    expect(e.evaluate("1 मी³ को लीटर").formatted).toBe("1,000 लीटर");
    expect(e.evaluate("1 गैलन से लीटर").formatted).toBe("3.785411784 लीटर");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and on a Hindi measure noun `other` is
    // the same word `one` is — which is the point, not an omission.
    expect(e.evaluate("1 लीटर जोड़ 500 मिली").formatted).toBe("1.5 लीटर");
    // Half a litre: Hindi's singular row, where English would print a plural.
    expect(e.evaluate("0.5 लीटर").formatted).toBe("0.5 लीटर");
    // The solid compound a reader may write instead of the spaced "घन मीटर" that
    // `lex` would split in two.
    expect(e.evaluate("2 घनमीटर").formatted).toBe("2 मी³");
    // The oblique plural, read by `hindi`'s stripper rather than listed here.
    expect(e.evaluate("2 लीटरों में मिली").formatted).toBe("2,000 मिलीलीटर");
    // The imperial pair, and a cardinal read through `hindi.numerals`.
    expect(e.evaluate("1 गैलन को पाइंट").formatted).toBe("8 पाइंट");
    expect(e.evaluate("पाँच लीटर").formatted).toBe("5 लीटर");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("2 l").formatted).toBe("2 लीटर");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own, and
    // volume reaches it on the first conversion anyone tries: a cubic metre is a
    // million millilitres. `Intl.NumberFormat("hi")` groups by lakh and crore —
    // the first group from the right is three digits and every group after it is
    // two — while `formatNumber` inserts the separator with a fixed period of
    // three, because `NumberFormatSpec` carries a separator character and no
    // grouping *rule*.
    expect(engine().evaluate("1 मी³ को मिलीलीटर").formatted).toBe("1,000,000 मिलीलीटर");
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip: `parseNumber` removes
    // every occurrence of the group character wherever it falls and never counts
    // digits between them, so the reader is grouping-agnostic and accepts the
    // Indian form the writer cannot yet produce. The day core learns about
    // grouping periods, the first assertion above fails and this one is already
    // its regression test.
    expect(engine().evaluate("10,00,000 मिलीलीटर").formatted).toBe("1,000,000 मिलीलीटर");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 लीटर जोड़ 500 मिली",
      "1 लीटर में मिलीलीटर",
      "1 मी³ को मिलीलीटर",
      "1 गैलन से लीटर",
      "0.5 लीटर",
      "2 घनमीटर",
      "5 पाइंट",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
