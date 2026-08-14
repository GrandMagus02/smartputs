import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeFr from "./fr";

const locale = () => composeLocale(french, [datasizeFr]);
const engine = createEngine({ locales: [locale()], kinds: [datasize] });

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

/** Every key `french.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 0.5, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({
          count: new Decimal(count),
          kind: "datasize",
          unit: "mb",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({ kind: "datasize", unit: "mb", slot }),
      ),
    ),
);

describe("datasize fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which French cannot borrow: the kind is already Latin throughout, so a
  // script test would either pass vacuously or fail on the unit ids. The
  // equivalent claim is the one that can still be made — the *words* this file
  // introduces appear nowhere in the language-free half, which is ratios, unit
  // ids and the magnitude bands `typical` records.
  test("the kind itself carries no French word", () => {
    const descriptor = JSON.stringify(datasize);
    for (const word of ["octet", "kilooctet", "mégaoctet", "gigaoctet", "kibioctet"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`french` asks for exactly two keys, and every unit fills both", () => {
    // The contract the language author pinned: "one" for 0, for 1 and for every
    // fraction below two, "other" from 2 up and for a conversion target with no
    // count. CLDR's third French category (`many`, on exact millions) is folded
    // into `other` by `selectForm`, which is why 1 000 000 does not appear here
    // as a third key.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(datasizeFr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("French is singular below two, which is where an English port breaks", () => {
    const key = (count: number) =>
      french.selectForm({
        count: new Decimal(count),
        kind: "datasize",
        unit: "mb",
        slot: "bare",
      });
    expect(key(0)).toBe("one");
    expect(key(1.5)).toBe("one");
    expect(key(1.9)).toBe("one");
    expect(key(2)).toBe("other");
  });

  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(datasizeFr.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        words.aliases.map((a) => a.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      // Rule 5: a form the printer emits must be a form the parser reads at
      // full weight, not one `french.analyze`'s `-2` suffix stripper happens to
      // recover. The plurals here are all regular -s, so the stripper *would*
      // recover them — which is exactly why the check has to be on the alias
      // list rather than on whether the engine can cope.
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  test("the accented spellings are not reachable by folding", () => {
    // Why every é word is declared twice. NFKC leaves a precomposed é as é —
    // it has no compatibility decomposition — so "megaoctet" is a different
    // string from "mégaoctet" and reaches nothing unless it is listed.
    expect("mégaoctet".normalize("NFKC")).toBe("mégaoctet");
    expect(datasizeFr.units.mb?.aliases).toContain("megaoctet");
    expect(datasizeFr.units.tb?.aliases).toContain("teraoctet");
    expect(datasizeFr.units.mib?.aliases).toContain("mebioctet");
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [datasize])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. In French that category is "one", not English's "other",
    // so a table ported by renaming columns would have every unit's 1,5 row
    // pointing at the plural and this sweep would be the line that notices.
    expect(() =>
      assertLocaleContract(locale(), [datasize], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French datasize", () => {
    expect(engine.evaluate("5 mégaoctets").formatted).toBe("5 mégaoctets");
    // The bare spelling and the French symbol reach the same unit.
    expect(engine.evaluate("5 megaoctets").formatted).toBe("5 mégaoctets");
    expect(engine.evaluate("5 Mo").formatted).toBe("5 mégaoctets");
    // English still reads: "byte" and "megabytes" arrive from `units.ts`.
    expect(engine.evaluate("5 megabytes").formatted).toBe("5 mégaoctets");
    // A conversion, written with "en". The group separator is U+202F — a narrow
    // no-break space, not U+00A0 and not U+0020 — which is invisible on screen
    // and is why the codepoint is spelled out rather than typed.
    expect(engine.evaluate("2 Go en Mo").formatted).toBe(`2${NNBSP}000 mégaoctets`);
    // A sum landing on a fraction, which shows both the decimal comma and the
    // French plural boundary: 1,5 is *singular*.
    expect(engine.evaluate("1 Mo + 500 ko").formatted).toBe("1,5 mégaoctet");
    // ...and the boundary from the other side.
    expect(engine.evaluate("1 Mo + 1 Mo").formatted).toBe("2 mégaoctets");
    // Zero too, which French also puts in the singular: "zéro octet".
    expect(engine.evaluate("1 Mo - 1 Mo").formatted).toBe("0 mégaoctet");
    // The binary four stay distinct from the decimal four, in French as in
    // every other language here: a kibioctet is 1024 octets.
    expect(engine.evaluate("1 Kio en octets").formatted).toBe(`1${NNBSP}024 octets`);
    expect(engine.evaluate("1 ko en octets").formatted).toBe(`1${NNBSP}000 octets`);
  });

  test("its own output reads back to the same value", () => {
    // The round trip the narrow no-break space makes worth pinning: `normalize`
    // folds every `\s` run to one plain space before `lex` sees it, so
    // "2 000 mégaoctets" arrives spelled with U+0020 and is held together by
    // the lexer's three-digit lookahead rather than by the character itself.
    for (const input of [
      "5 mégaoctets",
      "1 Mo + 500 ko",
      "2 Go en Mo",
      "1,5 gigaoctets",
      "2000 Mo",
      "1 Kio en octets",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
