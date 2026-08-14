import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateDe from "./de";

const locale = () => composeLocale(german, [datarateDe]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

/** Every key `german.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({ kind: "datarate", unit: "mbps", slot }),
      ),
    ),
);

describe("datarate de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex, and
  // German cannot borrow it: the kind is already full of Latin letters. What
  // German has instead is orthography — **every** German noun is capitalised, so
  // a German word reaching the language-free half arrives with a capital, and
  // the descriptor (ratios, unit ids, magnitude bands and four bridge signatures
  // naming their operands by string) has no capital in it at all. The word list
  // is the second half of the same claim, for the lowercase abbreviations this
  // file introduces.
  test("the kind itself carries no German word", () => {
    const descriptor = JSON.stringify(datarate);
    expect(descriptor).not.toMatch(/\p{Lu}/u);
    for (const word of ["bit", "kilobit", "megabit", "gigabit", "terabit", "mega"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`german` asks for exactly four keys, and no unit declares any", () => {
    // The contract the language author pinned: case from the slot (a conversion
    // target is dative, everything else nominative) crossed with the two
    // categories `Intl.PluralRules("de")` declares. A count-free target lands on
    // `dat-other` (ruling R5), which is why the sweep above includes the
    // countless call.
    expect([...KEYS].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
    // And this kind fills none of them, for the reason the vocabulary's doc
    // comment gives: German's escape from an English compound is to close it up
    // ("Kilowattstunde"), and a rate has no closed compound — "Megabit pro
    // Sekunde" is three words. Rule 6 is satisfied by an empty key set, not by
    // four rows of unreachable German.
    for (const [unit, words] of Object.entries(datarateDe.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  // The property `assertLocaleContract` does not check: it walks the alias list
  // and proves each alias resolves, and never asks whether the strings the
  // *printer* emits are among them. With no `forms` anywhere the symbol is the
  // only string this vocabulary can emit, so it is the only one that has to read
  // back — and it does so by being an alias of its own unit, case-folded, which
  // is what lets "Mbit" and the listed "mbit" be one key.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datarateDe.units)) {
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
    // fraction takes. German folds that into `other` like every other non-1
    // count, which is precisely the claim worth sampling rather than assuming:
    // if `selectForm` ever grows a third CLDR row, this is the line that notices
    // before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes German datarate", () => {
    // German noun in, German symbol out — and separated by a space, which is
    // this language's own `renderQuantity` following DIN 1301-1 where English
    // and Ukrainian both set a symbol tight ("100mbps", "100Мбіт").
    expect(engine.evaluate("100 Megabit").formatted).toBe("100 Mbit");
    expect(engine.evaluate("100 megabit").formatted).toBe("100 Mbit");
    expect(engine.evaluate("100 Mega").formatted).toBe("100 Mbit");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the German spellings are appended to it.
    expect(engine.evaluate("100 mbps").formatted).toBe("100 Mbit");
    // A conversion, written with each of the three prepositions the language
    // lists under `in`. The group separator is a full stop — the exact inverse
    // of English — so "2.000" is two thousand megabits and not two of them.
    expect(engine.evaluate("2 gbps in Mbit").formatted).toBe("2.000 Mbit");
    expect(engine.evaluate("2 gbps nach Mbit").formatted).toBe("2.000 Mbit");
    expect(engine.evaluate("2 gbps zu Mbit").formatted).toBe("2.000 Mbit");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in German, so a
    // test written with a full stop would be exercising the group separator.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5 Mbit");
  });

  test("the compound splitter offers the base unit and the alias outranks it", () => {
    // `bit` and `bits` are heads in `german`'s own list, so "Megabit" splits and
    // offers `bps` at −3 — the base unit, off by a million. The exact alias at 0
    // is what keeps the answer right, and this is the row that fails first if
    // the prefixed abbreviations are ever dropped from `aliases` on the theory
    // that the splitter covers them.
    expect(engine.evaluate("2 Megabit").value.unit).toBe("mbps");
    expect(engine.evaluate("2 Gigabit").value.unit).toBe("gbps");
    // A compound no vocabulary would list, which is what the split is for: the
    // head decides, so an unknown modifier still lands on the bit.
    expect(engine.evaluate("2 Nutzbit").value.unit).toBe("bps");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 Megabit",
      "1 mbps + 500 kbps",
      "2 gbps in Mbit",
      "1,5 Gigabit",
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
