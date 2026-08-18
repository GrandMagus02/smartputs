import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { spanish } from "@smartput/core/locale/es";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoEs from "./es";

const locale = () => composeLocale(spanish, [tempoEs]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = spanish.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoEs.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `spanish.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    spanish.selectForm({ kind: "tempo", unit: "hz", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      spanish.selectForm({ count: new Decimal(count), kind: "tempo", unit: "hz", slot }),
    ),
  ]),
);

describe("tempo es vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoEs.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoEs.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex. Spanish cannot
  // borrow it — the kind is already full of Latin letters, so a script test
  // would fail on its own unit ids — so the words are the check: the kind is
  // two ratios, two unit ids, magnitude bands and the reciprocal bridge to
  // `duration`, and no Spanish noun may appear in any of it.
  test("the kind itself carries no Spanish word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/hercio|hertzio|pulsaci[óo]n/i);
  });

  test("`spanish` asks for exactly two keys; hz fills both and bpm neither", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    expect(Object.keys(tempoEs.units.hz?.forms ?? {}).sort()).toEqual(["one", "other"]);
    // "pulsaciones por minuto" is three words and its middle one is the `times`
    // keyword, so a table here would be prose the lexer reads as
    // multiplication. Rule 6 is satisfied by an empty key set.
    expect(tempoEs.units.bpm?.forms).toBeUndefined();
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "Hz" be the symbol while "hz" is the alias. What this catches is
    // a printed word reachable only through `spanish`'s suffix stripper, at its
    // -2 penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(tempoEs.units)) {
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
    // fraction takes. Spanish folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows are two decisions, where English needed two identical ones", () => {
    // The contrast this kind exists to show: "hertz" is its own plural, so
    // `en.ts` spells both categories the same; Spanish inflects, so the rows
    // differ and a vocabulary that dropped `other` would print "1 hercio"
    // beside "2 Hz".
    expect(word("hz", 1)).toBe("hercio");
    expect(word("hz", 2)).toBe("hercios");
    expect(word("hz", 0)).toBe("hercios");
    // 21 stays plural in Spanish where Ukrainian makes it singular, and a
    // fraction is plural too.
    expect(word("hz", 21)).toBe("hercios");
    expect(word("hz", 1.5)).toBe("hercios");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("hz", undefined, "conversion-target")).toBe("hercios");
  });

  test("an engine built from it reads and writes Spanish tempo", () => {
    // The plural boundary, both sides of it.
    expect(engine.evaluate("1 hercio").formatted).toBe("1 hercio");
    expect(engine.evaluate("2 hercios").formatted).toBe("2 hercios");
    // Both borrowed spellings read, and the RAE's word prints.
    expect(engine.evaluate("2 hertz").formatted).toBe("2 hercios");
    expect(engine.evaluate("2 hertzios").formatted).toBe("2 hercios");
    // A sum landing on a fraction, which is where the decimal comma shows. The
    // left operand fixes the unit, so 60 + 30 beats a minute comes back as one
    // and a half hertz. Written with a comma: "1.5" is not a Spanish number,
    // since the full stop is this language's group separator.
    expect(engine.evaluate("1 hz + 30 bpm").formatted).toBe("1,5 hercios");
    // bpm has no forms, so the renderer stays on the symbol and sets it tight.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    // The Spanish abbreviation reads and the borrowed one prints.
    expect(engine.evaluate("120 ppm").formatted).toBe("120 bpm");
    // Conversions, one in each direction across the ratio, with both
    // prepositions the language lists under `in`.
    expect(engine.evaluate("3 hz en bpm").formatted).toBe("180 bpm");
    expect(engine.evaluate("120 bpm a hercios").formatted).toBe("2 hercios");
    // Grouping is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("1000 hercios").formatted).toBe("1.000 hercios");
  });

  test("its own output reads back to the same value", () => {
    // hz round-trips because both its forms are aliases, and bpm because its
    // symbol is one — the two halves of the same rule reached by different
    // routes, since bpm has no forms and prints the symbol instead.
    for (const input of [
      "1 hercio",
      "2 hercios",
      "1 hz + 30 bpm",
      "120 ppm",
      "3 hz en bpm",
      "1000 hercios",
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
