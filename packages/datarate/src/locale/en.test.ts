import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { datarate } from "../index";
import datarateEn from "./en";

describe("datarate en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datarate.value.mode === "ratio" ? datarate.value.units : {},
    );
    expect(Object.keys(datarateEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datarateEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The ruling `units.ts` records, restated where the words now live: a written
  // form is a compound ("megabits per second") that the lexer cannot read back,
  // so no unit here declares one. `formatValue` stays on the symbol because of
  // it, which is why "2 gbps in mbps" prints without a space below.
  test("no unit declares a written form", () => {
    for (const [unit, words] of Object.entries(datarateEn.units)) {
      expect(words.forms, `${unit} declares a form`).toBeUndefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(datarate)).not.toMatch(/bit|byte|second|per/i);
  });

  test("an engine built from it reads and writes English datarate", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [datarateEn])],
      kinds: [datarate],
    });
    expect(engine.evaluate("100 mbps").formatted).toBe("100 mbps");
    expect(engine.evaluate("2 gbps in mbps").formatted).toBe("2,000 mbps");
  });
});
