import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { angle } from "../index";
import angleEn from "./en";

describe("angle en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(angle)).not.toMatch(/radian|degree|gradian|turns/i);
  });

  test("an engine built from it reads and writes English angle", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [angleEn])],
      kinds: [angle],
    });
    expect(engine.evaluate("1.5 radians").formatted).toBe("1.5 radians");
    expect(engine.evaluate("90 deg + 90 deg").formatted).toBe("180 degrees");
  });
});
