import { expect, test } from "bun:test";
import { DECIMAL_BRAND } from "./brand";
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

test("skips anything branded on its prototype, not just our own Decimal", () => {
  // The stand-in for the case this guard exists to survive: a second copy of
  // decimal.js in the same bundle. Its instances are not `instanceof` our
  // Decimal, so the old check returned false and froze one — after which the
  // next `.times()` throws from inside a library that has no idea why.
  //
  // A real second copy cannot be installed here (bun dedupes one version, and
  // pinning a second for a unit test is a worse lie than this object). What is
  // actually under test is the mechanism that makes the foreign case work:
  // `Symbol.for` resolves to the same symbol wherever it is called, and the
  // brand is read off the prototype chain rather than off the instance.
  const foreign = Object.create({ [DECIMAL_BRAND]: true }) as Record<string, unknown>;
  foreign.d = "3";
  deepFreeze({ foreign });
  expect(Object.isFrozen(foreign)).toBe(false);
});

test("terminates on a cyclic structure", () => {
  const a: Record<string, unknown> = {};
  a.self = a;
  expect(() => deepFreeze(a)).not.toThrow();
  expect(Object.isFrozen(a)).toBe(true);
});
