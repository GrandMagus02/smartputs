import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as coreEn } from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { time } from "@smartput/time";
import {
  createDatetimeRange,
  DEFAULT_CALENDAR_SPAN_WEIGHT,
  datetimeRange,
} from "./datetime-range";

const engineWith = (kind = datetimeRange) =>
  createEngine({
    locales: [composeLocale(coreEn, BUILTIN_EN)],
    kinds: [...BUILTIN_KINDS, datetime, date, time, kind],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });

const engine = engineWith();
const read = (input: string) => {
  const result = engine.evaluate(input);
  return `${result.kind}: ${result.formatted}`;
};

test("a relative interval becomes the span it names", () => {
  expect(read("next week")).toBe(
    "datetime-range: 2026-01-19 00:00 → 2026-01-26 00:00 UTC",
  );
  expect(read("last month")).toBe(
    "datetime-range: 2025-12-01 00:00 → 2026-01-01 00:00 UTC",
  );
  expect(read("next year")).toBe(
    "datetime-range: 2027-01-01 00:00 → 2028-01-01 00:00 UTC",
  );
});

test("the ordinal-week grammar reads here too", () => {
  expect(read("second week Aug 2027")).toBe(
    "datetime-range: 2027-08-09 00:00 → 2027-08-16 00:00 UTC",
  );
  expect(read("first week of next month")).toBe(
    "datetime-range: 2026-02-02 00:00 → 2026-02-09 00:00 UTC",
  );
});

test("an ordinal weekday is a day, and stays a datetime", () => {
  expect(read("first friday next month")).toBe("datetime: 2026-02-06 00:00 UTC");
  expect(read("next week monday")).toBe("datetime: 2026-01-19 00:00 UTC");
});

test("the endpoints of `from X to Y` speak the same grammar", () => {
  expect(read("from first friday next month to second monday in Aug 2027")).toBe(
    "datetime-range: 2026-02-06 00:00 → 2027-08-09 00:00 UTC",
  );
});

test("the window grammar is untouched", () => {
  expect(read("yesterday morning")).toBe(
    "datetime-range: 2026-01-14 06:00 → 2026-01-14 12:00 UTC",
  );
  // "next day" is excluded from the window grammar and from the interval one.
  expect(read("next day")).toBe("datetime: 2026-01-16 00:00 UTC");
});

test("zeroing the calendar weight hands the phrase back to datetime", () => {
  const bare = createEngine({
    locales: [composeLocale(coreEn, BUILTIN_EN)],
    kinds: [...BUILTIN_KINDS, datetime, createDatetimeRange({ calendarSpanWeight: -1 })],
    now: () => TEST_NOW,
    timeZone: TEST_ZONE,
  });
  expect(bare.evaluate("next week").kind).toBe("datetime");
});

test("the calendar span is weighted to lose to @smartput/date-range", () => {
  // That package's `DEFAULT_PHRASE_WEIGHT` is 5, and a whole-day span reads
  // better as `2026-01-19 → 2026-01-25` than as two midnights. The number is
  // restated rather than imported: reaching for it would make a devDependency
  // cycle between the two range packages out of a one-number fact.
  expect(DEFAULT_CALENDAR_SPAN_WEIGHT).toBeLessThan(5);
  // Still positive, so an engine without `date-range` answers with the span.
  expect(DEFAULT_CALENDAR_SPAN_WEIGHT).toBeGreaterThan(0);
});
