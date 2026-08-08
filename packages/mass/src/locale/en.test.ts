import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { mass } from "../index";
import massEn from "./en";

describe("mass en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(mass.value.mode === "ratio" ? mass.value.units : {});
    expect(Object.keys(massEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(massEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(mass)).not.toMatch(/kilogram|pound|ounce|tonne/i);
  });

  test("an engine built from it reads and writes English mass", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [massEn])],
      kinds: [mass],
    });
    expect(engine.evaluate("1.5 kilograms").formatted).toBe("1.5 kilograms");
    expect(engine.evaluate("1 kg + 500 g").formatted).toBe("1.5 kilograms");
  });
});
