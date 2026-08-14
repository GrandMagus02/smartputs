import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { russian } from "@smartput/core/locale/ru";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleRu from "./ru";

const ru = composeLocale(russian, [angleRu]);
const engine = createEngine({ locales: [ru], kinds: [angle] });

/** The eight keys `russian.selectForm` can return — case × plural category. */
const KEYS = [
  "nom-one",
  "nom-few",
  "nom-many",
  "nom-other",
  "loc-one",
  "loc-few",
  "loc-many",
  "loc-other",
];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = russian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleRu.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle ru vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleRu.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleRu.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("every unit carries all eight forms Russian asks for", () => {
    // English needs two keys here and Russian needs eight, and nothing above
    // `forms` changed shape to let it. A missing key does not throw at runtime —
    // it renders the unit's Latin alias at a reader — so it is asserted here
    // rather than discovered.
    for (const [unit, words] of Object.entries(angleRu.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual([...KEYS].sort());
    }
  });

  test("every alias is unique within the kind, so no reading is ambiguous", () => {
    const seen = new Map<string, string>();
    for (const [unit, words] of Object.entries(angleRu.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by both ${seen.get(alias)} and ${unit}`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  // A kind is ratios, unit ids and magnitude bands, so no script but ASCII may
  // reach it. Cyrillic anywhere in the descriptor would mean a translation had
  // leaked into the half of the package that is supposed to be language-free.
  test("the kind itself carries no Russian word", () => {
    expect(JSON.stringify(angle)).not.toMatch(/[Ѐ-ӿ]/);
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `russian`'s suffix
  // stripper recovers it — at `weight: -2`. Asserting the containment is what
  // keeps the two halves of a unit's entry — what it writes and what it reads —
  // in step.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(angleRu.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(ru, [angle])).not.toThrow();
    // The default counts are all integers, and in Russian the CLDR "other"
    // category is reached only by a fraction — so without 1.5 the two rows this
    // vocabulary is likeliest to get wrong are never sampled at all.
    expect(() =>
      assertLocaleContract(ru, [angle], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // The 2/3/4 row is a genitive *singular* in Russian, so it is the same word
    // as the fractional row and a different word from the nominative singular.
    // Ukrainian groups these cells the other way round, which is exactly the
    // mistake a port of `uk.ts` makes.
    expect(word("deg", 1)).toBe("градус");
    expect(word("deg", 2)).toBe("градуса");
    expect(word("deg", 5)).toBe("градусов");
    expect(word("deg", 1.5)).toBe("градуса");
    // 21 is singular in Russian and 11 is not — the two counts that catch a
    // hand-written plural rule.
    expect(word("deg", 21)).toBe("градус");
    expect(word("deg", 11)).toBe("градусов");
    // `радиан` is in the zero-ending measure-unit class, so its genitive plural
    // is the bare stem and coincides with the nominative singular. Applying the
    // -ов of "градусов" here would produce "5 радианов", which reads and is
    // wrong.
    expect(word("rad", 1)).toBe("радиан");
    expect(word("rad", 5)).toBe("радиан");
    expect(word("rad", 2)).toBe("радиана");
  });

  test("an engine built from it reads and writes Russian", () => {
    // The numeral boundary: `nom-few` after 2 and `nom-many` after 5.
    expect(engine.evaluate("2 рад").formatted).toBe("2 радиана");
    expect(engine.evaluate("5 рад").formatted).toBe("5 радиан");
    // A conversion whose result stays under a thousand, so no group separator
    // lands in it.
    expect(engine.evaluate("1 оборот в градусах").formatted).toBe("360 градусов");
    // And one that does group: Russian groups thousands with U+00A0, read out of
    // CLDR by `numberFormat: "intl"` rather than transcribed by hand. Written as
    // an escape because a literal no-break space is invisible in source and
    // degrades to a plain one the moment somebody retypes the line.
    expect(engine.evaluate("10 оборотов в градусах").formatted).toBe(
      "3\u00A0600 градусов",
    );
    // Arithmetic landing on a fraction: the genitive singular, and the assertion
    // that would read "1,5 градусов" if `nom-other` held a plural.
    expect(engine.evaluate("2 градуса - 0,5 градуса").formatted).toBe("1,5 градуса");
    // `гон` reads and `град` prints: the synonym is recognised, never generated.
    expect(engine.evaluate("5 гонов").formatted).toBe("5 градов");
    // Latin still reads: a Russian keyboard types "2 deg" as readily as
    // "2 градуса", and the vocabulary keeps `units.ts`'s aliases for it.
    expect(engine.evaluate("2 deg").formatted).toBe("2 градуса");
  });

  test("a count-free conversion target is prepositional", () => {
    // "в градусах", not "в градусов" and not "в градусы" — the row the old
    // one-dimensional `display` table could not express at all, because it is
    // chosen with no count in hand (ruling R5) and still has to inflect for the
    // case `в` governs.
    for (const [unit, expected] of [
      ["rad", "радианах"],
      ["deg", "градусах"],
      ["grad", "градах"],
      ["turn", "оборотах"],
    ] as const) {
      const key = russian.selectForm({
        kind: "angle",
        unit,
        slot: "conversion-target",
      });
      expect(key).toBe("loc-other");
      expect(angleRu.units[unit]?.forms?.[key]).toBe(expected);
    }
    // With a count of one it is the prepositional *singular*, a different ending
    // again: "в 1 градусе".
    expect(word("deg", 1, "conversion-target")).toBe("градусе");
  });

  test("round-trips: what it prints, it reads back", () => {
    for (const input of [
      "5 оборотов",
      "1 оборот в градусах",
      "10 оборотов в градусах",
      "1,5 града",
      "2 рад",
    ]) {
      const once = engine.evaluate(input);
      const twice = engine.evaluate(once.formatted);
      expect(twice.value.canonical.toString(), input).toBe(
        once.value.canonical.toString(),
      );
      expect(twice.value.unit, input).toBe(once.value.unit);
    }
  });

  // The one string this vocabulary can print that it cannot read back, pinned
  // so the asymmetry stays a decision rather than a surprise. `normalize()`
  // deletes "°" before `lex` ever sees it, so the alias is inert and "90°" is a
  // bare number; the vocabulary keeps the alias anyway, and the printed side is
  // unaffected because `deg` has `forms`. See the symbol's comment in `ru.ts`.
  test("`°` is declared as an alias, and `normalize` still deletes it", () => {
    expect(angleRu.units.deg?.aliases).toContain("°");
    expect(angleRu.units.deg?.symbol).toBe("°");
    expect(engine.evaluate("90°").value.kind).toBe("number");
    // The printed path is the one that matters, and it does round-trip: the
    // form is what a reader sees, and it is a listed alias.
    expect(engine.evaluate("90 градусов").formatted).toBe("90 градусов");
    expect(engine.evaluate(engine.evaluate("90 градусов").formatted).value.unit).toBe(
      "deg",
    );
  });
});
