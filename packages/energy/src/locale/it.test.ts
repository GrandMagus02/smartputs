import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { italian } from "@smartput/core/locale/it";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyIt from "./it";

const locale = () => composeLocale(italian, [energyIt]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** The word this vocabulary prints for a unit at a count, the way the engine picks it. */
const word = (unit: string, count?: number) =>
  energyIt.units[unit]?.forms?.[
    italian.selectForm({
      ...(count !== undefined ? { count: new Decimal(count) } : {}),
      kind: "energy",
      unit,
      slot: "after-number",
    })
  ];

/** Every key `italian.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({
          count: new Decimal(count),
          kind: "energy",
          unit: "j",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        italian.selectForm({ kind: "energy", unit: "j", slot }),
      ),
    ),
);

describe("energy it vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyIt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyIt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which Italian cannot borrow: the kind is already full of Latin letters
  // ("kwh", "kcal"), so a script test would either pass vacuously or fail on the
  // unit ids themselves. The equivalent claim is that the words this file
  // introduces appear nowhere in the language-free half, which is nine ratios,
  // nine unit ids, magnitude bands and four signatures naming operands by string.
  test("the kind itself carries no Italian word", () => {
    const descriptor = JSON.stringify(energy);
    for (const w of ["chilowattora", "wattora", "caloria", "chilojoule"]) {
      expect(descriptor, `the kind mentions "${w}"`).not.toMatch(
        new RegExp(`\\b${w}\\b`, "i"),
      );
    }
  });

  test("every unit carries exactly the two keys `italian` can produce", () => {
    // The contract the language author pinned: `one` for a count of 1, `other`
    // for everything else — 0, fractions, a conversion target with no count at
    // all (R5), and CLDR's `many` at 1e6, folded into `other` because this
    // engine never prints compact notation. 1e6 is in the sweep so the fold is
    // sampled rather than read from a doc comment. The slot is ignored
    // throughout, Italian nouns having no case.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    // Every unit, with no symbol-only exception — which is the difference from
    // `en.test.ts` and `es.test.ts` worth naming. Italian writes the watt-hour
    // family as one word ("chilowattora"), so it has forms where the other three
    // languages had to leave them undefined.
    for (const [unit, words] of Object.entries(energyIt.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}'s key set`).toEqual([
        "one",
        "other",
      ]);
    }
  });

  test("the welded watt-hour words are one token each", () => {
    // The property the whole decision rests on: `parse/lex.ts` builds a unit
    // word out of a run of letters, so a printed form with a space or a hyphen
    // in it could never be read back. Italian's compound has neither.
    for (const unit of ["wh", "kwh", "mwh"]) {
      for (const form of Object.values(energyIt.units[unit]?.forms ?? {})) {
        expect(form, `${unit}: "${form}" is not a single token`).toMatch(/^\p{L}+$/u);
      }
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing and
    // `assertLocaleContract` looks a printed surface up the same way, which is
    // what lets "kWh" be the symbol while "kwh" is the alias. What this catches
    // is a printed word reachable only through `italian`'s `pluralFold`, at its
    // -2 penalty — readable by accident rather than by declaration.
    for (const [unit, words] of Object.entries(energyIt.units)) {
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
    expect(() => assertLocaleContract(locale(), [energy])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Italian folds it into `other` — `selectForm`'s decision,
    // not arithmetic, so it is sampled rather than assumed.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the two rows differ only where Italian inflects", () => {
    // The native feminine noun, which is the one row in this file that moves.
    expect(word("cal", 1)).toBe("caloria");
    expect(word("cal", 2)).toBe("calorie");
    expect(word("cal", 0)).toBe("calorie");
    // 21 is plural in Italian where Ukrainian makes it singular, and a fraction
    // is plural too.
    expect(word("cal", 21)).toBe("calorie");
    expect(word("cal", 1.5)).toBe("calorie");
    // The invariant borrowings, where both rows hold one string on purpose
    // rather than by omission.
    expect(word("j", 1)).toBe("joule");
    expect(word("j", 5)).toBe("joule");
    expect(word("kwh", 1)).toBe("chilowattora");
    expect(word("kwh", 5)).toBe("chilowattora");
    expect(word("btu", 5)).toBe("BTU");
    // A conversion target carries no count and must still be answered (R5).
    expect(word("cal")).toBe("calorie");
  });

  test("an engine built from it reads and writes Italian energy", () => {
    // The welded compound, printed as a word and spaced — the shape English and
    // Spanish cannot print at all.
    expect(engine.evaluate("1 kwh").formatted).toBe("1 chilowattora");
    expect(engine.evaluate("2 chilowattora").formatted).toBe("2 chilowattora");
    // The native noun, which does inflect.
    expect(engine.evaluate("1 caloria").formatted).toBe("1 caloria");
    expect(engine.evaluate("2 calorie").formatted).toBe("2 calorie");
    // The Italian numeral fold reaches the same value through a welded word.
    expect(engine.evaluate("due calorie").formatted).toBe("2 calorie");
    // A conversion with "in", and the group separator that makes it worth
    // asserting: `Intl.NumberFormat("it")` groups with ".", so a kilowatt-hour
    // is "3.600.000" joules and not three.
    expect(engine.evaluate("1 kwh in j").formatted).toBe("3.600.000 joule");
    // ...and with "a", the directional preposition listed beside "in".
    expect(engine.evaluate("1000 cal a kcal").formatted).toBe("1 chilocaloria");
    // A sum landing on a fraction, where the decimal comma shows. Written with a
    // comma on purpose: "1.5" is not an Italian number, so a test spelled that
    // way would be exercising the group separator instead.
    expect(engine.evaluate("1 kcal + 500 cal").formatted).toBe("1,5 chilocalorie");
    // ...and the same sum spelled with Italian's own word for the operator.
    expect(engine.evaluate("1 kcal più 500 cal").formatted).toBe("1,5 chilocalorie");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "1 kwh",
      "2 chilowattora",
      "1 caloria",
      "1 kcal + 500 cal",
      "1 kwh in j",
      "1,5 megajoule",
      "5 btu",
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
