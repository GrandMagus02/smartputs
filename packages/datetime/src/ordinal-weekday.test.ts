import { expect, test } from "bun:test";
import type { MatchCtx } from "@smartput/core";
import { parseDateTime } from "./chrono-bridge";
import { TEST_NOW, TEST_ZONE } from "./temporal";

// The clock is 2026-01-15T12:00:00Z, a Thursday, and the engine zone is UTC.
const UNIT_ALIASES = new Set(["m", "min", "h", "d", "wk", "s", "week", "day", "month"]);

const ctx: MatchCtx = {
  locale: "en",
  now: TEST_NOW,
  timeZone: TEST_ZONE,
  isUnitAlias: (s) => UNIT_ALIASES.has(s),
};

const day = (input: string) =>
  parseDateTime(input, 0, ctx)?.zdt.toPlainDate().toString() ?? null;

test("first friday next month counts inside February", () => {
  // 2026-02-01 is a Sunday, so the first Friday is the 6th.
  expect(day("first friday next month")).toBe("2026-02-06");
});

test("second monday in Aug 2027 reads the month behind the `in`", () => {
  // 2027-08-01 is a Sunday: Mondays are the 2nd, 9th, 16th…
  expect(day("second monday in Aug 2027")).toBe("2027-08-09");
});

test("last friday of this month is the month's last, not the one just gone", () => {
  // 2026-01-31 is a Saturday, so the last Friday of January is the 30th.
  expect(day("last friday of this month")).toBe("2026-01-30");
});

test("a numeric ordinal reads the same as the word", () => {
  expect(day("3rd tuesday of september")).toBe("2026-09-15");
  expect(day("third tuesday of september")).toBe("2026-09-15");
});

test("weekday abbreviations are accepted", () => {
  expect(day("2nd wed of next month")).toBe("2026-02-11");
  expect(day("first sat of march")).toBe("2026-03-07");
});

test("a bare ordinal counts inside the month the clock is in", () => {
  // 2026-01-01 is a Thursday, so the first Monday of January is the 5th.
  expect(day("first monday")).toBe("2026-01-05");
  expect(day("first monday of the month")).toBe("2026-01-05");
});

test("a month scope in the past stays in the past", () => {
  // 2025-12-01 is a Monday; the last Monday of December 2025 is the 29th.
  expect(day("last monday of last month")).toBe("2025-12-29");
});

test("an occurrence the month does not have is not a date", () => {
  // February 2026 has four Fridays: the 6th, 13th, 20th and 27th.
  expect(parseDateTime("fifth friday of next month", 0, ctx)).toBeNull();
});

test("bare `last friday` is still chrono's Friday just gone", () => {
  expect(day("last friday")).toBe("2026-01-09");
});

test("a tail naming a day is refused rather than half-read", () => {
  // "of march 5" is not a month scope, so the phrase is not of this shape and
  // the ordinal falls back to the reference month, claiming only its own words.
  expect(parseDateTime("first friday of march 5", 0, ctx)?.length).toBe(12);
});

test("the claim stops before a zone conversion", () => {
  const match = parseDateTime("first friday next month in tokyo", 0, ctx);
  expect(match?.length).toBe("first friday next month".length);
  expect(match?.zdt.toPlainDate().toString()).toBe("2026-02-06");
});

test("a clock time in the tail is carried, and reported as a time", () => {
  const match = parseDateTime("first friday of next month at 9am", 0, ctx);
  expect(match?.zdt.toString()).toBe("2026-02-06T09:00:00+00:00[UTC]");
  expect(match?.hasTime).toBe(true);
});

test("no clock time means midnight, and no time reading", () => {
  const match = parseDateTime("first friday next month", 0, ctx);
  expect(match?.hasTime).toBe(false);
  expect(match?.hasDate).toBe(true);
});

test("the phrase is claimed at an offset, not from the string start", () => {
  expect(day("3 d + first friday next month")).toBe(null);
  expect(parseDateTime("3 d + first friday next month", 6, ctx)?.length).toBe(23);
});

test("arithmetic after the phrase is left to the solver", () => {
  expect(parseDateTime("first friday next month + 3 d", 0, ctx)?.length).toBe(23);
});
