import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempo } from "../index";
import tempoDe from "./de";

const locale = () => composeLocale(german, [tempoDe]);
const engine = createEngine({ locales: [locale()], kinds: [tempo] });

/** Every key `german.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({
          count: new Decimal(count),
          kind: "tempo",
          unit: "hz",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({ kind: "tempo", unit: "hz", slot }),
      ),
    ),
);

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "tempo",
    unit,
    slot,
  });
  return (tempoDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("tempo de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which German cannot borrow: the kind is already full of Latin letters. What
  // German has instead is orthography — every German noun is capitalised, so a
  // German word reaching the language-free half arrives with a capital, and the
  // descriptor (two ratios, two unit ids, magnitude bands and the reciprocal
  // bridge to `duration` naming its operands by string) has none.
  test("the kind itself carries no German word", () => {
    const descriptor = JSON.stringify(tempo);
    expect(descriptor).not.toMatch(/\p{Lu}/u);
    for (const word_ of ["schlag", "schläge", "minute"]) {
      expect(descriptor, `the kind mentions "${word_}"`).not.toMatch(
        new RegExp(`\\b${word_}n?\\b`, "i"),
      );
    }
  });

  test("`hz` carries exactly the four keys `german` can ask for, and `bpm` none", () => {
    // The contract the language author pinned: case from the slot (a conversion
    // target is dative, everything else nominative) crossed with the two
    // categories `Intl.PluralRules("de")` declares. A count-free target lands on
    // `dat-other` (ruling R5), which is why the sweep above includes the
    // countless call. Rule 6 wants exactly this set — no more, no fewer.
    expect([...KEYS].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
    expect(Object.keys(tempoDe.units.hz?.forms ?? {}).sort()).toEqual([...KEYS].sort());
    // And `bpm` fills none, because German's phrase is prepositional rather than
    // compound — "Schläge pro Minute" cannot be glued into one token the way
    // `Kilowatt` + `Stunde` can. Rule 6 is satisfied by an empty key set, not by
    // four rows of unreachable German.
    expect(tempoDe.units.bpm?.forms).toBeUndefined();
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and this kind's symbol was chosen inside
    // the gap: "S/min" is the German abbreviation and it carries an operator, so
    // "bpm" is the only single token that is also an alias.
    for (const [unit, words] of Object.entries(tempoDe.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
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
    // The default counts are all integers, so they never reach the category a
    // fraction takes. German folds that into `other`, which is the claim worth
    // sampling rather than assuming: if `selectForm` ever grows a third CLDR
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [tempo], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`Hertz` is invariant across all four keys", () => {
    // A neuter measure noun: a numeral holds it in the singular, its plural
    // equals its singular, and German writes the dative plural uninflected too.
    // Four keys, one word — and the counter-example that keeps the claim from
    // being vacuous lives one package over, where `Tag` spends three different
    // words across the same four keys.
    expect(word("hz", 1)).toBe("Hertz");
    expect(word("hz", 50)).toBe("Hertz");
    expect(word("hz", 1.5)).toBe("Hertz");
    expect(word("hz", 50, "conversion-target")).toBe("Hertz");
    expect(word("hz", undefined, "conversion-target")).toBe("Hertz");
  });

  test("an engine built from it reads and writes German tempo", () => {
    // `bpm` has no forms, so it prints on its symbol — spaced by
    // `german.renderQuantity` where English sets a symbol tight ("120bpm"), per
    // DIN 1301-1.
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    // The German way in, which is not a way out: the numerator standing for the
    // whole abbreviation.
    expect(engine.evaluate("120 Schläge").formatted).toBe("120 bpm");
    expect(engine.evaluate("120 schläge").formatted).toBe("120 bpm");
    // `hz` does have forms, so a word wins over the symbol in `renderQuantity`.
    expect(engine.evaluate("50 Hertz").formatted).toBe("50 Hertz");
    expect(engine.evaluate("1 hertz").formatted).toBe("1 Hertz");
    // A conversion, with each of the three prepositions the language lists under
    // `in`.
    expect(engine.evaluate("2 hz in bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("2 hz nach bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("120 bpm zu Hertz").formatted).toBe("2 Hertz");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is fifteen hundred in German.
    expect(engine.evaluate("1 Hertz + 30 bpm").formatted).toBe("1,5 Hertz");
    // ...and the group separator, which is a full stop where English writes a
    // comma: two thousand beats per minute, not two.
    expect(engine.evaluate("2000 bpm").formatted).toBe("2.000 bpm");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "120 bpm",
      "120 Schläge",
      "50 Hertz",
      "1 Hertz + 30 bpm",
      "2 hz in bpm",
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
