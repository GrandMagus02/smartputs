import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyId from "./id";

const locale = () => composeLocale(indonesian, [energyId]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "energy",
    unit,
    slot,
  });
  return (energyId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `indonesian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    indonesian.selectForm({ kind: "energy", unit: "j", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      indonesian.selectForm({
        count: new Decimal(count),
        kind: "energy",
        unit: "j",
        slot,
      }),
    ),
  ]),
);

/** The units whose written-out name is a compound or a gloss, so they print on a symbol. */
const WORDLESS = ["wh", "kwh", "mwh", "btu"];

describe("energy id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Indonesian
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute (every noun carries a capital) does not transfer either, since
  // Indonesian capitalises no common noun. So the words are the check, and only
  // the respelled ones can carry it: *joule* is bound in `units.ts` as an alias,
  // which is the other half of the same separation, while *kalori*, *kkal* and
  // *kal* are this file's own and may appear nowhere in a kind that is ratios,
  // unit ids, magnitude bands and four bridge signatures naming their operands
  // by id string.
  test("the kind itself carries no Indonesian word", () => {
    expect(JSON.stringify(energy)).not.toMatch(/kalori|kilokalori|\bkkal\b|\bkal\b/i);
  });

  test("`indonesian` asks for exactly one key, and every unit with words fills it", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it: `selectForm` is the constant `() => "other"` because Indonesian
    // has no grammatical plural, no gender and no case. The sweep includes a
    // count-free call (R5) and 1e6, so a CLDR `many` row would surface here
    // rather than at a user. Rule 6 wants exactly this set — one row — and it
    // wants an *empty* set from the four units below, not one row of prose no
    // input could reach.
    expect([...KEYS]).toEqual(["other"]);
    for (const [unit, words] of Object.entries(energyId.units)) {
      if (WORDLESS.includes(unit)) {
        expect(words.forms, `${unit} declares a form`).toBeUndefined();
      } else {
        expect(Object.keys(words.forms ?? {}), `${unit}`).toEqual(["other"]);
      }
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it, so the SI capital
    // in "kWh" meets the derived lowercase "kwh". What this catches is the other
    // thing — a printed word reachable only through an analyzer, by accident
    // rather than by declaration. Indonesian cannot afford that gap at all:
    // `indonesian.analyze` is `[identity()]` and nothing else, so "kalori" and
    // both of its abbreviations had to be written into `aliases` by hand.
    for (const [unit, words] of Object.entries(energyId.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
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
    // fraction takes. Indonesian folds it into `other` along with everything
    // else — `selectForm`'s decision rather than arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the noun is invariant, and the hyphenated compound has no noun at all", () => {
    expect(word("j", 1)).toBe("joule");
    expect(word("j", 2)).toBe("joule");
    expect(word("j", 1.5)).toBe("joule");
    expect(word("cal", 2000)).toBe("kalori");
    // A conversion target carries no count and every language must still answer
    // (R5); the slot changes nothing, because there is no case for a preposition
    // to govern — "dalam kalori" holds the word "dua kalori" holds.
    expect(word("j", undefined, "conversion-target")).toBe("joule");
    expect(word("kcal", 2, "conversion-target")).toBe(word("kcal", 2));
    // And the four that print on a symbol: "kilowatt-jam" is hyphenated by the
    // standard orthography and "satuan termal Britania" is a three-word gloss,
    // so neither can be one unit token however it is spelled.
    for (const unit of WORDLESS) expect(word(unit, 2), unit).toBeUndefined();
  });

  test("an engine built from it reads and writes Indonesian energy", () => {
    // Borrowed whole, so the English spelling and the Indonesian one are the
    // same string and only the grouping tells the two engines apart.
    expect(engine.evaluate("5 joule").formatted).toBe("5 joule");
    expect(engine.evaluate("5 joules").formatted).toBe("5 joule");
    // The respelled family, which is what this file actually contributes.
    expect(engine.evaluate("2000 kalori").formatted).toBe("2.000 kalori");
    expect(engine.evaluate("250 kkal").formatted).toBe("250 kilokalori");
    expect(engine.evaluate("250 kcal").formatted).toBe("250 kilokalori");
    expect(engine.evaluate("2000 kal").formatted).toBe("2.000 kalori");
    // Conversions, with both particles the language lists under `in`.
    expect(engine.evaluate("1 kkal dalam kalori").formatted).toBe("1.000 kalori");
    expect(engine.evaluate("1 kwh ke mj").formatted).toBe("3,6 megajoule");
    // A sum landing on a fraction, in both spellings of addition. Written with a
    // comma on purpose: "1.5" is fifteen hundred here, so a test spelled with a
    // full stop would be exercising the group separator instead.
    expect(engine.evaluate("1 kj + 500 j").formatted).toBe("1,5 kilojoule");
    expect(engine.evaluate("1 kj tambah 500 j").formatted).toBe("1,5 kilojoule");
    // The remaining word operators the language claims.
    expect(engine.evaluate("2 kj kurang 500 j").formatted).toBe("1,5 kilojoule");
    expect(engine.evaluate("3 kj bagi 2").formatted).toBe("1,5 kilojoule");
  });

  test("the hyphenated compound prints tight, and that is the language's own cost", () => {
    // Recorded as an assertion rather than left in prose. Indonesian follows SI
    // in spacing a symbol from its number, and `defaultRenderQuantity` sets one
    // tight; `@smartput/core/locale/id` declines a `renderQuantity` on the
    // reasoning that every translated Indonesian unit carries a `forms` row and
    // therefore takes the spacing word branch. These four are the
    // counter-example inside this package, and the fix belongs in the language
    // file rather than in six vocabularies each guessing at a space.
    expect(engine.evaluate("2 kwh").formatted).toBe("2kWh");
    expect(engine.evaluate("9000 btu").formatted).toBe("9.000BTU");
    // The units that do carry a word are spaced, which is the branch the
    // language file reasoned from and the reason the cost is bounded.
    expect(engine.evaluate("5 joule").formatted).toContain(" ");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5 joule",
      "2000 kalori",
      "250 kkal",
      "1 kkal dalam kalori",
      "1 kwh ke mj",
      "1 kj tambah 500 j",
      "2 kwh",
      "9000 btu",
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
