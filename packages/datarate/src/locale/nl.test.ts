import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateNl from "./nl";

const locale = () => composeLocale(dutch, [datarateNl]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

/** Every key `dutch.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    dutch.selectForm({ kind: "datarate", unit: "mbps", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "datarate",
        unit: "mbps",
        slot,
      }),
    ),
  ]),
);

describe("datarate nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, and Dutch can
  // borrow it no more than German can: the kind is already full of Latin
  // letters. German's substitute was orthography — every German noun carries a
  // capital, so a stray German word shows up as one — and **that substitute does
  // not transfer either**, because Dutch capitalises no noun at all. So the
  // words themselves are the check: the kind is ratios, unit ids, magnitude
  // bands and four bridge signatures naming their operands by id string, and
  // none of the Dutch nouns this file introduces may appear anywhere in it.
  test("the kind itself carries no Dutch word", () => {
    const descriptor = JSON.stringify(datarate);
    for (const word of ["bit", "kilobit", "megabit", "gigabit", "terabit", "mega"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`dutch` asks for exactly two keys, and no unit declares any", () => {
    // The contract the language author pinned: one axis, the CLDR plural
    // category, and nothing else. `slot` is read and discarded, because modern
    // Dutch has no case marking left on common nouns — "naar megabit" governs
    // the same word "megabit" does standing alone — so the four-key table
    // `de.ts` needs collapses to English's two here. The sweep includes a
    // count-free call because a conversion target has no magnitude to agree with
    // and must still answer (R5); Dutch answers `other`.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    // And this kind fills neither, for the reason the vocabulary's doc comment
    // gives: Dutch closes its compounds up as freely as German, but a rate has
    // no closed compound — "megabit per seconde" is three words. Rule 6 is
    // satisfied by an empty key set, not by two rows of unreachable Dutch.
    for (const [unit, words] of Object.entries(datarateNl.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The property `assertLocaleContract` does not check: it walks the alias list
  // and proves each alias resolves, and never asks whether the strings the
  // *printer* emits are among them. With no `forms` anywhere the symbol is the
  // only string this vocabulary can emit, so it is the only one that has to read
  // back — and it does so by being an alias of its own unit, case-folded, which
  // is what lets the SI prefix capital in "Mbit" meet the listed "mbit".
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datarateNl.units)) {
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
        expect(
          words.aliases.map((a) => a.toLowerCase()),
          `${unit}: "${form}" is printed but not readable`,
        ).toContain(form.toLowerCase());
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Dutch folds it into `other` like every other non-1 count,
    // which is precisely the claim worth sampling rather than assuming: if
    // `selectForm` ever grows a third CLDR row, this is the line that notices
    // before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Dutch datarate", () => {
    // Dutch noun in, symbol out — separated by a space, which is this language's
    // own `renderQuantity` following SI where English and Ukrainian both set a
    // symbol tight ("100mbps", "100Мбіт").
    expect(engine.evaluate("100 megabit").formatted).toBe("100 Mbit");
    // The invariant measure noun and the marked plural both read, because
    // recognition is many-to-one while generation stays the one symbol.
    expect(engine.evaluate("100 megabits").formatted).toBe("100 Mbit");
    // The colloquial noun, in both numbers. "mega's" is Dutch's apostrophe
    // plural for a vowel-final noun, and it is listed rather than left to
    // `dutch`'s `'s` stripper — a form recovered at −2 is recovered by accident.
    expect(engine.evaluate("100 mega").formatted).toBe("100 Mbit");
    expect(engine.evaluate("100 mega's").formatted).toBe("100 Mbit");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Dutch spellings are appended to it.
    expect(engine.evaluate("100 mbps").formatted).toBe("100 Mbit");
    // A conversion, written with both prepositions the language lists under
    // `in`. The group separator is a full stop — the exact inverse of English —
    // so "2.000" is two thousand megabits and not two of them.
    expect(engine.evaluate("2 gbps in Mbit").formatted).toBe("2.000 Mbit");
    expect(engine.evaluate("2 gbps naar Mbit").formatted).toBe("2.000 Mbit");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Dutch, so a
    // test written with a full stop would be exercising the group separator.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5 Mbit");
  });

  test("the compound splitter offers the base unit and the alias outranks it", () => {
    // `bit` and `bits` are heads in `dutch`'s own list, so "megabit" splits and
    // offers `bps` at −3 — the base unit, off by a million. The exact alias at 0
    // is what keeps the answer right, and this is the row that fails first if
    // the prefixed abbreviations are ever dropped from `aliases` on the theory
    // that the splitter covers them.
    expect(engine.evaluate("2 megabit").value.unit).toBe("mbps");
    expect(engine.evaluate("2 gigabit").value.unit).toBe("gbps");
    // A compound no vocabulary would list, which is what the split is for: the
    // head decides, so an unknown Dutch modifier still lands on the bit.
    expect(engine.evaluate("2 stuurbit").value.unit).toBe("bps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 megabit",
      "1 mbps + 500 kbps",
      "2 gbps in Mbit",
      "1,5 gigabit",
      "2000 mbps",
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
