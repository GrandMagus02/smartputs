import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { speed } from "../index";
import speedHi from "./hi";

const hi = () => composeLocale(hindi, [speedHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [speed] });

/** The three units whose name is a compound Hindi cannot write as one token. */
const COMPOUNDS = ["mps", "kph", "mph"] as const;

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = hindi.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "speed",
    unit,
    slot,
  });
  return (speedHi.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts that
 * the tables agree with the list. Sweeping the counts that move a plural rule in
 * any language in this repo against all three slots is what shows the answer is
 * two keys on one axis, which is what makes `knot`'s table below two rows.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "speed", unit: "knot", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({ count: new Decimal(n), kind: "speed", unit: "knot", slot }),
      ),
    ]),
  ),
].sort();

describe("speed hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the words: the kind is ratios,
    // magnitude bands and one bridge signature naming its operand kinds by
    // string, so any character from a script no ratio could contain is the
    // failure.
    expect(JSON.stringify(speed)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    // The contract `knot`'s table keys off, asserted before anything indexes it.
    // Two, where Arabic has six and Ukrainian has eight on two axes —
    // `@smartput/core/locale/hi` rejected an oblique-case axis on purpose,
    // because the direct and oblique singular of a consonant-final masculine
    // loanword are the same word.
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("only `knot` declares written forms", () => {
    // The decision `en.ts` records, restated for Hindi: "किलोमीटर प्रति घंटा" is
    // three words and "किमी/घंटा" carries a slash, so neither lexes back as one
    // unit token and a forms table for either would be unreachable prose. The
    // renderer stays on the symbol because of it.
    for (const unit of COMPOUNDS) {
      expect(speedHi.units[unit]?.forms, `${unit} declares a form`).toBeUndefined();
    }
    expect(Object.keys(speedHi.units.knot?.forms ?? {}).sort()).toEqual(KEYS);
  });

  test("the three compounds leave the Devanagari head nouns to `length`", () => {
    // Not an omission. The alias index is one flat map with no kind in the key,
    // so claiming किलोमीटर for `kph` here would give "5 किलोमीटर" a second reading
    // in the `@smartput/kinds` barrel, where both kinds are installed. The bridge
    // the symbols re-read through is the path Hindi gets instead.
    for (const unit of COMPOUNDS) {
      for (const alias of speedHi.units[unit]?.aliases ?? []) {
        expect(alias, `${unit} claims a Devanagari head noun`).not.toMatch(
          /\p{Script=Devanagari}/u,
        );
      }
    }
    expect(speedHi.units.knot?.aliases).toContain("नॉट");
  });

  test("the compound symbols carry the slash, and `knot` does not", () => {
    // "/" is always division, which is what makes "100 किमी/घंटा" reach the
    // resolver as किमी ÷ घंटा and come back through `speed.ops`' `length ÷
    // duration` bridge. `knot` has no such escape and must be one token, because
    // no signature could compute a knot back out of anything.
    for (const unit of COMPOUNDS) {
      expect(speedHi.units[unit]?.symbol, `${unit} lost its slash`).toContain("/");
    }
    const knot = speedHi.units.knot?.symbol as string;
    expect(knot).not.toMatch(/[/*+\-·×⋅]/);
    expect(knot).not.toMatch(/\s/u);
    expect(speedHi.units.knot?.aliases).toContain(knot);
  });

  test("no half of a compound symbol is one of Hindi's own keywords", () => {
    // The bug this is the regression test for. `mps` shipped as "मी/से", which
    // is how a Hindi physics text abbreviates the metre per second — and से is
    // one of `hindi.keywords.in`. A keyword is claimed by `lex` at the token
    // level, so splitting at the slash is what *exposes* the half rather than
    // what protects it: "5 मी/से" reaches the parser as number, word, op,
    // keyword, and throws. mps is this kind's canonical unit, so that made every
    // Hindi speed the engine printed unreadable, its own output included.
    //
    // Asserted against `hindi.keywords` rather than against a list of the three
    // postpositions, so a keyword added to the language is caught here on the
    // same commit.
    const keywords = new Set(Object.values(hindi.keywords).flat());
    for (const [unit, words] of Object.entries(speedHi.units)) {
      for (const half of (words.symbol ?? "").split("/")) {
        expect(keywords.has(half), `${unit}'s symbol half "${half}" is a keyword`).toBe(
          false,
        );
      }
    }
  });

  test("every form it prints is a form it reads", () => {
    // The gap this closes is invisible to every other test here: a printed form
    // that is not a listed alias still round-trips, because `hindi`'s suffix
    // stripper recovers it — at `weight: -2`. A word the printer emits should
    // never come back through the penalised path.
    for (const [unit, words] of Object.entries(speedHi.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("every string in the file survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and Devanagari has a trap in it: ड़, ज़ and फ़ are Unicode composition
    // *exclusions*, so NFKC decomposes U+095C/U+095B/U+095E into a consonant plus
    // the nukta U+093C. A table written with a precomposed character tests green
    // against direct calls on this object and is unreachable through the engine.
    // नॉट's ॉ (U+0949) is an ordinary matra and not one of them; the assertion is
    // what stops a real nukta arriving precomposed.
    for (const [unit, words] of Object.entries(speedHi.units)) {
      for (const s of [
        ...words.aliases,
        words.symbol ?? "",
        ...Object.values(words.forms ?? {}),
      ]) {
        expect(s.normalize("NFKC"), `${unit} carries a non-NFKC string`).toBe(s);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(hi(), [speed])).not.toThrow();
    // Run again with fractions in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction below
    // 1 as well, so 0.5 and 1.5 land on opposite rows and neither is reached by
    // an integer sweep at all.
    expect(() =>
      assertLocaleContract(hi(), [speed], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("the plural boundary is not English's", () => {
    // Hindi's `one` is `i = 0 or n = 1`. Zero is singular here and plural in
    // English, and every fraction below one is singular too. नॉट spells both rows
    // alike, because a Hindi measure noun stays in the direct singular after a
    // numeral — which is exactly why the boundary is stated against the language
    // rather than left to the formatter.
    const key = (n: number) =>
      hindi.selectForm({
        count: new Decimal(n),
        kind: "speed",
        unit: "knot",
        slot: "bare",
      });
    expect([key(0), key(0.5), key(1), key(1.5)]).toEqual(["one", "one", "one", "other"]);
    expect(word("knot", 0)).toBe("नॉट");
    expect(word("knot", 1.5)).toBe("नॉट");
    // The slot is inert too: Hindi's axis is the count alone, and a count-free
    // conversion target (ruling R5) lands on `other`.
    for (const count of [0, 1, 5, undefined]) {
      expect(word("knot", count, "conversion-target")).toBe(
        word("knot", count, "bare") as string,
      );
    }
    expect(word("knot", undefined)).toBe("नॉट");
  });

  test("an engine built from it reads and writes Hindi speed", () => {
    const e = engine();
    expect(e.evaluate("5 नॉट").formatted).toBe("5 नॉट");
    expect(e.evaluate("1.5 नॉट").formatted).toBe("1.5 नॉट");
    // Zero and a half take the same word, which is the whole of Hindi's plural
    // for a measure noun.
    expect(e.evaluate("0 नॉट").formatted).toBe("0 नॉट");
    expect(e.evaluate("0.5 नॉट").formatted).toBe("0.5 नॉट");
    // A conversion into a compound, written with each of the three postpositions
    // `hindi` claims under `in`. The symbol comes back with a space before it —
    // `hindi.renderQuantity` sets a Devanagari symbol off from the number where
    // English sets "18.52kph" tight.
    expect(e.evaluate("10 नॉट में kph").formatted).toBe("18.52 किमी/घंटा");
    expect(e.evaluate("10 नॉट को kph").formatted).toBe("18.52 किमी/घंटा");
    expect(e.evaluate("10 नॉट से kph").formatted).toBe("18.52 किमी/घंटा");
    // And back the other way, into the one unit that prints as a word.
    expect(e.evaluate("37.04 kph में नॉट").formatted).toBe("20 नॉट");
    // A sum, written with the arithmetic noun जोड़, which Hindi reads infix ("दस
    // जोड़ पाँच") even though a full sentence puts the operator last.
    expect(e.evaluate("10 नॉट जोड़ 10 नॉट").formatted).toBe("20 नॉट");
    // A cardinal read through `hindi.numerals`.
    expect(e.evaluate("पाँच नॉट").formatted).toBe("5 नॉट");
    // Latin in, Devanagari out: a Hindi developer types "mps" and "kmh", and the
    // aliases derive from the one alias map in `units.ts`.
    expect(e.evaluate("3 mps").formatted).toBe("3 मी/सेकंड");
    expect(e.evaluate("100 kph").formatted).toBe("100 किमी/घंटा");
    expect(e.evaluate("60 mph").formatted).toBe("60 मील/घंटा");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("2000 kph").formatted).toBe("2,000 किमी/घंटा");
    expect(new Intl.NumberFormat("hi").format(200_000)).toBe("2,00,000");
    // What the gap does *not* break is the round trip: `parseNumber` removes
    // every occurrence of the group character wherever it falls and never counts
    // digits between them, so the reader is grouping-agnostic and accepts the
    // Indian form the writer cannot yet produce.
    expect(engine().evaluate("2,00,000 नॉट").formatted).toBe("200,000 नॉट");
  });

  test("what it prints, it reads back", () => {
    // `knot` only. The other three print on a symbol carrying "/", which is an
    // operator character the lexer will not take back inside a unit word — that
    // compound needs `@smartput/length`'s Hindi vocabulary installed beside
    // `@smartput/duration`'s to compute, which an engine of one kind by
    // construction does not have. The printing is asserted above as text; the
    // reading-back is `@smartput/kinds`' `zz-hi-verify.test.ts`, where every kind
    // is installed — and it is not a formality. That test is what caught mps
    // shipping as "मी/से", where the denominator was one of `hindi`'s own `in`
    // keywords and the whole symbol was unreadable; nothing in this file could
    // see it, because nothing in this file can read a compound at all.
    const e = engine();
    for (const input of [
      "5 नॉट",
      "1.5 नॉट",
      "0.5 नॉट",
      "0 नॉट",
      "37.04 kph में नॉट",
      "10 नॉट जोड़ 10 नॉट",
      "पाँच नॉट",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
    // And the compounds are the ones that do not, stated rather than left as a
    // silent omission from the list above: the failure is `Unknown unit "किमी"`,
    // because किमी is `@smartput/length`'s word and not this kind's.
    expect(() => e.evaluate(e.evaluate("100 kph").formatted)).toThrow();
  });
});
