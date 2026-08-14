import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyDe from "./de";

const locale = () => composeLocale(german, [energyDe]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** Every key `german.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({
          count: new Decimal(count),
          kind: "energy",
          unit: "kwh",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({ kind: "energy", unit: "kwh", slot }),
      ),
    ),
);

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("energy de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which German cannot borrow: the kind is already full of Latin letters. What
  // German has instead is orthography — every German noun is capitalised, so a
  // German word reaching the language-free half arrives with a capital, and the
  // descriptor (ratios, unit ids, magnitude bands and four power/duration/energy
  // signatures naming their operands by string) has none. The word list is the
  // second half of the same claim, for the spellings German does not share with
  // English.
  test("the kind itself carries no German word", () => {
    const descriptor = JSON.stringify(energy);
    expect(descriptor).not.toMatch(/\p{Lu}/u);
    for (const word_ of ["kalorie", "kilokalorie", "wattstunde", "kilowattstunde"]) {
      expect(descriptor, `the kind mentions "${word_}"`).not.toMatch(
        new RegExp(`\\b${word_}n?\\b`, "i"),
      );
    }
  });

  test("every unit but `btu` carries exactly the four keys `german` can ask for", () => {
    // The contract the language author pinned: case from the slot (a conversion
    // target is dative, everything else nominative) crossed with the two
    // categories `Intl.PluralRules("de")` declares. A count-free target lands on
    // `dat-other` (ruling R5), which is why the sweep above includes the
    // countless call. Rule 6 wants exactly this set — no more, no fewer.
    expect([...KEYS].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
    for (const [unit, words] of Object.entries(energyDe.units)) {
      if (unit === "btu") {
        // No German word exists to put in the table, and Ukrainian's second
        // reason for filling it anyway — the space between number and label —
        // does not transfer, because `german.renderQuantity` spaces a symbol as
        // DIN 1301-1 requires. The engine assertion below is what proves that.
        expect(words.forms, "btu declares a form").toBeUndefined();
        continue;
      }
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}'s keys`).toEqual(
        [...KEYS].sort(),
      );
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives — which is exactly what the
    // watt-hour family would fall into if `Kilowattstunden` were printed without
    // being listed.
    for (const [unit, words] of Object.entries(energyDe.units)) {
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
    // The default counts are all integers, so they never reach the category a
    // fraction takes. German folds that into `other`, which is the claim worth
    // sampling rather than assuming: if `selectForm` ever grows a third CLDR
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the noun class decides whether the number axis moves at all", () => {
    // `Joule` is a neuter loan measure noun: a numeral leaves it in the singular
    // and the dative plural is uninflected too, so all four keys hold one word.
    expect(word("j", 1)).toBe("Joule");
    expect(word("j", 5)).toBe("Joule");
    expect(word("j", 1.5)).toBe("Joule");
    expect(word("j", undefined, "conversion-target")).toBe("Joule");
    // `Kalorie` is feminine, so the number axis is live where it was inert
    // above — and the case axis stays inert, because a feminine's dative plural
    // is already its nominative plural. Between the two units every cell of the
    // table is exercised by a word that actually changes.
    expect(word("cal", 1)).toBe("Kalorie");
    expect(word("cal", 5)).toBe("Kalorien");
    expect(word("cal", undefined, "conversion-target")).toBe("Kalorien");
    // The compound German closes up and English cannot: one token, so it is a
    // printable form here where `en.ts` and `uk.ts` both fall back to a symbol.
    expect(word("kwh", 1)).toBe("Kilowattstunde");
    expect(word("kwh", 2)).toBe("Kilowattstunden");
  });

  test("an engine built from it reads and writes German energy", () => {
    expect(engine.evaluate("5 Kilojoule").formatted).toBe("5 Kilojoule");
    expect(engine.evaluate("1 Joule").formatted).toBe("1 Joule");
    // The closed compound, in and out. Case-folding both ways, since the alias
    // index lowercases and a German writes the capital.
    expect(engine.evaluate("2 Kilowattstunden").formatted).toBe("2 Kilowattstunden");
    expect(engine.evaluate("2 kilowattstunde").formatted).toBe("2 Kilowattstunden");
    // The compound splitter offers `stunde` out of the same word at −3; the
    // exact alias at 0 is what keeps this a kilowatt-hour, and this row fails
    // first if the spelled forms are ever dropped from `aliases`.
    expect(engine.evaluate("2 Kilowattstunden").value.unit).toBe("kwh");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the German spellings are appended to it.
    expect(engine.evaluate("2 kWh").formatted).toBe("2 Kilowattstunden");
    // A conversion, with each of the three prepositions the language lists under
    // `in`. The group separator is a full stop — the exact inverse of English —
    // so "3.600" is three thousand six hundred kilojoules.
    expect(engine.evaluate("1 kwh in Kilojoule").formatted).toBe("3.600 Kilojoule");
    expect(engine.evaluate("1 kwh nach kj").formatted).toBe("3.600 Kilojoule");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is fifteen hundred in German.
    expect(engine.evaluate("1 Kilokalorie + 500 Kalorien").formatted).toBe(
      "1,5 Kilokalorien",
    );
    // The unit with no forms at all, spaced by `german.renderQuantity` rather
    // than by a `forms` table — which is why Ukrainian's four rows of "BTU" are
    // not repeated here.
    expect(engine.evaluate("100 btu").formatted).toBe("100 BTU");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5 Kilojoule",
      "2 Kilowattstunden",
      "1 Kilokalorie + 500 Kalorien",
      "1 kwh in Kilojoule",
      "1,5 Megajoule",
      "100 btu",
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
