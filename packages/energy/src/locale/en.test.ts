import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { energy } from "../index";
import energyEn from "./en";

describe("energy en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(energy)).not.toMatch(/joule|calorie|watt/i);
  });

  test("the watt-hour family still ships no forms", () => {
    // Their written-out forms are compounds ("watt hours") that the lexer
    // cannot produce as one token, so absent `forms` is what keeps the
    // formatter on the symbol. Asserted, not assumed: a well-meaning
    // translator adding them would silently break the round trip.
    for (const unit of ["wh", "kwh", "mwh"]) {
      expect(energyEn.units[unit]?.forms, `${unit} has forms`).toBeUndefined();
    }
  });

  test("an engine built from it reads and writes English energy", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [energyEn])],
      kinds: [energy],
    });
    expect(engine.evaluate("1.5 kilojoules").formatted).toBe("1.5 kilojoules");
    expect(engine.evaluate("1 kj + 500 j").formatted).toBe("1.5 kilojoules");
  });
});
