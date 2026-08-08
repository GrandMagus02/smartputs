import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { percent } from "../index";
import percentEn from "./en";

describe("percent en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The kind id is the word "percent", so the grep is for the *spellings* a
  // translator would replace — the alias list's `pct`/`pcts`/`percents` — and
  // not for the id itself.
  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(percent)).not.toMatch(/pct|percents/i);
  });

  // No `forms`: the written form of this unit is its symbol. "20 percent"
  // parses, but rendering it that way would make every percentage read as a
  // word. That absence is the reason this vocabulary exists at all — it holds
  // the aliases, which are words, while the kind holds only the ratio.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentEn.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("an engine built from it reads and writes English percentages", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [percentEn])],
      kinds: [percent],
    });
    expect(engine.evaluate("20%").formatted).toBe("20%");
    expect(engine.evaluate("50 pct").formatted).toBe("50%");
    expect(engine.evaluate("20% of 50").formatted).toBe("10");
  });
});
