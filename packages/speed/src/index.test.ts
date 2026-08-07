import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { english as en } from "@smartput/locale-en";

const engine = createEngine({
  locales: [composeLocale(en)],
  kinds: BUILTIN_KINDS,
});

test("length over duration is a speed", () => {
  const r = engine.evaluate("100 km / 2 h");
  expect(r.kind).toBe("speed");
  expect(r.value.canonical.toFixed(6)).toBe("13.888889");
});

test("a speed converts to another speed unit", () => {
  expect(engine.evaluate("100 km / 1 h in kph").formatted).toBe("100kph");
});
