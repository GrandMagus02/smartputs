import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { speed } from "../index";
import speedEn from "./en";

describe("speed en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(speed.value.mode === "ratio" ? speed.value.units : {});
    expect(Object.keys(speedEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(speedEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    // `mps`, `kph`, `mph` and `knot` are unit *ids* and stay on the kind. What
    // must not survive there is the words: the plural alias `knots`, the
    // abbreviation `kt`, the `kmh` spelling, and the `m/s` symbol.
    expect(JSON.stringify(speed)).not.toMatch(/knots|kt|kmh|m\/s/i);
  });

  test("an engine built from it reads and writes English speed", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [speedEn])],
      kinds: [speed],
    });
    // `knot` is the one unit with written-out forms, so it is the one that
    // prints as a word with a space; the other three print on their symbol.
    expect(engine.evaluate("1 knot").formatted).toBe("1 knot");
    expect(engine.evaluate("5 kt").formatted).toBe("5 knots");
    expect(engine.evaluate("1 kmh").formatted).toBe("1kph");
    expect(engine.evaluate("3 mps").formatted).toBe("3m/s");
  });
});
