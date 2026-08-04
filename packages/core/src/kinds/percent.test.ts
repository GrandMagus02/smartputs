import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import en from "../locale/en";
import { BUILTIN_KINDS } from "./index";

const engine = createEngine({ locales: [en], kinds: BUILTIN_KINDS });

test("a bare percentage is a ratio", () => {
  const r = engine.evaluate("20%");
  expect(r.kind).toBe("percent");
  expect(r.value.canonical.toString()).toBe("0.2");
});

test("percent of a number", () => {
  const r = engine.evaluate("20% of 50");
  expect(r.kind).toBe("number");
  expect(r.value.canonical.toString()).toBe("10");
});

test("percent of a quantity keeps the quantity's kind and unit", () => {
  const r = engine.evaluate("10% of 2 km");
  expect(r.kind).toBe("length");
  expect(r.formatted).toBe("0.2km");
});

test("adding a percentage is relative to the left operand", () => {
  expect(engine.evaluate("50 + 20%").value.canonical.toString()).toBe("60");
  expect(engine.evaluate("1 kg + 20%").value.canonical.toString()).toBe("1200");
});

test("subtracting a percentage is relative too", () => {
  expect(engine.evaluate("50 - 20%").value.canonical.toString()).toBe("40");
});

// A percentage is a quantity like any other, so scaling it by a bare number
// is meaningful. `generateRatioOps` used to exclude percent from the
// number-scaling trio along with number, so these three threw
// DimensionMismatchError while the facade's `Percent.scale(3)` answered 60% —
// two public surfaces disagreeing about the same operation.
test("a percentage scales by a bare number in both orders", () => {
  expect(engine.evaluate("20% * 3").formatted).toBe("60%");
  expect(engine.evaluate("3 * 20%").formatted).toBe("60%");
  expect(engine.evaluate("20% * 3").kind).toBe("percent");
});

test("a percentage divides by a bare number", () => {
  expect(engine.evaluate("20% / 2").formatted).toBe("10%");
});

test("of binds tighter than plus", () => {
  expect(engine.evaluate("50 + 20% of 100").value.canonical.toString()).toBe("70");
});
