import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { hindi } from "@smartput/core/locale/hi";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "@smartput/datasize";
import datasizeHi from "@smartput/datasize/locale/hi";
import { duration } from "@smartput/duration";
import durationHi from "@smartput/duration/locale/hi";
import { datarate } from "../index";
import datarateHi from "./hi";

const hi = () => composeLocale(hindi, [datarateHi]);
const engine = () => createEngine({ locales: [hi()], kinds: [datarate] });

/**
 * Every key `hindi.selectForm` can return, derived rather than transcribed.
 *
 * Rule 6 says a `forms` table's keys must be exactly the set `selectForm` can
 * produce — no more, no fewer — and a list written out by hand only asserts that
 * the tables agree with the list. Sweeping the counts that move a plural rule in
 * any language in this repo against all three slots is what shows the answer is
 * two keys on one axis. This kind declares no `forms` at all, which is only a
 * defensible absence if the thing being declined is understood, so the sweep
 * runs here too.
 */
const KEYS = [
  ...new Set(
    ["bare", "after-number", "conversion-target"].flatMap((slot) => [
      hindi.selectForm({ kind: "datarate", unit: "mbps", slot }),
      ...[0, 1, 2, 3, 5, 11, 21, 100, 1000, 100_000, 0.5, 1.5].map((n) =>
        hindi.selectForm({
          count: new Decimal(n),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    ]),
  ),
].sort();

describe("datarate hi vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateHi.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateHi.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Hindi word", () => {
    // The Devanagari block, not a list of the five nouns: the kind is ratios,
    // unit ids, magnitude bands and four bridge signatures naming their operand
    // kinds by string, so any character from a script no ratio could contain is
    // the failure.
    expect(JSON.stringify(datarate)).not.toMatch(/\p{Script=Devanagari}/u);
  });

  test("selectForm produces exactly two CLDR categories, on one axis", () => {
    expect(KEYS).toEqual(["one", "other"]);
  });

  test("no unit declares a written form", () => {
    // The ruling `en.ts` records, restated for Hindi: "मेगाबिट प्रति सेकंड" is
    // three words and `lex` ends a word token at the space, so there is no single
    // Hindi token meaning "megabits per second" to put in a table. Every unit
    // therefore carries the empty key set, which is `KEYS` minus every row.
    for (const [unit, words] of Object.entries(datarateHi.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
      for (const key of KEYS) {
        expect(words.forms?.[key], `${unit} answers ${key}`).toBeUndefined();
      }
    }
  });

  test("every symbol is an alias of the unit that prints it", () => {
    // The mechanism behind every round trip below, asserted directly rather than
    // inferred from one. This kind's symbols re-read *because they are aliases*
    // of the unit that prints them — the only route open to it. `speed:mps` and
    // `energy:kwh` re-read their compound symbols the other way, as arithmetic
    // over their operand kinds, and that needs a registered signature: dividing a
    // datarate by a duration is not a datarate and no such signature exists. So
    // if a later edit reaches for the orthographically fuller "मेगाबिट/से", this
    // fails first and names the cause.
    for (const [unit, words] of Object.entries(datarateHi.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character, so it cannot lex as one token`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(symbol, `${unit}'s symbol "${symbol}" is more than one token`).not.toMatch(
        /\s/u,
      );
      expect(
        words.aliases,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol);
    }
  });

  test("every string in the file survives NFKC unchanged", () => {
    // `normalize()` NFKC-folds the input before a word reaches the alias index,
    // and Devanagari has a trap in it: ड़, ज़ and फ़ are Unicode composition
    // *exclusions*, so NFKC decomposes U+095C/U+095B/U+095E into a consonant plus
    // the nukta U+093C. A table written with a precomposed character tests green
    // against direct calls on this object and is unreachable through the engine.
    // Nothing here carries a nukta today; the assertion is what stops one
    // arriving precomposed.
    for (const [unit, words] of Object.entries(datarateHi.units)) {
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
    expect(() => assertLocaleContract(hi(), [datarate])).not.toThrow();
    // Run again with fractions in the counts. The default counts are all
    // integers, and Hindi is a language where that genuinely leaves a row
    // unsampled: its `one` is `i = 0 or n = 1`, which covers every fraction below
    // 1 as well, so 0.5 and 1.5 land on opposite rows and neither is reached by
    // an integer sweep at all. This kind declares no forms for either to select,
    // so the second call proves the *absence* is uniform rather than merely
    // untested — a unit that grew a partial `forms` table would fail here and
    // nowhere else.
    expect(() =>
      assertLocaleContract(hi(), [datarate], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 0.5, 1.5],
      }),
    ).not.toThrow();
  });

  test("the plural boundary is not English's", () => {
    // Hindi's `one` is `i = 0 or n = 1`. Zero is singular here and plural in
    // English, and every fraction below one is singular too. Pinned against this
    // kind even though it prints one symbol either way, because the absence above
    // is only safe while it is total: the day a unit here grows a `forms` table
    // ported from `en` by translating two strings in place, this is the row it
    // gets wrong.
    const key = (n: number) =>
      hindi.selectForm({
        count: new Decimal(n),
        kind: "datarate",
        unit: "mbps",
        slot: "bare",
      });
    expect(key(0)).toBe("one");
    expect(key(0.5)).toBe("one");
    expect(key(1)).toBe("one");
    expect(key(1.5)).toBe("other");
    // Ruling R5: a count-free conversion target answers CLDR's generic category.
    expect(hindi.selectForm({ kind: "datarate", unit: "mbps", slot: "bare" })).toBe(
      "other",
    );
  });

  test("an engine built from it reads and writes Hindi datarate", () => {
    const e = engine();
    // The plain quantity, with a space between number and symbol:
    // `hindi.renderQuantity` sets a Devanagari symbol off from the number where
    // the default template sets it tight, branching on the script of the symbol.
    expect(e.evaluate("100 एमबीपीएस").formatted).toBe("100 एमबीपीएस");
    expect(e.evaluate("1.5 एमबीपीएस").formatted).toBe("1.5 एमबीपीएस");
    // A sum that lands on a fraction, written with the arithmetic noun जोड़,
    // which Hindi reads infix ("दस जोड़ पाँच") even though a full sentence puts
    // the operator last. Only the number can move here — there is no word to
    // agree with it, which is the visible consequence of declaring no forms.
    expect(e.evaluate("1 जीबीपीएस जोड़ 500 एमबीपीएस").formatted).toBe("1.5 जीबीपीएस");
    // A conversion, written with each of the three postpositions `hindi` claims
    // under `in`. में is how a Hindi speaker actually asks the question.
    expect(e.evaluate("2 जीबीपीएस में एमबीपीएस").formatted).toBe("2,000 एमबीपीएस");
    expect(e.evaluate("2 जीबीपीएस को एमबीपीएस").formatted).toBe("2,000 एमबीपीएस");
    expect(e.evaluate("2 जीबीपीएस से एमबीपीएस").formatted).toBe("2,000 एमबीपीएस");
    // Zero, which is Hindi's singular row where English would use its plural.
    expect(e.evaluate("0 एमबीपीएस").formatted).toBe("0 एमबीपीएस");
    // The bare noun is read and the initialism is printed: recognition is
    // many-to-one while generation stays the one symbol.
    expect(e.evaluate("8 मेगाबिट").formatted).toBe("8 एमबीपीएस");
    expect(e.evaluate("100 बिट्स").formatted).toBe("100 बीपीएस");
    expect(e.evaluate("4 गिगाबिट").formatted).toBe("4 जीबीपीएस");
    // A cardinal read through `hindi.numerals`, including लाख — the scale English
    // has no word for, and the reason `hi-cardinals.ts` is not a translation of
    // `en`'s table.
    expect(e.evaluate("दस एमबीपीएस").formatted).toBe("10 एमबीपीएस");
    expect(e.evaluate("एक लाख बीपीएस को केबीपीएस").formatted).toBe("100 केबीपीएस");
    // Both scripts read: a Hindi engine still takes the Latin aliases the one
    // alias map in `units.ts` declares, and prints them back in Devanagari.
    expect(e.evaluate("5 mbps").formatted).toBe("5 एमबीपीएस");
  });

  test("the grouping is core's, not Hindi's — and it is a recorded gap", () => {
    // The one thing about Hindi this package cannot get right on its own.
    // `Intl.NumberFormat("hi")` groups by lakh and crore: the first group from
    // the right is three digits and every group after it is two. `formatNumber`
    // inserts the separator with a fixed period of three, and `NumberFormatSpec`
    // carries a separator character and no grouping *rule*, so a Hindi engine
    // prints the first of these where a Hindi page writes the second.
    expect(engine().evaluate("1 टीबीपीएस को एमबीपीएस").formatted).toBe(
      "1,000,000 एमबीपीएस",
    );
    expect(new Intl.NumberFormat("hi").format(1_000_000)).toBe("10,00,000");
    // What the gap does *not* break is the round trip, which is the property
    // everything else rests on: `parseNumber` removes every occurrence of the
    // group character wherever it falls and never counts digits between them, so
    // the reader is grouping-agnostic and accepts the Indian form the writer
    // cannot yet produce. The day core learns about grouping periods, the first
    // assertion above fails and this one is already its regression test.
    expect(engine().evaluate("10,00,000 एमबीपीएस").formatted).toBe("1,000,000 एमबीपीएस");
  });

  test("what it prints, it reads back", () => {
    const e = engine();
    for (const input of [
      "100 एमबीपीएस",
      "1.5 एमबीपीएस",
      "1 जीबीपीएस जोड़ 500 एमबीपीएस",
      "2 जीबीपीएस में एमबीपीएस",
      "1 टीबीपीएस को एमबीपीएस",
      "8 मेगाबिट",
      "5 mbps",
      "0 एमबीपीएस",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the compound Hindi writes is read through the kind's bridge", () => {
    // What the vocabulary gives up by shipping एमबीपीएस rather than a
    // slash-bearing "मेगाबाइट/सेकंड", asserted rather than argued: the fuller
    // spelling needs no alias here at all, because it is already a datasize over
    // a duration and `datarate.ops` names both operands by id string. Eight
    // megabytes per second is sixty-four megabits per second, which is the
    // factor of eight `index.ts` writes out and this file deliberately hides
    // nowhere.
    const wired = createEngine({
      locales: [composeLocale(hindi, [datarateHi, datasizeHi, durationHi])],
      kinds: [datarate, datasize, duration],
    });
    const bridged = wired.evaluate("8 मेगाबाइट / सेकंड");
    expect(bridged.kind).toBe("datarate");
    expect(bridged.formatted).toBe("64 एमबीपीएस");
    expect(wired.evaluate("8 मेगाबाइट / सेकंड में एमबीपीएस").formatted).toBe("64 एमबीपीएस");
  });
});
