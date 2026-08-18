import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("length over duration is a speed", () => {
  const r = engine.evaluate("100 km / 2 h");
  expect(r.kind).toBe("speed");
  expect(r.value.canonical.toFixed(6)).toBe("13.888889");
});

test("a speed converts to another speed unit", () => {
  expect(engine.evaluate("100 km / 1 h in kph").formatted).toBe("100 km/h");
});
