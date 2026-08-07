import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { volume } from "../index";
import volumeEn from "./en";

describe("volume en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(volume.value.mode === "ratio" ? volume.value.units : {});
    expect(Object.keys(volumeEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(volumeEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    // `gal` and `pint` are unit *ids*, not English words, so they stay. What
    // must be gone is every word only a translator would touch.
    expect(JSON.stringify(volume)).not.toMatch(/litre|liter|gallon/i);
  });

  test("an engine built from it reads and writes English volume", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [volumeEn])],
      kinds: [volume],
    });
    expect(engine.evaluate("1.5 litres").formatted).toBe("1.5 litres");
    expect(engine.evaluate("1 l + 500 ml").formatted).toBe("1.5 litres");
  });
});
