import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoTr from "./tr";

const locale = () => composeLocale(turkish, [tempoTr]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** Every key `turkish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({
          count: new Decimal(count),
          kind: "tempo",
          unit: "hz",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({ kind: "tempo", unit: "hz", slot }),
      ),
    ),
);

describe("tempo tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex and
  // Turkish cannot borrow it: the kind is already full of Latin letters. Here
  // the script net has real work to do anyway — "vuruş" carries an ş — and the
  // word list covers the ASCII spellings beside it.
  test("the kind itself carries no Turkish word", () => {
    const descriptor = JSON.stringify(tempo);
    expect(descriptor).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    for (const word of ["vurus", "dakika", "dk"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`turkish` asks for exactly one key, and only `hz` declares it", () => {
    // The contract the language author pinned: `selectForm` returns "other" for
    // every count and every slot, because Turkish leaves a counted noun bare.
    // The sweep above includes the count-free call, which is what a conversion
    // target is (ruling R5), and it lands on the same single key.
    expect([...KEYS]).toEqual(["other"]);
    // `bpm` declares nothing, for the reason `en.ts` gives and one Turkish adds:
    // "dakikada vuruş" is two tokens and "vuruş/dk" carries a slash, so neither
    // shape can lex back as a single unit token. Rule 6 is satisfied by an empty
    // key set, not by one row of unreachable prose.
    expect(tempoTr.units.bpm?.forms).toBeUndefined();
    expect(Object.keys(tempoTr.units.hz?.forms ?? {})).toEqual([...KEYS]);
  });

  // The property `assertLocaleContract` does not check: it walks the alias list
  // and proves each alias resolves, and never asks whether the strings the
  // *printer* emits are among them. Two sources here — the word in `forms` and
  // the symbol under `symbols: true` — and both have to read back.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(tempoTr.units)) {
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
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Turkish folds every count onto the one key, which is
    // precisely the claim worth sampling rather than assuming: if `selectForm`
    // ever grows a second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`vuruş` reads in and never comes back out", () => {
    // The numerator of the abbreviation standing for the whole of it, by the
    // same elision that lets English "bpm" be typed for a tempo. Both spellings
    // are reading keys — the language's case folds cover the dotted and dotless
    // i and nothing else, so ş → s had to be a vocabulary's alias — and only
    // "bpm" is ever printed.
    expect(engine.evaluate("120 vuruş").value.unit).toBe("bpm");
    expect(engine.evaluate("120 vurus").value.unit).toBe("bpm");
    expect(engine.evaluate("120 vuruş").formatted).toBe("120 bpm");
    expect(engine.evaluate("120 vurus").formatted).toBe("120 bpm");
  });

  test("the counted noun never changes shape", () => {
    // "5 hertzler" is not a plural, it is a mistake. English needed two rows
    // here holding the same word; Turkish needs one because there is nothing to
    // agree with.
    expect(engine.evaluate("1 hertz").formatted).toBe("1 hertz");
    expect(engine.evaluate("5 hertz").formatted).toBe("5 hertz");
    expect(engine.evaluate("1,5 hertz").formatted).toBe("1,5 hertz");
    expect(engine.evaluate("21 hertz").formatted).toBe("21 hertz");
  });

  test("an engine built from it reads and writes Turkish tempo", () => {
    // The unit with a word prints the word; `bpm` prints its symbol, spaced,
    // because `turkish.renderQuantity` sets a bare symbol off from the number
    // where English prints "120bpm" tight.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("5 hz").formatted).toBe("5 hertz");
    // A conversion, written with each of the three words the language lists
    // under `in`.
    expect(engine.evaluate("2 hz çevir bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("2 hz cevir bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("2 hz to bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("120 bpm to hertz").formatted).toBe("2 hertz");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Turkish.
    expect(engine.evaluate("1 hz + 30 bpm").formatted).toBe("1,5 hertz");
    expect(engine.evaluate("1 hertz artı 30 bpm").formatted).toBe("1,5 hertz");
    // And the group separator, a full stop where English writes a comma.
    expect(engine.evaluate("2000 bpm").formatted).toBe("2.000 bpm");
  });

  test("an all-caps unit word reads, which under Turkish rules it should not", () => {
    // The one thing about Turkish no other language in this repo has. "HERTZ"
    // has no i-shaped letter and folds identically everywhere, so this kind
    // meets the question through the beat word instead: "VURUS" folds without
    // incident, while "VURUŞ" needs no help either — the letter that breaks is
    // the capital I, and this is the file that shows the fold is a no-op when
    // there is none.
    expect("HERTZ".toLocaleLowerCase("tr")).toBe("hertz");
    expect(engine.evaluate("5 HERTZ").value.unit).toBe("hz");
    expect(engine.evaluate("120 VURUŞ").value.unit).toBe("bpm");
    expect(engine.evaluate("120 VURUS").value.unit).toBe("bpm");
  });

  test("vowel harmony is the language's job, not this table's", () => {
    // Nothing below is an alias. Each is a case-marked Turkish word recovered by
    // `turkish`'s flat suffix stripper, which enumerates every harmonic variant
    // because a flat list cannot express the rule: "hertz" ends in a front
    // vowel, so the dative is -e and never -a.
    for (const [surface, unit] of [
      ["hertze", "hz"],
      ["hertzde", "hz"],
      ["hertzler", "hz"],
      ["vuruşa", "bpm"],
      ["vuruşta", "bpm"],
    ] as const) {
      expect(engine.evaluate(`5 ${surface}`).value.unit, surface).toBe(unit);
    }
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "120 bpm",
      "1 hz + 30 bpm",
      "2 hz to bpm",
      "1,5 hertz",
      "120 vuruş",
      "2000 bpm",
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
