import { expect, test } from "bun:test";
import { Decimal } from "./decimal";
import { deepFreeze } from "./freeze";

test("freezes nested objects and arrays", () => {
  const o = deepFreeze({ a: { b: [1, 2] } });
  expect(Object.isFrozen(o)).toBe(true);
  expect(Object.isFrozen(o.a)).toBe(true);
  expect(Object.isFrozen(o.a.b)).toBe(true);
});

test("returns primitives unchanged", () => {
  expect(deepFreeze(5)).toBe(5);
  expect(deepFreeze("x")).toBe("x");
  expect(deepFreeze(null)).toBe(null);
});

test("leaves Decimal instances unfrozen so arithmetic still works", () => {
  const d = new Decimal(3);
  deepFreeze({ d });
  expect(Object.isFrozen(d)).toBe(false);
  expect(d.times(2).toString()).toBe("6");
});

test("terminates on a cyclic structure", () => {
  const a: Record<string, unknown> = {};
  a.self = a;
  expect(() => deepFreeze(a)).not.toThrow();
  expect(Object.isFrozen(a)).toBe(true);
});
