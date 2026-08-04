import { expect, test } from "bun:test";
import { normalize } from "./normalize";

test("unifies dash variants to ASCII hyphen", () => {
  expect(normalize("5 − 3")).toBe("5 - 3");
  expect(normalize("5 – 3")).toBe("5 - 3");
  expect(normalize("5 — 3")).toBe("5 - 3");
});

test("strips zero-width characters", () => {
  expect(normalize("10​kg")).toBe("10kg");
});

test("applies NFKC so full-width digits fold to ASCII", () => {
  expect(normalize("１０ kg")).toBe("10 kg");
});

test("removes the degree sign so 20°C and 20C are identical", () => {
  expect(normalize("20°C")).toBe(normalize("20C"));
});

test("trims surrounding whitespace and collapses runs", () => {
  expect(normalize("  10   kg  ")).toBe("10 kg");
});
