import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { measure } from "../index";
import measureEn from "./en";

describe("measure en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(measure.value.mode === "ratio" ? measure.value.units : {});
    expect(Object.keys(measureEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(measureEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    // `inch` and `px` are unit *ids*, so they stay on the kind — including as
    // `dpiUnit: "px"`. What must not survive there is a word a translator would
    // rewrite: the display forms are the whole of that set.
    //
    // The word boundaries are load-bearing rather than decorative: `typical`,
    // the key that replaced `lexicon` on the kind, contains "pica".
    expect(JSON.stringify(measure)).not.toMatch(
      /\b(millimetres?|centimetres?|pixels?|picas?|points?)\b/i,
    );
  });

  test("an engine built from it reads and writes English measure", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [measureEn])],
      kinds: [measure],
    });
    expect(engine.evaluate("1.5 inches").formatted).toBe("1.5 inches");
    expect(engine.evaluate("96 px in inch").formatted).toBe("1 inch");
  });
});
