import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { tempo } from "../index";
import tempoEn from "./en";

describe("tempo en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(tempo.value.mode === "ratio" ? tempo.value.units : {});
    expect(Object.keys(tempoEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(tempoEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(tempo)).not.toMatch(/hertz|beat/i);
  });

  test("bpm keeps no forms and hertz keeps both of its identical ones", () => {
    // "beats per minute" is a compound the lexer cannot read back, so bpm has
    // no written-out name to offer; hertz is a single word that is also its own
    // plural, so both English categories carry it.
    expect(tempoEn.units.bpm?.forms).toBeUndefined();
    expect(tempoEn.units.hz?.forms).toEqual({ one: "hertz", other: "hertz" });
  });

  test("an engine built from it reads and writes English tempo", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [tempoEn])],
      kinds: [tempo],
    });
    expect(engine.evaluate("120 bpm").formatted).toBe("120 bpm");
    expect(engine.evaluate("2 hertz").formatted).toBe("2 hertz");
    expect(engine.evaluate("3 hz in bpm").formatted).toBe("180 bpm");
  });
});
