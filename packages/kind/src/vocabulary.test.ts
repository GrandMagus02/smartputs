import { describe, expect, test } from "bun:test";
import { defineVocabulary } from "./vocabulary";

describe("defineVocabulary", () => {
  test("deep-freezes the whole table", () => {
    const v = defineVocabulary({
      locale: "en",
      kind: "mass",
      units: {
        kg: {
          aliases: ["kg"],
          symbol: "kg",
          forms: { one: "kilogram", other: "kilograms" },
        },
      },
    });
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.units)).toBe(true);
    expect(Object.isFrozen(v.units.kg)).toBe(true);
    expect(Object.isFrozen(v.units.kg?.aliases)).toBe(true);
    expect(Object.isFrozen(v.units.kg?.forms)).toBe(true);
  });
});
