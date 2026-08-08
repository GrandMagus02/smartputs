import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { datasize } from "../index";
import datasizeEn from "./en";

describe("datasize en vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeEn.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeEn.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no English word", () => {
    expect(JSON.stringify(datasize)).not.toMatch(
      /byte|kilobyte|megabyte|gigabyte|terabyte|kibibyte|mebibyte|gibibyte|tebibyte/i,
    );
  });

  test("an engine built from it reads and writes English datasize", () => {
    const engine = createEngine({
      locales: [composeLocale(english, [datasizeEn])],
      kinds: [datasize],
    });
    expect(engine.evaluate("1.5 kilobytes").formatted).toBe("1.5 kilobytes");
    expect(engine.evaluate("1 kb + 500 b").formatted).toBe("1.5 kilobytes");
  });
});
