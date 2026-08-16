import { DECIMAL_BRAND } from "./brand";

/**
 * Recursively freezes plain objects and arrays.
 *
 * Decimal instances are returned untouched — decimal.js mutates instance
 * internals, so freezing one would break arithmetic. Functions are left alone
 * too: this guards data, not code.
 *
 * The Decimal test used to be `value instanceof Decimal`, which meant this
 * module imported `./decimal` and so `decimal.js`, and so every caller did:
 * `defineVocabulary` calls `deepFreeze`, so naming a kind's words cost 33_400 B
 * of arithmetic engine to protect a table of nouns. The brand costs 272 B
 * instead, because it lives on `Decimal.prototype` (see `decimal.ts`) and this
 * file only has to know the symbol, never the class. At runtime it is a
 * property read one step up the prototype chain — the chain `instanceof` was
 * walking anyway.
 *
 * One precondition the old guard enforced for free, and this one does not:
 * `instanceof Decimal` forced this module to import `./decimal`, so the class
 * was always loaded and `Decimal.set({ precision: 28 })` had always run by the
 * time `deepFreeze` could be called. The brand carries no such guarantee. A
 * consumer who imports `@smartput/kind/freeze` — a published subpath — and
 * their own copy of decimal.js, without ever touching `@smartput/kind/decimal`,
 * gets an unbranded Decimal: this function will freeze it, and their arithmetic
 * runs at decimal.js’s ~20-digit default. Nothing inside this repo can reach
 * that state (`./decimal` is the only module here that imports decimal.js, and
 * anything holding a Decimal has loaded it), and a frozen Decimal was measured
 * to survive twenty-two operations without throwing, because the constructor
 * copies `v.d.slice()`. So it is a precision hazard, not a crash — and it is
 * stated here rather than guarded, because the guard is the import that this
 * change exists to remove.
 *
 * It is also *stricter* than what it replaced, which is the part worth
 * remembering. `Symbol.for` is realm-global, so two copies of decimal.js in one
 * bundle — a workspace package pinning a different minor, a consumer's own
 * dependency landing beside ours — still brand-match. `instanceof` against one
 * copy's constructor silently returns `false` for the other copy's instances,
 * and a silently-`false` guard here does not fall through to something safe: it
 * freezes a live Decimal, and the next `.times()` throws from inside a library
 * with no idea why. This closes that, and the byte count is the smaller half of
 * the reason.
 *
 * Freezing happens before recursion, so a cyclic descriptor terminates on the
 * isFrozen check rather than overflowing the stack.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if ((value as Record<symbol, unknown>)[DECIMAL_BRAND] === true) return value;
  if (Object.isFrozen(value)) return value;

  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
