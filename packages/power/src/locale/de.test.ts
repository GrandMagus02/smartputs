import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerDe from "./de";

const locale = () => composeLocale(german, [powerDe]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** Every key `german.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({
          count: new Decimal(count),
          kind: "power",
          unit: "hp",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({ kind: "power", unit: "hp", slot }),
      ),
    ),
);

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("power de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which German cannot borrow: the kind is already full of Latin letters. What
  // German has instead is orthography — every German noun is capitalised, so a
  // German word reaching the language-free half arrives with a capital, and the
  // descriptor (ratios, unit ids and magnitude bands) has none. The word list is
  // the second half of the same claim, for the spellings German does not share
  // with English.
  test("the kind itself carries no German word", () => {
    const descriptor = JSON.stringify(power);
    expect(descriptor).not.toMatch(/\p{Lu}/u);
    for (const word_ of ["pferdestärke", "ps"]) {
      expect(descriptor, `the kind mentions "${word_}"`).not.toMatch(
        new RegExp(`\\b${word_}n?\\b`, "i"),
      );
    }
  });

  test("every unit carries exactly the four keys `german` can ask for", () => {
    // The contract the language author pinned: case from the slot (a conversion
    // target is dative, everything else nominative) crossed with the two
    // categories `Intl.PluralRules("de")` declares. A count-free target lands on
    // `dat-other` (ruling R5), which is why the sweep above includes the
    // countless call. Rule 6 wants exactly this set — no more, no fewer.
    expect([...KEYS].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
    for (const [unit, words] of Object.entries(powerDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}'s keys`).toEqual(
        [...KEYS].sort(),
      );
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and this kind is where the gap between
    // them was measured: the Ukrainian file printed a two-token "кінська сила"
    // and then threw `Unknown unit "кінська"` on its own output. German's
    // one-token compound is what makes the same table safe here, and this is the
    // assertion that says so.
    for (const [unit, words] of Object.entries(powerDe.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
      }
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. German folds that into `other`, which is the claim worth
    // sampling rather than assuming: if `selectForm` ever grows a third CLDR
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`Watt` is invariant and `Pferdestärke` is not", () => {
    // The neuter loan measure noun: a numeral holds it in the singular and the
    // dative plural is uninflected, so all four keys hold one string.
    expect(word("w", 1)).toBe("Watt");
    expect(word("w", 500)).toBe("Watt");
    expect(word("w", 1.5)).toBe("Watt");
    expect(word("w", undefined, "conversion-target")).toBe("Watt");
    // And the unit that keeps the claim above from being vacuous: a feminine
    // marks its plural, so the number axis is live on exactly one unit here.
    expect(word("hp", 1)).toBe("Pferdestärke");
    expect(word("hp", 150)).toBe("Pferdestärken");
    expect(word("hp", undefined, "conversion-target")).toBe("Pferdestärken");
  });

  test("an engine built from it reads and writes German power", () => {
    expect(engine.evaluate("5 Kilowatt").formatted).toBe("5 Kilowatt");
    expect(engine.evaluate("1 Watt").formatted).toBe("1 Watt");
    // Case-folding, both directions: the alias index lowercases, so the capital
    // a German writes and the lowercase a search box gets are one key.
    expect(engine.evaluate("2 kilowatt").formatted).toBe("2 Kilowatt");
    // The compound Ukrainian could not print. "PS" is what a German writes and
    // the word is what comes back, because a `forms` entry wins over a symbol in
    // `renderQuantity` — the same arrangement `en.ts` has with "hp" and
    // "horsepower".
    expect(engine.evaluate("150 PS").formatted).toBe("150 Pferdestärken");
    expect(engine.evaluate("150 Pferdestärken").formatted).toBe("150 Pferdestärken");
    expect(engine.evaluate("1 Pferdestärke").formatted).toBe("1 Pferdestärke");
    // A conversion, with each of the three prepositions the language lists under
    // `in`. The group separator is a full stop — the exact inverse of English —
    // so "1.000" is a thousand watts and not one.
    expect(engine.evaluate("1 kw in Watt").formatted).toBe("1.000 Watt");
    expect(engine.evaluate("1 kw nach W").formatted).toBe("1.000 Watt");
    expect(engine.evaluate("1 kw zu Watt").formatted).toBe("1.000 Watt");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is fifteen hundred in German.
    expect(engine.evaluate("1 Kilowatt + 500 Watt").formatted).toBe("1,5 Kilowatt");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5 Kilowatt",
      "150 PS",
      "1 Kilowatt + 500 Watt",
      "1 kw in Watt",
      "1,5 Megawatt",
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
