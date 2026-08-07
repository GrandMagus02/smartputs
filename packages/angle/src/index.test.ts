import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as en } from "@smartput/locale-en";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("degrees convert to radians", () => {
  expect(engine.evaluate("90 deg in rad").value.canonical.toFixed(10)).toBe(
    "1.5707963268",
  );
});

test("a quarter turn is 90 degrees", () => {
  expect(engine.evaluate("0.25 turn in deg").value.canonical.toFixed(6)).toBe("1.570796");
  expect(engine.evaluate("0.25 turn in deg").formatted).toBe("90 degrees");
});

test("gradians convert", () => {
  expect(engine.evaluate("200 grad in deg").formatted).toBe("180 degrees");
});

test("angles add", () => {
  expect(engine.evaluate("90 deg + 90 deg").formatted).toBe("180 degrees");
});
