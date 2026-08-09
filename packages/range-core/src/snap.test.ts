import { expect, test } from "bun:test";
import { Temporal } from "@smartput/datetime";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "./snap";

// Thursday 2026-01-15T12:00 UTC — the repo's fixed clock.
const now = Temporal.ZonedDateTime.from("2026-01-15T12:00:00+00:00[UTC]");

test("the week runs Monday to the next Monday, exclusive", () => {
  expect(startOfWeek(now).toString()).toStartWith("2026-01-12T00:00:00");
  expect(endOfWeek(now).toString()).toStartWith("2026-01-19T00:00:00");
});

test("the week start is configurable", () => {
  expect(startOfWeek(now, { weekStart: 7 }).toString()).toStartWith(
    "2026-01-11T00:00:00",
  );
});

test("the month runs to the first of the next", () => {
  expect(startOfMonth(now).toString()).toStartWith("2026-01-01T00:00:00");
  expect(endOfMonth(now).toString()).toStartWith("2026-02-01T00:00:00");
});

test("December rolls the year, not the month", () => {
  const dec = Temporal.ZonedDateTime.from("2026-12-20T12:00:00+00:00[UTC]");
  expect(endOfMonth(dec).toString()).toStartWith("2027-01-01T00:00:00");
});

test("the year runs to the first of the next", () => {
  expect(startOfYear(now).toString()).toStartWith("2026-01-01T00:00:00");
  expect(endOfYear(now).toString()).toStartWith("2027-01-01T00:00:00");
});

test("a leap day is inside its month", () => {
  const feb = Temporal.ZonedDateTime.from("2028-02-29T12:00:00+00:00[UTC]");
  expect(startOfMonth(feb).toString()).toStartWith("2028-02-01T00:00:00");
  expect(endOfMonth(feb).toString()).toStartWith("2028-03-01T00:00:00");
});

// A day already on the boundary must stay put rather than jump back a whole
// week. `(dayOfWeek - weekStart + 7) % 7` is what makes that true, and it is
// the one arm of the modulo the Thursday cases above never exercise.
test("a Monday snaps to itself", () => {
  const monday = Temporal.ZonedDateTime.from("2026-01-12T09:30:00+00:00[UTC]");
  expect(startOfWeek(monday).toString()).toStartWith("2026-01-12T00:00:00");
  expect(endOfWeek(monday).toString()).toStartWith("2026-01-19T00:00:00");
});

// Sunday is ISO weekday 7, the largest value: with a Monday week start it must
// snap backwards six days, not forwards one.
test("Sunday belongs to the week that just ended", () => {
  const sunday = Temporal.ZonedDateTime.from("2026-01-18T23:00:00+00:00[UTC]");
  expect(startOfWeek(sunday).toString()).toStartWith("2026-01-12T00:00:00");
  expect(startOfWeek(sunday, { weekStart: 7 }).toString()).toStartWith(
    "2026-01-18T00:00:00",
  );
});

// Snapping goes through `startOfDay()`, not `with({ hour: 0 })`, precisely so a
// zone whose DST transition happens at midnight reports the hour the day really
// begins. Santiago springs forward at 00:00 on 2026-09-06, so that day starts
// at 01:00 local and a `with({ hour: 0 })` implementation would silently
// produce a wall time that does not exist.
test("a day that starts at 01:00 is snapped to 01:00, not to a missing midnight", () => {
  const santiago = Temporal.ZonedDateTime.from("2026-09-06T15:00:00[America/Santiago]");
  expect(startOfWeek(santiago).toString()).toStartWith("2026-08-31T00:00:00");
  expect(startOfMonth(santiago).toString()).toStartWith("2026-09-01T00:00:00");
  // The 6th itself is the day with no midnight; snapping to it keeps 01:00.
  expect(santiago.startOfDay().toString()).toStartWith("2026-09-06T01:00:00");
});
