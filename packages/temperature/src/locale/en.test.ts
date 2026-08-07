import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english } from "@smartput/locale-en";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";

const [readingEn, deltaEn] = temperatureEn;

describe("temperature en vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureEn.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureEn) expect(vocabulary.locale).toBe("en");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingEn?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaEn?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureEn) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.length,
          `${vocabulary.kind}:${unit} has no aliases`,
        ).toBeGreaterThan(0);
        expect(words.symbol, `${vocabulary.kind}:${unit} has no symbol`).toBeDefined();
      }
    }
  });

  // The two kinds answer to the same words on purpose — that is what lets
  // "20 C + 5 F" read its right operand as a difference — and it is also what
  // makes every temperature alias ambiguous, which `print/unit-word.ts`'s
  // ambiguity fallback is written against. Two lists that drifted apart would
  // silently disarm it.
  test("both kinds register the identical alias list, decorative entries included", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaEn?.units[unit]?.aliases).toEqual(
        readingEn?.units[unit]?.aliases ?? [],
      );
    }
    expect(readingEn?.units.c?.aliases).toContain("°c");
    expect(deltaEn?.units.c?.aliases).toContain("°c");
  });

  test("the kinds themselves carry no English word", () => {
    expect(JSON.stringify(temperature)).not.toMatch(
      /celsius|fahrenheit|kelvin|centigrade/i,
    );
    expect(JSON.stringify(tempdelta)).not.toMatch(
      /celsius|fahrenheit|kelvin|centigrade/i,
    );
  });

  test("an engine built from it reads and writes English temperature", () => {
    const engine = createEngine({
      locales: [composeLocale(english, temperatureEn)],
      kinds: [temperature, tempdelta],
    });
    expect(engine.evaluate("212 F in C").formatted).toBe("100°C");
    expect(engine.evaluate("20 celsius").formatted).toBe("20°C");
    expect(engine.evaluate("30 C - 20 C").formatted).toBe("10°C");
  });
});
