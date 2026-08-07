import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import coreEn from "@smartput/core/locale/en";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { time } from "@smartput/time";
import { createTimeRange, timeRange } from "./time-range";

const build = (kinds: unknown[]) =>
  createEngine({
    locales: [composeLocale(coreEn)],
    kinds: [...BUILTIN_KINDS, datetime, time, ...(kinds as never[])],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });

const engine = build([timeRange]);

test("a dash between two clock times is a range, not a subtraction", () => {
  const r = engine.evaluate("10:00 - 20:00");
  expect(r.kind).toBe("time-range");
  expect(r.formatted).toBe("10:00 → 20:00");
});

test("`to` reads the same way", () => {
  expect(engine.evaluate("10:00 to 20:00").kind).toBe("time-range");
});

test("dashWeight 0 gives the dash back to subtraction", () => {
  const subtracting = build([createTimeRange({ dashWeight: 0 })]);
  expect(subtracting.evaluate("10:00 - 20:00").kind).toBe("duration");
});

test("two datetimes still subtract to a duration", () => {
  const r = engine.evaluate("tomorrow - today");
  expect(r.kind).toBe("duration");
  expect(r.formatted).toBe("1 day");
});

test("a time minus a duration is still a time", () => {
  expect(engine.evaluate("3pm - 1 h", { kinds: ["time", "duration"] }).kind).toBe("time");
});

test("a backwards clock span wraps instead of throwing", () => {
  const r = engine.evaluate("20:00 - 06:00");
  expect(r.kind).toBe("time-range");
  expect(r.value.meta?.wraps).toBe(true);
});

test("named windows", () => {
  expect(engine.evaluate("morning").formatted).toBe("06:00 → 12:00");
  expect(engine.evaluate("evening").formatted).toBe("18:00 → 22:00");
  expect(engine.evaluate("night").formatted).toBe("22:00 → 06:00");
  expect(engine.evaluate("night").value.meta?.wraps).toBe(true);
});

test("the window table is configurable", () => {
  const late = build([
    createTimeRange({ windows: { night: { start: 21, end: 5, wraps: true } } }),
  ]);
  expect(late.evaluate("night").formatted).toBe("21:00 → 05:00");
});
