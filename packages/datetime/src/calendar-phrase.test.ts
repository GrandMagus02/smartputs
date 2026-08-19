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
const unit = (input: string) => parseDateTime(input, 0, ctx)?.calendarUnit ?? null;

test("a week phrase opens on its Monday, not on the same weekday a week on", () => {
  // chrono reads "next week" as the following Thursday, 2026-01-22.
  expect(day("this week")).toBe("2026-01-12");
  expect(day("next week")).toBe("2026-01-19");
  expect(day("last week")).toBe("2026-01-05");
});

test("a month phrase opens on the 1st", () => {
  expect(day("this month")).toBe("2026-01-01");
  expect(day("next month")).toBe("2026-02-01");
  expect(day("last month")).toBe("2025-12-01");
});

test("a year phrase opens on 1 January", () => {
  expect(day("this year")).toBe("2026-01-01");
  expect(day("next year")).toBe("2027-01-01");
  expect(day("last year")).toBe("2025-01-01");
});

test("the other spellings of the same three offsets", () => {
  expect(day("coming month")).toBe("2026-02-01");
  expect(day("following week")).toBe("2026-01-19");
  expect(day("previous year")).toBe("2025-01-01");
  expect(day("current week")).toBe("2026-01-12");
  expect(day("the month")).toBe("2026-01-01");
});

test("the interval is reported, so a range kind can close it", () => {
  expect(unit("next week")).toBe("week");
  expect(unit("next month")).toBe("month");
  expect(unit("next year")).toBe("year");
  expect(unit("second week Aug 2027")).toBe("week");
});

test("an ordinal week opens on its own Monday", () => {
  // 2027-08-01 is a Sunday, so Mondays fall on the 2nd, 9th, 16th…
  expect(day("second week Aug 2027")).toBe("2027-08-09");
  expect(day("first week of next month")).toBe("2026-02-02");
});

test("a phrase that names a day is a day, and carries no interval", () => {
  expect(day("today")).toBe("2026-01-15");
  expect(unit("today")).toBeNull();
  expect(unit("friday")).toBeNull();
  expect(unit("2026-03-01")).toBeNull();
});

test("a counted offset is still a day that many units away", () => {
  // "in 3 weeks" names a day, not the week it falls in.
  expect(day("in 3 weeks")).toBe("2026-02-05");
  expect(unit("in 3 weeks")).toBeNull();
  expect(day("3 weeks ago")).toBe("2025-12-25");
});

test("next week monday still selects the day inside the week", () => {
  const match = parseDateTime("next week monday", 0, ctx);
  expect(match?.zdt.toPlainDate().toString()).toBe("2026-01-19");
  expect(match?.length).toBe(16);
  // A named day is a day: the interval label does not travel with it.
  expect(match?.calendarUnit).toBeUndefined();
});

test("a weekday inside a week phrase reaches the whole week", () => {
  expect(day("next week sunday")).toBe("2026-01-25");
  expect(day("this week friday")).toBe("2026-01-16");
});

test("a calendar phrase reads as a date and never as a time", () => {
  const match = parseDateTime("next week", 0, ctx);
  expect(match?.hasDate).toBe(true);
  expect(match?.hasTime).toBe(false);
});

test("the claim stops at the phrase", () => {
  expect(parseDateTime("next week + 3 d", 0, ctx)?.length).toBe(9);
  expect(parseDateTime("5 h + next month", 6, ctx)?.zdt.toPlainDate().toString()).toBe(
    "2026-02-01",
  );
});

test("`next day` is left to chrono, and stays tomorrow", () => {
  expect(day("next day")).toBe("2026-01-16");
  expect(unit("next day")).toBeNull();
});
