import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { mass } from "../index";
import massId from "./id";

const engine = () =>
  createEngine({
    locales: [composeLocale(indonesian, [massId])],
    kinds: [mass],
  });

/** The only key `indonesian.selectForm` can produce. */
const KEYS = ["other"];

/** The unit this vocabulary deliberately gives no `forms` table. */
const WORDLESS = ["oz"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "mass",
    unit,
    slot,
  });
  return (massId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("mass id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Indonesian word", () => {
    // Naming the words is the whole check, as it is in `nl.test.ts`: Indonesian
    // is written in plain ASCII, so there is no script class to sweep for the
    // way `ja.test.ts` sweeps for kana. Each of the three is chosen to be
    // unreachable inside an English alias — `miligram` has one `l` where
    // `milligram` has two, and `pon` is bounded so `pound` cannot match it.
    expect(JSON.stringify(mass)).not.toMatch(/miligram|\bpon\b/i);
  });

  test("every unit with a table carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `indonesian.selectForm` can ever ask
    // for, which is what makes the exact-match assertion on each table mean
    // something (rule 6). The counts deliberately include the shapes that move
    // every other language here — 1, the 2/5/11/21 Slavic boundaries, a
    // fraction, and zero — and none of them moves Indonesian.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 11, 21, 100, 1000]) {
        produced.add(
          indonesian.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    // The ounce has no table at all — asserted below, and skipped here rather
    // than softened, because a *partial* table is the failure this check exists
    // to catch.
    for (const [unit, words] of Object.entries(massId.units)) {
      if (WORDLESS.includes(unit)) continue;
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs:
    // Indonesian capitalises no noun, so the string this table prints is the
    // string the alias index holds. That is load-bearing here in a way it is
    // not in a language with morphology — `indonesian.analyze` is `identity()`
    // alone, so there is no stripper to recover a printed word at a penalty.
    for (const [unit, words] of Object.entries(massId.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("the ounce prints its symbol, because the Indonesian word for it means 100 g", () => {
    // `ons` is a live Indonesian unit — one hectogram, the unit of every wet
    // market — and this kind's `oz` is 28.35 g. Claiming the word would answer
    // 28 g to a phrase that means 100 g, so it stays unclaimed and the unit
    // renders through the international symbol an Indonesian package prints.
    expect(massId.units.oz?.forms).toBeUndefined();
    expect(massId.units.oz?.symbol).toBe("oz");
    for (const words of Object.values(massId.units)) {
      expect(words.aliases).not.toContain("ons");
    }
    // Unclaimed means refused, not silently rounded to the nearest unit.
    expect(() => engine().evaluate("2 ons")).toThrow();
  });

  test("the pound is claimed where the ounce is not", () => {
    // The asymmetry the header argues: `pon`'s 500 g reading is an archaism of
    // the Dutch reckoning, ~10 % off in a receding register, where `ons` is
    // 3.5× off in a current one. This kind has no 500 g unit for the older
    // reading to resolve to, exactly as `@smartput/mass/locale/nl` records for
    // `pond`.
    expect(word("lb", 3)).toBe("pon");
    expect(engine().evaluate("3 pon").value.unit).toBe("lb");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [massId]), [mass]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm`
    // read `count` at all would never be asked for its fractional category.
    // 1.5 is what makes the contract sample it — and in Indonesian that row is
    // the same word as every other row, where German's is a plural and
    // Ukrainian's a genitive singular.
    expect(() =>
      assertLocaleContract(composeLocale(indonesian, [massId]), [mass], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    // The floor, seen from the vocabulary side: one string per unit is the
    // language and not an unfinished table. English marks number always, Dutch
    // marks it on the counted nouns only, Ukrainian marks number and case at
    // once, and Indonesian marks nothing.
    expect(word("kg", 1)).toBe("kilogram");
    expect(word("kg", 2)).toBe("kilogram");
    expect(word("kg", 1.5)).toBe("kilogram");
    expect(word("kg", 0)).toBe("kilogram");
    // Ruling R5's count-free row, and the slot German would send to the dative.
    expect(word("kg", undefined, "conversion-target")).toBe("kilogram");
    expect(word("g", undefined, "conversion-target")).toBe("gram");
    expect(word("t", 1000)).toBe("ton");
    expect(word("mg", 5)).toBe("miligram");
  });

  test("an engine built from it reads and writes Indonesian mass", () => {
    const e = engine();
    expect(e.evaluate("1,5 kg").formatted).toBe("1,5 kilogram");
    expect(e.evaluate("2 ton").formatted).toBe("2 ton");
    expect(e.evaluate("500 miligram").value.unit).toBe("mg");
    // The colloquial clipping, which `units.ts` already declares and Indonesian
    // uses unchanged: "beli dua kilo".
    expect(e.evaluate("2 kilo").value.unit).toBe("kg");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun does not move.
    expect(e.evaluate("1 kg + 500 g").formatted).toBe("1,5 kilogram");
    // The two conversion keywords, and the group separator — the exact inverse
    // of English's pair.
    expect(e.evaluate("2 kg dalam gram").formatted).toBe("2.000 gram");
    expect(e.evaluate("2 kg ke gram").formatted).toBe("2.000 gram");
    expect(e.evaluate("500 gram ke kilogram").formatted).toBe("0,5 kilogram");
    // All four word operators, which is where the language's keyword table
    // meets this vocabulary's nouns.
    expect(e.evaluate("10 gram tambah 5 gram").formatted).toBe("15 gram");
    expect(e.evaluate("10 gram kurang 5 gram").formatted).toBe("5 gram");
    expect(e.evaluate("3 gram kali 2").formatted).toBe("6 gram");
    expect(e.evaluate("10 gram bagi 4").formatted).toBe("2,5 gram");
    // The one unit with no word answers with its symbol, set tight because
    // `indonesian` ships no `renderQuantity` — see `@smartput/area/locale/id`,
    // where the same branch is the language's one recorded cost.
    expect(e.evaluate("3 ounce").formatted).toBe("3 oz");
  });

  test("its own output reads back to the same value", () => {
    // Including a grouped row, which was measured rather than assumed: `id`
    // groups with "." and the lexer reads that back as a group separator, so
    // "2.000 gram" is 2000 g and not 2.
    const e = engine();
    for (const input of [
      "1,5 kg",
      "1 kg + 500 g",
      "2 kg dalam gram",
      "500 gram ke kilogram",
      "3 pon",
      "10 gram bagi 4",
      "3 ounce",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
    }
  });
});
