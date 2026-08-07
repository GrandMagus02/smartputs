import { describe, expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { english } from "./english";

describe("english", () => {
  test("is a Language with the CLDR plural categories", () => {
    expect(english.id).toBe("en");
    expect(
      english.selectForm({
        count: new Decimal(1),
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("one");
    expect(
      english.selectForm({
        count: new Decimal(2),
        kind: "mass",
        unit: "kg",
        slot: "bare",
      }),
    ).toBe("other");
    expect(
      english.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
  });

  test("reads and spells cardinals through one table", () => {
    expect(english.numerals?.(["twenty", "two"])).toEqual({
      value: new Decimal(22),
      consumed: 2,
    });
    expect(english.spell?.(new Decimal(22))).toBe("twenty two");
  });

  test("claims the conversion keywords it always did", () => {
    expect(english.keywords.in).toEqual(["in", "to", "as"]);
  });
});
