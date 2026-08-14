import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureUk from "./uk";

const engine = createEngine({
  locales: [composeLocale(ukrainian, [measureUk])],
  kinds: [measure],
});

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = ukrainian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "measure",
    unit,
    slot,
  });
  return (measureUk.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("measure uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Ukrainian word", () => {
    expect(JSON.stringify(measure)).not.toMatch(/[Ѐ-ӿ]/);
  });

  test("satisfies the locale contract, fractional counts included", () => {
    // The default counts are all integers, so they never reach the CLDR "other"
    // category — the one Ukrainian spells with a genitive *singular*. 1.5 is
    // added so `nom-other` and `loc-other` are actually sampled.
    assertLocaleContract(composeLocale(ukrainian, [measureUk]), [measure], {
      counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("the three paradigms are three different decisions", () => {
    // Hard-stem masculine.
    expect(word("pt", 1)).toBe("пункт");
    expect(word("pt", 2)).toBe("пункти");
    expect(word("pt", 5)).toBe("пунктів");
    expect(word("pt", 1.5)).toBe("пункта");
    // Soft-stem masculine: the plural is `-і`, not the hard `-и` above.
    expect(word("px", 2)).toBe("пікселі");
    expect(word("px", 5)).toBe("пікселів");
    // Feminine: the nominative plural and the genitive singular coincide, and
    // the genitive plural is the bare stem rather than an `-ів` ending.
    expect(word("pc", 2)).toBe("піки");
    expect(word("pc", 1.5)).toBe("піки");
    expect(word("pc", 5)).toBe("пік");
  });

  test("a conversion target is locative, and `піка` alternates к→ц", () => {
    expect(word("pt", 1, "conversion-target")).toBe("пункті");
    expect(word("pt", undefined, "conversion-target")).toBe("пунктах");
    // The alternation an ending table would get wrong: `піці`, not `пікі`.
    expect(word("pc", 1, "conversion-target")).toBe("піці");
  });

  test("an engine built from it reads and writes Ukrainian typography", () => {
    expect(engine.evaluate("1 дюйм в пунктах").formatted).toBe("72 пункти");
    expect(engine.evaluate("72 пункти в дюймах").formatted).toBe("1 дюйм");
    expect(engine.evaluate("1 дюйм в пікселях").formatted).toBe("96 пікселів");
    // Latin aliases still read: a designer types `pt` whatever the keyboard is.
    expect(engine.evaluate("6 pc в дюймах").formatted).toBe("1 дюйм");
    // A fraction takes the genitive singular, not a plural.
    expect(engine.evaluate("1 дюйм - 12 пунктів").formatted).toBe(
      "0,83333333333333333333333333 дюйма",
    );
  });
});
