import { expect, test } from "bun:test";
import { WINDOWS } from "./windows";

test("night wraps midnight and the others do not", () => {
  expect(WINDOWS.night?.wraps).toBe(true);
  expect(WINDOWS.morning?.wraps).toBe(false);
});

test("morning is 06 to 12", () => {
  expect(WINDOWS.morning).toEqual({ start: 6, end: 12, wraps: false });
});

// The table is data a consumer merges overrides into, so it must be frozen:
// `{ ...WINDOWS, ...opts.windows }` is the supported way to change a window,
// and a package that mutated the shared object instead would change it for
// every other engine in the process.
test("the table is frozen so an override cannot be a mutation", () => {
  expect(Object.isFrozen(WINDOWS)).toBe(true);
});

// `wraps` is a stored flag rather than something each consumer recomputes, so
// the one invariant worth asserting is that the flag and the hours agree.
test("wraps is true exactly when the window's end is not after its start", () => {
  for (const [name, window] of Object.entries(WINDOWS)) {
    expect(`${name}:${window.wraps}`).toBe(`${name}:${window.end <= window.start}`);
  }
});

test("every window sits inside a 24-hour clock", () => {
  for (const window of Object.values(WINDOWS)) {
    expect(window.start).toBeGreaterThanOrEqual(0);
    expect(window.start).toBeLessThan(24);
    expect(window.end).toBeGreaterThanOrEqual(0);
    expect(window.end).toBeLessThanOrEqual(24);
    expect(Number.isInteger(window.start)).toBe(true);
    expect(Number.isInteger(window.end)).toBe(true);
  }
});
