import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as en } from "@smartput/locale-en";
import { power } from "@smartput/power";
import { energy } from "./index";

// The bridge signatures are useless without both sides registered: an op naming
// "power" resolves nothing if no kind claims that id. So the engine is
// BUILTIN_KINDS plus the pair, with the pair spliced in from source and
// filtered back out of the barrel — that way this file reads the same before
// and after the aggregator learns the two kinds, and pass 1 of `buildRegistry`
// never sees an id registered twice.
const PAIR = new Set(["energy", "power"]);
const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS.filter((k) => !PAIR.has(k.id)), energy, power],
});

test("power times duration is an energy", () => {
  const r = engine.evaluate("2 kw * 3 h");
  expect(r.kind).toBe("energy");
  expect(r.value.canonical.toString()).toBe("21600000");
});

test("the same product with the operands swapped", () => {
  const r = engine.evaluate("3 h * 2 kw");
  expect(r.kind).toBe("energy");
  expect(r.value.canonical.toString()).toBe("21600000");
});

test("2 kw * 3 h in kwh is 6 kwh", () => {
  expect(engine.evaluate("2 kw * 3 h in kwh").formatted).toBe("6kwh");
});

test("energy over duration is a power", () => {
  const r = engine.evaluate("6 kwh / 3 h");
  expect(r.kind).toBe("power");
  expect(r.value.canonical.toString()).toBe("2000");
});

test("energy over power is a duration", () => {
  const r = engine.evaluate("6 kwh / 2 kw");
  expect(r.kind).toBe("duration");
  expect(r.value.canonical.toString()).toBe("10800");
});

test("an energy converts to another energy unit", () => {
  expect(engine.evaluate("1 kcal in cal").formatted).toBe("1,000 calories");
  expect(engine.evaluate("1000 j in kj").formatted).toBe("1 kilojoule");
});
