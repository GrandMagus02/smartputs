import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaHi from "./hi";

const hi = () => composeLocale(hindi, [areaHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [area] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
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
      hindi.selectForm({ kind: "area", unit: "hectare", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "area", unit: "hectare", slot }),
      ),
    ]),
  ),
].sort();

/** The units that have a spelled Hindi noun at all. See `hi.ts` on the rest. */
const SPELLED = ["hectare", "acre"];

describe("area hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the two nouns: the kind is ratios,
    // unit ids, magnitude bands and the `length * length` signature, so any
    // character from a script no ratio could contain is the failure.
    expect(JSON.stringify(area)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("every unit that has forms carries exactly that key set", () => {
    // The squared three carry none at all, and that is the assertion rather than
    // an exemption: "वर्ग मीटर" is two words, `lex` ends a word token at the
    // space, and the printer's spelled path only ever emits what the parser can
    // read back. They render through their symbol.
    for (const [unit, words] of Object.entries(areaHi.units)) {
      const keys = Object.keys(words.forms ?? {}).sort();
      expect(keys, unit).toEqual(SPELLED.includes(unit) ? KEYS : []);
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `hindi`'s suffix
  // stripper recovers it — at `weight: -2`. The trap here is एकड़: the stripper
  // knows ों and would quietly cover a printed एकड़ों while leaving the
  // nukta-less एकड unreachable, so the containment below is what proves each
  // printed word is reached by an exact hit and not a guess.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(areaHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("both spellings of each superscript symbol are listed", () => {
    // `normalize()` runs NFKC, which folds ² to a plain 2 before the lexer sees
    // it, while `assertLocaleContract` looks the *symbol* up in the alias index
    // unfolded. One spelling would fail one of the two paths, and the failure is
    // silent in whichever path is not being tested at the time.
    for (const unit of ["m2", "cm2", "km2"]) {
      const words = areaHi.units[unit as keyof typeof areaHi.units];
      const symbol = words?.symbol as string;
      expect(words?.aliases, unit).toContain(symbol);
      expect(words?.aliases, unit).toContain(symbol.normalize("NFKC"));
      expect(symbol.normalize("NFKC")).not.toBe(symbol);
    }
  });

  test("every Devanagari string in the file survives NFKC unchanged", () => {
    // ड़ and ज़ are Unicode composition *exclusions*: NFKC decomposes U+095C and
    // U+095B into a consonant plus the nukta U+093C, and `normalize()` NFKC-folds
    // the input before a word ever reaches the alias index. एकड़ below is written
    // in the decomposed form for exactly that reason; a precomposed spelling
    // would test green against this object and be unreachable through the engine.
    //
    // The superscript symbols are the deliberate exception and are excluded by
    // the same NFKC test that catches the nukta — see the assertion above, which
    // requires both spellings of each rather than one stable one.
    for (const [unit, words] of Object.entries(areaHi.units)) {
      const strings = [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ].filter((s) => !/[²³]/u.test(s));
      for (const s of strings) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
    // Said positively as well, so the nukta is asserted to be *there* and not
    // merely to be stable: एकड़ is एकड + U+093C, four code points, not three.
    expect([...(areaHi.units.acre?.symbol ?? "")].map((c) => c.codePointAt(0))).toEqual([
      0x90f, 0x915, 0x921, 0x93c,
    ]);
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [area])).not.toThrow();
    // Run again with a fraction in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, so 0.5 and 1.5 land on opposite
    // rows and neither is reached by an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [area], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("both rows hold one word, because a Hindi measure noun does not count", () => {
    // Not a half-finished table: "पाँच एकड़" is five acres and "पाँच एकड़ें" is
    // not Hindi. The numeral carries the count and the noun does not repeat it.
    // Both spelled units here are consonant-final masculines, which is the
    // shape that makes the direct singular and the direct plural one word.
    for (const unit of SPELLED) {
      expect(word(unit, 1), unit).toBe(word(unit, 5) as string);
    }
    expect(word("acre", 5)).toBe("एकड़");
    expect(word("hectare", 1)).toBe("हेक्टेयर");
  });

  test("the slot is inert: Hindi's axis is the count alone", () => {
    // Ukrainian's conversion target is locative; Hindi's is the same word as
    // everywhere else, because the postposition governs an oblique the singular
    // does not mark. Asserted so a later reader who adds a slot axis has to
    // delete a test that says why there isn't one.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("hectare", count, "conversion-target")).toBe(
        word("hectare", count, "bare") as string,
      );
    }
    // And the count-free target (ruling R5) lands on `other`.
    expect(word("hectare", undefined)).toBe("हेक्टेयर");
  });

  test("an engine built from it reads and writes Hindi area", () => {
    const e = engine();
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question — "एक
    // हेक्टेयर में कितने वर्ग मीटर".
    expect(e.evaluate("1 हेक्टेयर में मी²").formatted).toBe("10,000 मी²");
    expect(e.evaluate("1 किमी² को हेक्टेयर").formatted).toBe("100 हेक्टेयर");
    expect(e.evaluate("1 एकड़ से मी²").formatted).toBe("4,046.8564 मी²");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. 1.5 is `other`, and on a Hindi measure noun `other` is
    // the same word `one` is — which is the point, not an omission.
    expect(e.evaluate("1 हेक्टेयर जोड़ 5000 मी²").formatted).toBe("1.5 हेक्टेयर");
    expect(e.evaluate("0.5 हेक्टेयर").formatted).toBe("0.5 हेक्टेयर");
    // The plain-digit spelling of a superscript symbol, which is what NFKC hands
    // the lexer anyway, and the solid compound a reader may write instead of the
    // spaced "वर्ग मीटर" that `lex` would split in two.
    expect(e.evaluate("10000 मी2").formatted).toBe("10,000 मी²");
    expect(e.evaluate("2 वर्गमीटर").formatted).toBe("2 मी²");
    // The oblique plural, read by `hindi`'s stripper rather than listed here,
    // and the nukta-less spelling, which no normalization would ever join to the
    // nukta-bearing one and so is listed.
    expect(e.evaluate("1 एकड़ों में मी²").formatted).toBe("4,046.8564 मी²");
    expect(e.evaluate("5 एकड").formatted).toBe("5 एकड़");
    // A cardinal read through `hindi.numerals`.
    expect(e.evaluate("पाँच हेक्टेयर").formatted).toBe("5 हेक्टेयर");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("2 ha").formatted).toBe("2 हेक्टेयर");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own, and
    // area is where it is reached first: a square kilometre is a million square
    // metres. `Intl.NumberFormat("hi")` groups by lakh and crore — the first
    // group from the right is three digits and every group after it is two —
    // while `formatNumber` inserts the separator with a fixed period of three,
    // because `NumberFormatSpec` carries a separator character and no grouping
    // *rule*.
    expect(engine().evaluate("1 किमी² को मी²").formatted).toBe("1,000,000 मी²");
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip: `parseNumber` removes
    // every occurrence of the group character wherever it falls and never counts
    // digits between them, so the reader is grouping-agnostic and accepts the
    // Indian form the writer cannot yet produce. The day core learns about
    // grouping periods, the first assertion above fails and this one is already
    // its regression test.
    expect(engine().evaluate("10,00,000 मी²").formatted).toBe("1,000,000 मी²");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "1 हेक्टेयर जोड़ 5000 मी²",
      "1 हेक्टेयर में मी²",
      "1 किमी² को मी²",
      "1 एकड़ से मी²",
      "5 एकड",
      "0.5 हेक्टेयर",
      "2 वर्गमीटर",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
    }
  });
});
