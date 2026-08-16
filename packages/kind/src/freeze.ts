import { Decimal } from "./decimal";

/**
 * Recursively freezes plain objects and arrays.
 *
 * Decimal instances are returned untouched — decimal.js mutates instance
 * internals, so freezing one would break arithmetic. Functions are left alone
 * too: this guards data, not code.
 *
 * Freezing happens before recursion, so a cyclic descriptor terminates on the
 * isFrozen check rather than overflowing the stack.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Decimal) return value;
  if (Object.isFrozen(value)) return value;

  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
