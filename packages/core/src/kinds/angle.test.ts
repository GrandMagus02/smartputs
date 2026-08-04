import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import en from "../locale/en";
import { BUILTIN_KINDS } from "./index";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

test("degrees convert to radians", () => {
  expect(engine.evaluate("90 deg in rad").value.canonical.toFixed(10)).toBe(
    "1.5707963268",
  );
});

test("a quarter turn is 90 degrees", () => {
  expect(engine.evaluate("0.25 turn in deg").value.canonical.toFixed(6)).toBe("1.570796");
  // Irrational ratios (π/180, 2π) don't round-trip exactly at 28 significant digits.
  // formatValue renders the exact authored value, not a display-rounded one.
  expect(engine.evaluate("0.25 turn in deg").formatted).toBe(
    "90.00000000000000000000000005 degrees",
  );
});

test("gradians convert", () => {
  // Irrational ratios (π/200) don't round-trip exactly at 28 significant digits.
  // formatValue renders the exact authored value, not a display-rounded one.
  expect(engine.evaluate("200 grad in deg").formatted).toBe(
    "180.0000000000000000000000001 degrees",
  );
});

test("angles add", () => {
  expect(engine.evaluate("90 deg + 90 deg").formatted).toBe("180 degrees");
});
