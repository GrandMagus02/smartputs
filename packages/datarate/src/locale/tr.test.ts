import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { datarate } from "../index";
import datarateTr from "./tr";

const locale = () => composeLocale(turkish, [datarateTr]);
const engine = createEngine({ locales: [locale()], kinds: [datarate] });

/** Every key `turkish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({
          count: new Decimal(count),
          kind: "datarate",
          unit: "mbps",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({ kind: "datarate", unit: "mbps", slot }),
      ),
    ),
);

describe("datarate tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex and
  // Turkish cannot borrow it: the kind is already full of Latin letters. What
  // Turkish has instead is an alphabet with six letters no English word carries
  // — ç ğ ı ö ş ü and the dotted capital İ — plus the word list itself, which
  // covers the ASCII-only spellings this file introduces.
  test("the kind itself carries no Turkish word", () => {
    const descriptor = JSON.stringify(datarate);
    expect(descriptor).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    for (const word of ["bit", "kilobit", "megabit", "gigabit", "terabit"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`turkish` asks for exactly one key, and no unit declares any", () => {
    // The contract the language author pinned: `selectForm` returns "other" for
    // every count and every slot, because Turkish leaves a counted noun bare.
    // The sweep above includes the count-free call, which is what a conversion
    // target is (ruling R5), and it lands on the same single key.
    expect([...KEYS]).toEqual(["other"]);
    // And this kind fills even that one row with nothing, for the reason the
    // vocabulary's doc comment gives: the Turkish name of the quantity is
    // "saniyede megabit", two tokens, and the bare "megabit" is the same
    // per-second elision the symbol already carries. Rule 6 is satisfied by an
    // empty key set, not by one row of a second spelling.
    for (const [unit, words] of Object.entries(datarateTr.units)) {
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
    for (const [unit, words] of Object.entries(datarateTr.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases.map((a) => a.toLocaleLowerCase("tr")),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLocaleLowerCase("tr"));
      for (const form of Object.values(words.forms ?? {})) {
        expect(
          words.aliases.map((a) => a.toLocaleLowerCase("tr")),
          `${unit}: "${form}" is printed but not readable`,
        ).toContain(form.toLocaleLowerCase("tr"));
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datarate])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Turkish folds every count onto the one key, which is
    // precisely the claim worth sampling rather than assuming: if `selectForm`
    // ever grows a second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datarate], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Turkish datarate", () => {
    // Turkish word in, Turkish symbol out — separated by a space, which is this
    // language's own `renderQuantity` following TSE where English and Ukrainian
    // both set a symbol tight ("100mbps", "100Мбіт").
    expect(engine.evaluate("100 megabit").formatted).toBe("100 Mbit");
    expect(engine.evaluate("100 mbit").formatted).toBe("100 Mbit");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Turkish spellings are appended to it.
    expect(engine.evaluate("100 mbps").formatted).toBe("100 Mbit");
    // A conversion, written with each of the three words the language lists
    // under `in`. The group separator is a full stop — the exact inverse of
    // English — so "2.000" is two thousand megabits and not two of them.
    expect(engine.evaluate("2 gbps çevir mbit").formatted).toBe("2.000 Mbit");
    expect(engine.evaluate("2 gbps cevir mbit").formatted).toBe("2.000 Mbit");
    expect(engine.evaluate("2 gbps to mbit").formatted).toBe("2.000 Mbit");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Turkish, so a
    // test written with a full stop would be exercising the group separator.
    expect(engine.evaluate("1 mbps + 500 kbps").formatted).toBe("1,5 Mbit");
    // And the same sum written with the Turkish operator word.
    expect(engine.evaluate("1 mbps artı 500 kbps").formatted).toBe("1,5 Mbit");
  });

  test("an all-caps unit word reads, which under Turkish rules it should not", () => {
    // The one thing about Turkish no other language in this repo has, met in
    // this kind's very stem. `"MBIT".toLocaleLowerCase("tr")` is "mbıt" with a
    // DOTLESS ı — I and i are separate letters here — and that matches no key in
    // any alias index. What rescues it is `turkish`'s `caseFolds` analyzer,
    // whose penalised ASCII pass maps every i-shaped letter onto plain i.
    expect("MBIT".toLocaleLowerCase("tr")).toBe("mbıt");
    expect(engine.evaluate("100 MBIT").value.unit).toBe("mbps");
    expect(engine.evaluate("100 MBIT").formatted).toBe("100 Mbit");
    // The already-dotted spelling a Turkish reader would type in caps takes the
    // unpenalised path instead, and lands on the same unit.
    expect("MBİT".toLocaleLowerCase("tr")).toBe("mbit");
    expect(engine.evaluate("100 MBİT").value.unit).toBe("mbps");
  });

  test("vowel harmony is the language's job, not this table's", () => {
    // Nothing below is an alias. Every one of these is a case-marked Turkish
    // word recovered by `turkish`'s flat suffix stripper, which enumerates each
    // harmonic variant because a flat list cannot express the rule: the dative
    // is -e after the front vowel of "bit" and the locative hardens to -te after
    // its voiceless t. `minStem: 3` is what keeps the three-letter "bit" whole.
    for (const [surface, unit] of [
      ["bite", "bps"],
      ["bitte", "bps"],
      ["bitten", "bps"],
      ["megabite", "mbps"],
      ["megabitte", "mbps"],
      ["gigabitler", "gbps"],
      ["terabiti", "tbps"],
    ] as const) {
      expect(engine.evaluate(`5 ${surface}`).value.unit, surface).toBe(unit);
    }
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "100 megabit",
      "1 mbps + 500 kbps",
      "2 gbps to mbit",
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
