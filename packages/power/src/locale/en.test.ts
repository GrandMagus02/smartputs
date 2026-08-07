import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { power } from "../index";
import powerEn from "./en";

describe("power en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(power)).not.toMatch(/watt|horsepower/i);
  });

  test("horsepower spells both plural forms the same", () => {
    // "horsepower" is its own plural, and `other` is written out rather than
    // dropped: an absent `other` would fall back to the symbol, so "2 hp" would
    // read "2 hp" while "1 hp" read "1 horsepower" — one value formatted two
    // different ways. Asserted, not left to the comment.
    expect(powerEn.units.hp?.forms).toEqual({ one: "horsepower", other: "horsepower" });
  });

  test("an engine built from it reads and writes English power", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [powerEn])],
      kinds: [power],
    });
    expect(engine.evaluate("1.5 kilowatts").formatted).toBe("1.5 kilowatts");
    expect(engine.evaluate("1 kw + 500 w").formatted).toBe("1.5 kilowatts");
    expect(engine.evaluate("2 hp").formatted).toBe("2 horsepower");
  });
});
