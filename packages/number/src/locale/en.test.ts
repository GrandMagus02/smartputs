import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { number } from "../index";
import numberEn from "./en";

describe("number en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(number.value.mode === "ratio" ? number.value.units : {});
    expect(Object.keys(numberEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(numberEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // Every other kind greps its moved words out of the kind descriptor. This
  // one has none to grep: its single unit is *named* `one`, and that id stays
  // on the kind as a ratio-table key in any language. What left is the wrapper
  // the id was quoted inside — the alias list and the empty symbol — so that
  // is what this asserts is gone.
  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(number)).not.toMatch(/alias|symbol|lexicon/i);
  });

  test("an engine built from it reads and writes English numbers", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [numberEn])],
      kinds: [number],
    });
    expect(engine.evaluate("1.5").formatted).toBe("1.5");
    expect(engine.evaluate("2 + 3").formatted).toBe("5");
    // The self-alias stays inert on the engine path with the vocabulary
    // installed, exactly as it was with the lexicon — `validate.test.ts` pins
    // the same thing and says why.
    expect(() => engine.evaluate("1one")).toThrow();
  });
});
