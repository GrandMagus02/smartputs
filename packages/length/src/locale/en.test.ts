import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { length } from "../index";
import lengthEn from "./en";

describe("length en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(length.value.mode === "ratio" ? length.value.units : {});
    expect(Object.keys(lengthEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(lengthEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(length)).not.toMatch(
      /millimetre|centimetre|metre|meter|inch|foot|feet|yard|mile/i,
    );
  });

  // The reservation that used to sit beside the `lexicon`: `in` is core's
  // conversion keyword, so an `in` alias is unreachable on the engine path and
  // registering it would make "in 3 days" read as an all-units phrase.
  test("`in` is spelled only as inch and inches", () => {
    expect(lengthEn.units.in?.aliases).toEqual(["inch", "inches"]);
    for (const words of Object.values(lengthEn.units)) {
      expect(words.aliases).not.toContain("in");
    }
  });

  test("an engine built from it reads and writes English length", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [lengthEn])],
      kinds: [length],
    });
    expect(engine.evaluate("1.5 kilometres").formatted).toBe("1.5 kilometres");
    expect(engine.evaluate("1 km + 500 m").formatted).toBe("1.5 kilometres");
    expect(engine.evaluate("7 inches").formatted).toBe("7 inches");
    expect(engine.evaluate("1 foot").formatted).toBe("1 foot");
  });
});
