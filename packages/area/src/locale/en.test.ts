import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { area } from "../index";
import areaEn from "./en";

describe("area en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `hectare` and `acre` are unit **ids**, so they stay in the descriptor and
  // cannot be grepped for. Their plural forms and the superscript symbols are
  // words, and those are the ones that must have left.
  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(area)).not.toMatch(/hectares|acres|²|\bha\b/i);
  });

  test("an engine built from it reads and writes English area", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [areaEn])],
      kinds: [area],
    });
    expect(engine.evaluate("1.5 hectares").formatted).toBe("1.5 hectares");
    expect(engine.evaluate("3 acres").formatted).toBe("3 acres");
    // The squared units carry no `forms`, so they render through the symbol
    // branch — number and symbol with no space, exactly as before the move.
    expect(engine.evaluate("2 m2 + 1 m2").formatted).toBe("3m²");
    expect(engine.evaluate("2 km²").formatted).toBe("2km²");
  });
});
