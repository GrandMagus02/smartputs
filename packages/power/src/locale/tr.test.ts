import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerTr from "./tr";

const locale = () => composeLocale(turkish, [powerTr]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** Every key `turkish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({
          count: new Decimal(count),
          kind: "power",
          unit: "kw",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({ kind: "power", unit: "kw", slot }),
      ),
    ),
);

describe("power tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex and
  // Turkish cannot borrow it: the kind is already full of Latin letters, and
  // every Turkish word this file adds is spelled in ASCII. So the word list is
  // the assertion, with the Turkish-only letters kept as a second net for
  // anything added later.
  test("the kind itself carries no Turkish word", () => {
    const descriptor = JSON.stringify(power);
    expect(descriptor).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    for (const word of ["vat", "kilovat", "megavat", "gigavat", "beygir", "bg"]) {
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
    // Rule 6 in its strict form: exactly the set `selectForm` can produce.
    // Including `hp`, which is the unit Ukrainian had to give up on — its phrase
    // "кінська сила" is two tokens and could not be read back, so that file
    // dropped the table entirely. Turkish keeps one because the elision
    // "beygir" is what a Turkish speaker says out loud anyway.
    for (const [unit, words] of Object.entries(powerTr.units)) {
      expect(Object.keys(words.forms ?? {}), `${unit}'s key set`).toEqual([...KEYS]);
    }
  });

  // The property `assertLocaleContract` does not check: it walks the alias list
  // and proves each alias resolves, and never asks whether the strings the
  // *printer* emits are among them. Two sources here — the word in `forms` and
  // the symbol under `symbols: true` — and both have to read back. The
  // one-token assertion is the line `uk.ts` learned to want: "1 hp" once printed
  // "1 кінська сила" and then threw `Unknown unit "кінська"` on its own output.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(powerTr.units)) {
      const printable = [words.symbol as string, ...Object.values(words.forms ?? {})];
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
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Turkish folds every count onto the one key, which is
    // precisely the claim worth sampling rather than assuming: if `selectForm`
    // ever grows a second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`beygir` is the whole of the horsepower, and it round-trips", () => {
    // The phrase is "beygir gücü", two tokens; the elision is what Turkish
    // actually says about a car, and it is one token, so it can be both printed
    // and read. "BG" is the initialism a spec sheet prints and is listed as an
    // alias so `symbols: true` parses back.
    expect(engine.evaluate("300 beygir").formatted).toBe("300 beygir");
    expect(engine.evaluate("300 bg").formatted).toBe("300 beygir");
    expect(engine.evaluate("300 hp").formatted).toBe("300 beygir");
    expect(powerTr.units.hp?.symbol).toBe("BG");
  });

  test("an engine built from it reads and writes Turkish power", () => {
    expect(engine.evaluate("5 vat").formatted).toBe("5 vat");
    expect(engine.evaluate("1,5 megavat").formatted).toBe("1,5 megavat");
    // Latin spellings still read: the aliases derive from the one map in
    // `units.ts` before the Turkish ones are appended to it, so "watt" and "vat"
    // are both understood and only the Turkish one comes back out.
    expect(engine.evaluate("5 watts").formatted).toBe("5 vat");
    // A conversion, written with each of the three words the language lists
    // under `in`. The group separator is a full stop — the exact inverse of
    // English — so "1.000" is a thousand watts and not one of them.
    expect(engine.evaluate("1 kw çevir vat").formatted).toBe("1.000 vat");
    expect(engine.evaluate("1 kw cevir vat").formatted).toBe("1.000 vat");
    expect(engine.evaluate("1 kw to vat").formatted).toBe("1.000 vat");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Turkish.
    expect(engine.evaluate("1 kw + 500 w").formatted).toBe("1,5 kilovat");
    expect(engine.evaluate("1 kilovat artı 500 vat").formatted).toBe("1,5 kilovat");
  });

  test("an all-caps unit word reads, which under Turkish rules it should not", () => {
    // The one thing about Turkish no other language in this repo has. This kind
    // meets it on the prefix rather than the stem: "KILOVAT" folds to "kılovat"
    // with a DOTLESS ı under Turkish rules, and that matches no key in any alias
    // index. `turkish`'s `caseFolds` analyzer offers the ASCII reading at weight
    // −1 beside the Turkish one at 0, which is what makes the shouted spelling
    // resolve.
    expect("KILOVAT".toLocaleLowerCase("tr")).toBe("kılovat");
    expect(engine.evaluate("5 KILOVAT").value.unit).toBe("kw");
    expect("KİLOVAT".toLocaleLowerCase("tr")).toBe("kilovat");
    expect(engine.evaluate("5 KİLOVAT").value.unit).toBe("kw");
    // The bare canonical has no i-shaped letter and never meets the question.
    expect(engine.evaluate("5 VAT").value.unit).toBe("w");
  });

  test("vowel harmony is the language's job, and `minStem: 3` is why", () => {
    // Nothing below is an alias. Each is a case-marked Turkish word recovered by
    // `turkish`'s flat suffix stripper. "vat" is three letters, so "vata" strips
    // back to a stem the floor still admits — a floor of 4 would have lost the
    // canonical unit of this kind — and "vatta" is the locative hardened after
    // the voiceless t. "beygire" takes the front-vowel dative instead, which is
    // the whole of vowel harmony in two rows.
    for (const [surface, unit] of [
      ["vata", "w"],
      ["vatta", "w"],
      ["vattan", "w"],
      ["kilovata", "kw"],
      ["megavatta", "mw"],
      ["gigavatlar", "gw"],
      ["beygire", "hp"],
      ["beygirde", "hp"],
    ] as const) {
      expect(engine.evaluate(`5 ${surface}`).value.unit, surface).toBe(unit);
    }
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5 vat",
      "1 kw + 500 w",
      "1 kw to vat",
      "1,5 megavat",
      "300 hp",
      "300 hp to kilovat",
      "2000 vat",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      // Ruling R-C1: `formatted` is a readability policy, so what comes back
      // from it is the displayed number and not the 26-digit one. The property
      // that survives — and the one "reads back what it prints" means to a
      // person — is that displaying the re-read value writes the same string.
      // The exact guard is `formatPrecision`, tested through the Printer in
      // `@smartput/core`'s print/roundtrip.test.ts.
      expect(again.formatted, input).toBe(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
