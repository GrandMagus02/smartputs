import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { duration } from "../index";
import durationEn from "./en";

describe("duration en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(duration)).not.toMatch(
      /millisecond|second|minute|hour|day|week/i,
    );
  });

  test("an engine built from it reads and writes English duration", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [durationEn])],
      kinds: [duration],
    });
    expect(engine.evaluate("1.5 hours").formatted).toBe("1.5 hours");
    expect(engine.evaluate("1 h + 30 min").formatted).toBe("1.5 hours");
  });
});
