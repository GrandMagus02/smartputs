import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { english } from "@smartput/core/locale/en";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleDe from "./de";
import angleEn from "./en";

const de = composeLocale(german, [angleDe]);
const engine = createEngine({ locales: [de], kinds: [angle] });

/** The four keys `german.selectForm` can produce, sorted. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no German word", () => {
    // `grad` is deliberately absent from the pattern: it is a *unit id*, so it
    // is in the kind by construction and matching on it would assert the
    // opposite of what this test means. German shares the ids' script, so the
    // nouns have to be named; the umlaut sweep beside them catches anything
    // else German that might leak in.
    expect(JSON.stringify(angle)).not.toMatch(/radiant|umdrehung|neugrad/i);
    expect(JSON.stringify(angle)).not.toMatch(/[äöüß]/i);
  });

  test("the degree takes `grad` and the gradian gives it up", () => {
    // The one alias this file overrules `units.ts` on, and the reason is that
    // German has no other word for a degree. The gradian keeps the names German
    // actually uses for it — `Gon` (DIN 1315) and `Neugrad` — so nothing is
    // lost, and the contract's rival check, which refuses one surface claimed
    // by two units of one kind, is satisfied by construction.
    expect(angleDe.units.deg?.aliases).toContain("grad");
    expect(angleDe.units.grad?.aliases).not.toContain("grad");
    expect(angleDe.units.grad?.aliases).toEqual(
      expect.arrayContaining(["gon", "gradian", "neugrad"]),
    );
    expect(engine.evaluate("90 Grad").value.unit).toBe("deg");
    expect(engine.evaluate("200 Gon").value.unit).toBe("grad");
  });

  /**
   * The cost of that reassignment, measured rather than described.
   *
   * German is the first shipped language to spell a unit with the same letters
   * English uses for a *different* unit of the same kind, so this pair cannot
   * occur on any `en`/`uk` engine and no existing test could have found it.
   * Both readings are exact aliases at weight 0 within one kind, so nothing
   * ranks them and `evaluate` refuses instead of guessing — which is the right
   * refusal, but it means "90 Grad" needs the caller to say which language it
   * is reading before it answers.
   *
   * Pinned as a finding, not as an endorsement: if `german` ever ships a
   * `weights` table, or `Language` grows a narrower way to bias its own
   * spellings, this test fails and is rewritten.
   */
  test("`Grad` is ambiguous the moment English is installed beside German", () => {
    const both = createEngine({
      locales: [de, composeLocale(english, [angleEn])],
      kinds: [angle],
    });
    expect(() => both.evaluate("90 Grad")).toThrow(/ambiguous/i);
    // The two ways out a caller has, both of which are the caller's to choose.
    expect(both.evaluate("90 Grad", { locales: ["de"] }).value.unit).toBe("deg");
    expect(both.evaluate("90 Grad", { weights: { "locale:de": 1 } }).value.unit).toBe(
      "deg",
    );
    // And the German who writes the DIN name for the gradian never reaches the
    // tie at all: only the word `Grad` itself is claimed twice.
    expect(both.evaluate("200 Gon").value.unit).toBe("grad");
    expect(both.evaluate("2 Radiant").value.unit).toBe("rad");
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows four is all `german.selectForm` can ever ask for,
    // which is what gives the exact-match assertion its teeth (rule 6).
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 100, 1000]) {
        produced.add(
          german.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(angleDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Folded on both sides, which is German-specific rather than a loosening:
    // every German noun is capitalised, so the table prints `Grad` while the
    // alias index — whose keys `buildRegistry` writes through
    // `toLocaleLowerCase` — holds `grad`.
    for (const [unit, words] of Object.entries(angleDe.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(folded, `${unit} prints ${key}="${form}" but does not list it`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() => assertLocaleContract(de, [angle])).not.toThrow();
    // The default counts are all integers, so the fractional reading of CLDR
    // `other` is never reached at all. 1.5 is what makes the contract sample
    // it — "1,5 Umdrehungen", a plural, where Ukrainian's same row is a
    // genitive singular.
    expect(() =>
      assertLocaleContract(de, [angle], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the number axis moves on the feminine noun and nowhere else", () => {
    // Duden's Maßangabe rule: masculine and neuter measure nouns stay
    // uninflected after a numeral, so three of the four units answer one word
    // to every count.
    expect(word("deg", 1)).toBe("Grad");
    expect(word("deg", 90)).toBe("Grad");
    expect(word("deg", 1.5)).toBe("Grad");
    expect(word("rad", 2)).toBe("Radiant");
    expect(word("grad", 200)).toBe("Gon");
    // `die Umdrehung` is feminine, so this is the one pair here where the two
    // nominative rows are different words — and the pair that makes the number
    // axis measurable at all in this kind.
    expect(word("turn", 1)).toBe("Umdrehung");
    expect(word("turn", 2)).toBe("Umdrehungen");
    expect(word("turn", 1.5)).toBe("Umdrehungen");
  });

  test("a count-free conversion target is dative", () => {
    // The row no `Result` can reach: a conversion target names a unit with no
    // magnitude attached to it, so ruling R5 sends it to `dat-other`. German
    // writes the three measure nouns bare there ("in Grad") and the feminine
    // plural as itself ("in Umdrehungen"), so the case axis is inert in this
    // kind — which is exactly the opposite of the length units, where the same
    // slot prints "in Metern".
    for (const [unit, expected] of [
      ["rad", "Radiant"],
      ["deg", "Grad"],
      ["grad", "Gon"],
      ["turn", "Umdrehungen"],
    ] as const) {
      const key = german.selectForm({ kind: "angle", unit, slot: "conversion-target" });
      expect(key).toBe("dat-other");
      expect(angleDe.units[unit]?.forms?.[key]).toBe(expected);
    }
  });

  test("an engine built from it reads and writes German angles", () => {
    expect(engine.evaluate("90 Grad").formatted).toBe("90 Grad");
    expect(engine.evaluate("1 Grad").formatted).toBe("1 Grad");
    // The feminine pair, across the CLDR boundary in both directions.
    expect(engine.evaluate("1 Umdrehung").formatted).toBe("1 Umdrehung");
    expect(engine.evaluate("2 Umdrehungen").formatted).toBe("2 Umdrehungen");
    // A conversion, written with a German keyword and answered in German.
    expect(engine.evaluate("1 Umdrehung in Grad").formatted).toBe("360 Grad");
    expect(engine.evaluate("200 Gon nach Grad").formatted).toBe("180 Grad");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the feminine noun takes its plural.
    expect(engine.evaluate("0,5 Umdrehung + 0,25 Umdrehungen").formatted).toBe(
      "0,75 Umdrehungen",
    );
    expect(engine.evaluate("90 Grad + 45 Grad").formatted).toBe("135 Grad");
    // Latin input still reads, and answers in German.
    expect(engine.evaluate("2 deg").formatted).toBe("2 Grad");
    // The group separator, the exact inverse of English's, asserted as text and
    // kept out of the round trip below.
    expect(engine.evaluate("10 Umdrehungen in Grad").formatted).toBe("3.600 Grad");
  });

  test("its own output reads back to the same value", () => {
    // No row here crosses 1000: German groups with ".", which the lexer does
    // not read back as a group, so the grouped conversion above is asserted as
    // a string instead.
    for (const input of [
      "1 Umdrehung in Grad",
      "5 Umdrehungen",
      "0,5 Umdrehung + 0,25 Umdrehungen",
      "200 Gon",
      "1,5 Grad",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      expect(again.value.canonical.toFixed(20), input).toBe(
        first.value.canonical.toFixed(20),
      );
    }
  });
});
