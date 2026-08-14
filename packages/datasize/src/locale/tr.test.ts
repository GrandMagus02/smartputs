import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeTr from "./tr";

const locale = () => composeLocale(turkish, [datasizeTr]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** Every key `turkish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({
          count: new Decimal(count),
          kind: "datasize",
          unit: "mb",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({ kind: "datasize", unit: "mb", slot }),
      ),
    ),
);

describe("datasize tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex and
  // Turkish cannot borrow it: the kind is already full of Latin letters. What
  // Turkish has instead is an alphabet with six letters no English word carries
  // — ç ğ ı ö ş ü and the dotted capital İ — backed by the word list itself,
  // which covers the fully ASCII spellings this file introduces.
  test("the kind itself carries no Turkish word", () => {
    const descriptor = JSON.stringify(datasize);
    expect(descriptor).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    for (const word of [
      "bayt",
      "kilobayt",
      "megabayt",
      "gigabayt",
      "terabayt",
      "kibibayt",
      "mebibayt",
      "gibibayt",
      "tebibayt",
    ]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`turkish` asks for exactly one key, and every unit declares exactly it", () => {
    // The contract the language author pinned: `selectForm` returns "other" for
    // every count and every slot, because Turkish leaves a counted noun bare.
    // The sweep above includes the count-free call, which is what a conversion
    // target is (ruling R5), and it lands on the same single key.
    expect([...KEYS]).toEqual(["other"]);
    // Rule 6, in its strict form: the key set a unit declares is *exactly* the
    // set `selectForm` can produce — no missing row that would silently print a
    // symbol where a word belongs, and no extra row that no count can ever
    // reach. Nine units, nine one-row tables.
    for (const [unit, words] of Object.entries(datasizeTr.units)) {
      expect(Object.keys(words.forms ?? {}), `${unit}'s key set`).toEqual([...KEYS]);
    }
  });

  // The property `assertLocaleContract` does not check: it walks the alias list
  // and proves each alias resolves, and never asks whether the strings the
  // *printer* emits are among them. Two sources here — the word in `forms` and
  // the symbol under `symbols: true` — and both have to read back.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datasizeTr.units)) {
      const printable = [words.symbol as string, ...Object.values(words.forms ?? {})];
      // The fold is Turkish's own, which is the point: "KiB" and the derived
      // "kib" are one key only because `toLocaleLowerCase("tr")` leaves an
      // already-dotted i alone. A symbol spelled with a capital I instead would
      // fold to ı and miss its own alias, which is the trap this line is set for.
      const aliases = words.aliases.map((a) => a.toLocaleLowerCase("tr"));
      for (const surface of printable) {
        expect(surface, `${unit}'s "${surface}" holds an operator character`).not.toMatch(
          /[/*+\-·×⋅]/,
        );
        expect(surface, `${unit}'s "${surface}" is more than one token`).not.toMatch(
          /\s/u,
        );
        expect(aliases, `${unit}: "${surface}" is printed but not readable`).toContain(
          surface.toLocaleLowerCase("tr"),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Turkish folds every count onto the one key, which is
    // precisely the claim worth sampling rather than assuming: if `selectForm`
    // ever grows a second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the counted noun never changes shape", () => {
    // The whole of Turkish number agreement, in four lines. English would need
    // "byte" and "bytes"; Ukrainian needs four nominative rows. Turkish needs
    // one, and 1, 5 and a fraction all print it unchanged.
    expect(engine.evaluate("1 megabayt").formatted).toBe("1 megabayt");
    expect(engine.evaluate("5 megabayt").formatted).toBe("5 megabayt");
    expect(engine.evaluate("1,5 megabayt").formatted).toBe("1,5 megabayt");
    expect(engine.evaluate("0 megabayt").formatted).toBe("0 megabayt");
  });

  test("an engine built from it reads and writes Turkish datasize", () => {
    // Turkish word in, Turkish word out — the declared `forms` row beats the
    // symbol, and `defaultRenderQuantity` spaces a word.
    expect(engine.evaluate("512 megabayt").formatted).toBe("512 megabayt");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Turkish spellings are appended to it.
    expect(engine.evaluate("2 tb").formatted).toBe("2 terabayt");
    // A conversion, written with each of the three words the language lists
    // under `in`. The group separator is a full stop — the exact inverse of
    // English — so "1.000" is a thousand megabytes and not one of them.
    expect(engine.evaluate("1 gb çevir megabayt").formatted).toBe("1.000 megabayt");
    expect(engine.evaluate("1 gb cevir megabayt").formatted).toBe("1.000 megabayt");
    expect(engine.evaluate("1 gb to megabayt").formatted).toBe("1.000 megabayt");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Turkish, so a
    // test written with a full stop would be exercising the group separator.
    expect(engine.evaluate("1 kb + 500 b").formatted).toBe("1,5 kilobayt");
    expect(engine.evaluate("1 kb artı 500 b").formatted).toBe("1,5 kilobayt");
    // The two families stay apart: a kilobyte is 1000 bayt and a kibibyte 1024.
    expect(engine.evaluate("1 kib to bayt").formatted).toBe("1.024 bayt");
    expect(engine.evaluate("1 kb to bayt").formatted).toBe("1.000 bayt");
  });

  test("an all-caps unit word reads, which under Turkish rules it should not", () => {
    // The one thing about Turkish no other language in this repo has, and the
    // IEC prefixes walk straight into it. `"KIB".toLocaleLowerCase("tr")` is
    // "kıb" with a DOTLESS ı — I and i are separate letters here — and that
    // matches no key in any alias index. What rescues it is `turkish`'s
    // `caseFolds` analyzer, whose penalised ASCII pass maps every i-shaped
    // letter onto plain i.
    expect("KIB".toLocaleLowerCase("tr")).toBe("kıb");
    expect(engine.evaluate("5 KIB").value.unit).toBe("kib");
    // A word with no i-shaped letter in it never meets the question at all, and
    // takes the unpenalised fold.
    expect(engine.evaluate("5 BAYT").value.unit).toBe("b");
  });

  test("vowel harmony is the language's job, not this table's", () => {
    // Nothing below is an alias. Every one of these is a case-marked Turkish
    // word recovered by `turkish`'s flat suffix stripper, which enumerates each
    // harmonic variant because a flat list cannot express the rule: "bayt" ends
    // in a back vowel, so the dative is -a and never -e, and the locative
    // hardens to -ta after the voiceless t.
    for (const [surface, unit] of [
      ["bayta", "b"],
      ["baytta", "b"],
      ["bayttan", "b"],
      ["baytlar", "b"],
      ["megabayta", "mb"],
      ["gigabaytta", "gb"],
      ["kibibaytlar", "kib"],
    ] as const) {
      expect(engine.evaluate(`5 ${surface}`).value.unit, surface).toBe(unit);
    }
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "512 megabayt",
      "1 kb + 500 b",
      "1 gb to megabayt",
      "1,5 gigabayt",
      "2000 mb",
      "1 kib to bayt",
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
