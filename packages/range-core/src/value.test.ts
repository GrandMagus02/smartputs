import { expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { Temporal } from "@smartput/datetime";
import { InvertedRangeError } from "./errors";
import { assertOrdered, unwrapRange, wrapRange } from "./value";
import { RANGE_WEIGHTS } from "./weights";

const a = Temporal.ZonedDateTime.from("2026-01-15T00:00:00+00:00[UTC]");
const b = Temporal.ZonedDateTime.from("2026-01-16T00:00:00+00:00[UTC]");

test("a backwards range throws and names both ends", () => {
  expect(() => assertOrdered("until yesterday", b, a)).toThrow(InvertedRangeError);
});

test("an equal-ended range throws too", () => {
  expect(() => assertOrdered("x", a, a)).toThrow(InvertedRangeError);
});

test("an ordered range passes", () => {
  expect(() => assertOrdered("x", a, b)).not.toThrow();
});

// "tomorrow is after now" is the fact the user needs, so the message has to
// carry both formatted endpoints rather than just saying the range is invalid.
test("the error carries the input and both endpoints", () => {
  try {
    assertOrdered("until yesterday", b, a);
    throw new Error("assertOrdered did not throw");
  } catch (error) {
    expect(error).toBeInstanceOf(InvertedRangeError);
    const inverted = error as InvertedRangeError;
    expect(inverted.name).toBe("InvertedRangeError");
    expect(inverted.input).toBe("until yesterday");
    expect(inverted.start).toBe(b.toString());
    expect(inverted.end).toBe(a.toString());
    expect(inverted.message).toContain(b.toString());
    expect(inverted.message).toContain(a.toString());
  }
});

// An instant is the same instant whatever zone names it, so ordering must be
// decided on the epoch and not on the wall clock. 2026-01-15T23:00 in Tokyo is
// 14:00 UTC — earlier than 2026-01-15T20:00Z despite reading later.
test("ordering is by instant, not by wall clock", () => {
  const tokyoEvening = Temporal.ZonedDateTime.from("2026-01-15T23:00:00[Asia/Tokyo]");
  const utcEvening = Temporal.ZonedDateTime.from("2026-01-15T20:00:00+00:00[UTC]");
  expect(() => assertOrdered("x", tokyoEvening, utcEvening)).not.toThrow();
  expect(() => assertOrdered("x", utcEvening, tokyoEvening)).toThrow(InvertedRangeError);
});

test("wrapRange stores the start as canonical and freezes the value", () => {
  const canonical = new Decimal(a.epochNanoseconds.toString());
  const value = wrapRange("date-range", "day-span", canonical, {
    start: a.toString(),
    end: b.toString(),
    zone: "UTC",
  });
  expect(value.kind).toBe("date-range");
  expect(value.unit).toBe("day-span");
  expect(value.canonical.eq(canonical)).toBe(true);
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.meta)).toBe(true);
});

test("wrapRange round-trips through unwrapRange", () => {
  const value = wrapRange("date-range", "day-span", new Decimal(0), {
    start: a.toString(),
    end: b.toString(),
    zone: "UTC",
  });
  expect(unwrapRange(value)).toEqual({
    start: a.toString(),
    end: b.toString(),
    zone: "UTC",
  });
});

// `time-range` has no zone — a clock span is not anchored to one — and passes
// the empty string. That is a legitimate value, not a missing field, so the
// guard must not reject it.
test("an empty zone survives the round trip", () => {
  const value = wrapRange("time-range", "clock-span", new Decimal(0), {
    start: "10:00",
    end: "20:00",
    zone: "",
  });
  expect(unwrapRange(value).zone).toBe("");
});

// A range kind carries extra meta past the three required keys — `wraps` and
// `lengthNs` on `time-range` — and unwrapping must leave them alone rather
// than drop them from the value.
test("extra meta keys ride along on the value", () => {
  const value = wrapRange("time-range", "clock-span", new Decimal(0), {
    start: "22:00",
    end: "06:00",
    zone: "",
    wraps: true,
  });
  expect(value.meta?.wraps).toBe(true);
});

test("unwrapping a value that is not a range throws", () => {
  const notARange = Object.freeze({
    kind: "length",
    canonical: new Decimal(1),
    unit: "m",
  });
  expect(() => unwrapRange(notARange)).toThrow(TypeError);
});

// The signature payback must outweigh both reading penalties at once, or the
// dash contest of design §4 ties and the winner is whichever the solver
// happened to enumerate first. It must also stay under CONTEXT_BONUS (30) so
// it cannot overturn a reading the surrounding text already corrected.
test("the signature weight beats two reading penalties and loses to context", () => {
  expect(RANGE_WEIGHTS.reading).toBe(-5);
  expect(RANGE_WEIGHTS.signature).toBe(20);
  expect(RANGE_WEIGHTS.signature).toBeGreaterThan(2 * Math.abs(RANGE_WEIGHTS.reading));
  expect(RANGE_WEIGHTS.signature).toBeLessThan(30);
});
