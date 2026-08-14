import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { dutch } from "@smartput/core/locale/nl";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyNl from "./nl";

const locale = () => composeLocale(dutch, [energyNl]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = dutch.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyNl.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `dutch.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    dutch.selectForm({ kind: "energy", unit: "kwh", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      dutch.selectForm({
        count: new Decimal(count),
        kind: "energy",
        unit: "kwh",
        slot,
      }),
    ),
  ]),
);

describe("energy nl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyNl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyNl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Dutch
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute does not transfer either, because it rests on every German noun
  // carrying a capital and Dutch capitalises none. So the words are the check:
  // the kind is ratios, unit ids and magnitude bands, and none of the Dutch
  // spellings this file introduces may appear anywhere in it.
  test("the kind itself carries no Dutch word", () => {
    expect(JSON.stringify(energy)).not.toMatch(
      /wattuur|kilowattuur|megawattuur|calorie[eë]n|watturen/i,
    );
  });

  test("`dutch` asks for exactly two keys, and every unit but `btu` fills them", () => {
    // The contract the language author pinned: one axis, the CLDR plural
    // category, and nothing else. `slot` is read and discarded, because modern
    // Dutch lost its case marking on common nouns — "in kilowattuur" governs the
    // same word a bare quantity does — so the dative axis `de.ts` carries is
    // absent and the table is English-shaped. The sweep includes a count-free
    // call (R5) and 1e6, so a CLDR `many` row would surface here.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(energyNl.units)) {
      if (unit === "btu") continue;
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
    // The one exception, and the reason it is one: a borrowed initialism with no
    // Dutch expansion in use. Rule 6 is satisfied by an empty key set here, not
    // by two rows of "BTU" — and unlike Ukrainian, Dutch loses nothing by it,
    // because `dutch.renderQuantity` spaces a symbol the way it spaces a word.
    expect(energyNl.units.btu?.forms).toBeUndefined();
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing, so the SI capitals in
    // "kWh" meet the derived "kwh" and a symbol never has to be listed twice.
    // What this catches is the other thing — a printed word reachable only
    // through `dutch`'s suffix stripper, at its −2 penalty, so by accident
    // rather than by declaration. "calorieën" is exactly that shape.
    for (const [unit, words] of Object.entries(energyNl.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
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
    // fraction takes. Dutch folds it into `other`, the row 0 and 5 take — but
    // that is `selectForm`'s decision, not arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the measure nouns are invariant and the calorie is not", () => {
    // Dutch holds a unit of measure in the singular after a numeral, so both
    // rows are one word for the joule family and for the watt-hour family, whose
    // head is *uur* and inherits the hour's invariance.
    expect(word("j", 1)).toBe("joule");
    expect(word("j", 5)).toBe("joule");
    expect(word("kwh", 1)).toBe("kilowattuur");
    expect(word("kwh", 3)).toBe("kilowattuur");
    expect(word("kwh", 1.5)).toBe("kilowattuur");
    // And the counterweight, without which every row above would be a table that
    // stopped halfway rather than a fact about the noun class. A calorie is
    // counted, not measured, so its plural is marked — with the trema that keeps
    // the reader from running *ie* into the *e* of the ending.
    expect(word("cal", 1)).toBe("calorie");
    expect(word("cal", 2000)).toBe("calorieën");
    expect(word("kcal", 1)).toBe("kilocalorie");
    expect(word("kcal", 2)).toBe("kilocalorieën");
    // A conversion target carries no count and every language must still answer
    // (R5). Dutch answers `other`, and the slot changes nothing at all.
    expect(word("j", undefined, "conversion-target")).toBe("joule");
    expect(word("cal", 2, "conversion-target")).toBe(word("cal", 2));
  });

  test("an engine built from it reads and writes Dutch energy", () => {
    expect(engine.evaluate("5 joule").formatted).toBe("5 joule");
    // The English plural still reads, and is answered with the Dutch invariant.
    expect(engine.evaluate("5 joules").formatted).toBe("5 joule");
    // The closed compound Dutch shares with German and English does not have.
    expect(engine.evaluate("1 kilowattuur").formatted).toBe("1 kilowattuur");
    expect(engine.evaluate("3 kilowattuur").formatted).toBe("3 kilowattuur");
    expect(engine.evaluate("3 kwh").formatted).toBe("3 kilowattuur");
    // The marked plural, and the trema-less spelling an unaccented keyboard
    // produces — read either way, printed one way.
    expect(engine.evaluate("2000 calorieën").formatted).toBe("2.000 calorieën");
    expect(engine.evaluate("2000 calorieen").formatted).toBe("2.000 calorieën");
    // A conversion, with both prepositions the language lists under `in`. The
    // group separator is a full stop — the inverse of English.
    expect(engine.evaluate("2 kwh in joule").formatted).toBe("7.200.000 joule");
    expect(engine.evaluate("2 kwh naar joule").formatted).toBe("7.200.000 joule");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Dutch.
    expect(engine.evaluate("1 kwh + 500 wh").formatted).toBe("1,5 kilowattuur");
    // The formless unit, spaced by `dutch.renderQuantity` where English would
    // set it tight — which is why absent forms cost Dutch nothing here.
    expect(engine.evaluate("100 btu").formatted).toBe("100 BTU");
  });

  test("the compound splitter offers the base unit and the alias outranks it", () => {
    // `calorie` and `calorieën` are heads in `dutch`'s own list, so
    // "kilocalorieën" splits and offers `cal` at −3 — off by a thousand. The
    // exact alias at 0 is what keeps the answer right, and this is the row that
    // fails first if the Dutch plurals are ever dropped on the theory that the
    // splitter covers them.
    expect(engine.evaluate("2 kilocalorieën").value.unit).toBe("kcal");
    // `uur` is *not* a head — a head list containing it reads *temperatuur* as a
    // count of hours — so "kilowattuur" splits into nothing at all and its alias
    // is the only reading there has ever been.
    expect(engine.evaluate("2 kilowattuur").value.unit).toBe("kwh");
    // A compound no vocabulary would list, which is what the split is for: the
    // head decides, so an unknown Dutch modifier still lands on the joule.
    expect(engine.evaluate("2 zonnejoule").value.unit).toBe("j");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5 joule",
      "1 kwh + 500 wh",
      "2 kwh in joule",
      "2000 calorieen",
      "100 btu",
      "3 kilowattuur",
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
