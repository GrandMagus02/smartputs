import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoPt from "./pt";

const locale = () => composeLocale(portuguese, [tempoPt]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = portuguese.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoPt.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `portuguese.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    portuguese.selectForm({ kind: "tempo", unit: "hz", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      portuguese.selectForm({
        count: new Decimal(count),
        kind: "tempo",
        unit: "hz",
        slot,
      }),
    ),
  ]),
);

describe("tempo pt vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Portuguese
  // cannot borrow it — the kind is already full of Latin letters, so a script
  // test would fail on its own unit ids. It cannot borrow `es.test.ts`'s form
  // either, since this vocabulary introduces no new word at all: what is checked
  // instead is that the kind carries none of the Portuguese words this file
  // deliberately did *not* register — the spelled-out expansions, and the
  // Hispanicised eponym Portuguese refuses.
  test("the kind itself carries no Portuguese word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/batida|batimento|h[ée]rcio|hertzio/i);
  });

  test("`portuguese` asks for exactly two keys; hz fills both and bpm neither", () => {
    // The contract the language author pinned: one axis, two rows, no slot
    // dimension. `one` covers 1 and — CLDR's Portuguese rule being `i = 0..1` —
    // also 0 and 1,5; `other` covers everything else including CLDR's third
    // Portuguese category `many`, which `Intl` really returns at 1e6 and which
    // `selectForm` folds away because it is a fact about the numeral rather than
    // about the noun. 1e6 is in the sweep so the fold is sampled rather than
    // read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(tempoPt.units.hz?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // "batidas por minuto" is three words and its middle one is the `times`
    // keyword, so a table here would be prose the lexer reads as
    // multiplication. Rule 6 is satisfied by an empty key set.
    expect(tempoPt.units.bpm?.forms).toBeUndefined();
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "Hz" be the symbol while "hz" is the alias. What this catches is
    // a printed word reachable only through `portuguese`'s suffix stripper, at
    // its -2 penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(tempoPt.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [tempo])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Portuguese sends it to `one` rather than `other` — the
    // opposite of English and Spanish — and this kind is where that is invisible
    // in the output, since both rows spell "hertz". Sampled anyway: the check is
    // that the key exists, not that the strings differ.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are one word, where Spanish made them two", () => {
    // The contrast this kind exists to show, from the other side: Spanish
    // Hispanicises the eponym and gets "hercio"/"hercios" out of it; Portuguese
    // keeps the physicist's name and leaves it invariant, so both categories
    // spell the same string exactly as `en.ts`'s do. Both rows are present
    // rather than one, because an absent `other` would fall back to the symbol
    // and format one value two different ways depending on its count.
    expect(word("hz", 1)).toBe("hertz");
    expect(word("hz", 2)).toBe("hertz");
    expect(word("hz", 0)).toBe("hertz");
    expect(word("hz", 21)).toBe("hertz");
    expect(word("hz", 1.5)).toBe("hertz");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("hz", undefined, "conversion-target")).toBe("hertz");
    // And the unit that answers nothing at all, on purpose.
    expect(word("bpm", 2)).toBeUndefined();
  });

  test("an engine built from it reads and writes Portuguese tempo", () => {
    // The invariant noun, on both sides of the plural boundary and spaced by
    // its `forms` table.
    expect(engine.evaluate("1 hertz").formatted).toBe("1 hertz");
    expect(engine.evaluate("2 hertz").formatted).toBe("2 hertz");
    // A sum landing on a fraction, which is where the decimal comma shows. The
    // left operand fixes the unit, so 60 + 30 beats a minute comes back as one
    // and a half hertz. Written with a comma: "1.5" is not a Portuguese number,
    // since the full stop is this language's group separator.
    expect(engine.evaluate("1 hz + 30 bpm").formatted).toBe("1,5 hertz");
    // bpm has no forms, so the renderer stays on the symbol and sets it tight.
    // No Portuguese alias competes with it: "batidas por minuto" abbreviates to
    // the same three letters the borrowing does.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    // Conversions, one in each direction across the ratio, with both
    // prepositions the language lists under `in`.
    expect(engine.evaluate("3 hz em bpm").formatted).toBe("180 bpm");
    expect(engine.evaluate("120 bpm para hertz").formatted).toBe("2 hertz");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("1000 hertz").formatted).toBe("1.000 hertz");
  });

  test("its own output reads back to the same value", () => {
    // hz round-trips because its one form is an alias, and bpm because its
    // symbol is one — the two halves of the same rule reached by different
    // routes, since bpm has no forms and prints the symbol instead.
    for (const input of [
      "1 hertz",
      "2 hertz",
      "1 hz + 30 bpm",
      "120 bpm",
      "3 hz em bpm",
      "1000 hertz",
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
