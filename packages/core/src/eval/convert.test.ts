import { expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { defineKind, normalizeKind } from "../kind/define";
import { fromCanonical, toCanonical } from "./convert";

const length = normalizeKind(
  defineKind({
    id: "length",
    value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000, cm: 0.01 } },
  }),
);

const temp = normalizeKind(
  defineKind({
    id: "temperature",
    value: {
      mode: "ratio",
      canonical: "c",
      units: { c: 1, f: { ratio: 5 / 9, offset: -32 } },
    },
  }),
);

const measure = normalizeKind(
  defineKind({
    id: "measure",
    value: {
      mode: "ratio",
      canonical: "inch",
      units: {
        inch: 1,
        px: { ratio: (c) => new Decimal(1).div((c.self.meta?.dpi as number) ?? 96) },
      },
    },
  }),
);

test("converts a unit to canonical", () => {
  expect(toCanonical(new Decimal(2), length, "km", "en").toString()).toBe("2000");
});

test("converts canonical back to a unit", () => {
  expect(fromCanonical(new Decimal(2000), length, "km", "en").toString()).toBe("2");
});

test("round-trips through an unrelated unit", () => {
  const canonical = toCanonical(new Decimal(150), length, "cm", "en");
  expect(fromCanonical(canonical, length, "m", "en").toString()).toBe("1.5");
});

test("applies the affine offset before the ratio", () => {
  // 212F -> (212 - 32) * 5/9 = 100C
  expect(toCanonical(new Decimal(212), temp, "f", "en").toString()).toBe("100");
});

test("reverses the affine offset on the way out", () => {
  expect(fromCanonical(new Decimal(100), temp, "f", "en").toString()).toBe("212");
});

test("a function ratio reads dpi from the value's meta", () => {
  expect(
    toCanonical(new Decimal(300), measure, "px", "en", { dpi: 300 }).toString(),
  ).toBe("1");
  expect(toCanonical(new Decimal(96), measure, "px", "en").toString()).toBe("1");
});
