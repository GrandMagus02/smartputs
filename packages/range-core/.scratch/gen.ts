import { Temporal } from "@smartput/datetime";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "../src/snap";
import { WINDOWS } from "../src/windows";

const SNAPS = {
  "start of week": (z: Temporal.ZonedDateTime, w?: number) =>
    startOfWeek(z, { weekStart: w }),
  "end of week": (z: Temporal.ZonedDateTime, w?: number) =>
    endOfWeek(z, { weekStart: w }),
  "start of month": (z: Temporal.ZonedDateTime) => startOfMonth(z),
  "end of month": (z: Temporal.ZonedDateTime) => endOfMonth(z),
  "start of year": (z: Temporal.ZonedDateTime) => startOfYear(z),
  "end of year": (z: Temporal.ZonedDateTime) => endOfYear(z),
} as const;

// [instant, zone, snap, weekStart]
const CASES: [string, string, keyof typeof SNAPS, string][] = [
  // A Thursday.
  ["2026-01-15T12:00:00Z", "UTC", "start of week", "-"],
  ["2026-01-15T12:00:00Z", "UTC", "end of week", "-"],
  ["2026-01-15T12:00:00Z", "UTC", "start of month", "-"],
  ["2026-01-15T12:00:00Z", "UTC", "end of month", "-"],
  ["2026-01-15T12:00:00Z", "UTC", "start of year", "-"],
  ["2026-01-15T12:00:00Z", "UTC", "end of year", "-"],
  // A Sunday, which is where the two week starts disagree.
  ["2026-01-18T09:00:00Z", "UTC", "start of week", "-"],
  ["2026-01-18T09:00:00Z", "UTC", "start of week", "7"],
  ["2026-01-18T09:00:00Z", "UTC", "end of week", "7"],
  // A Monday: already on the boundary under the default, six days into the week
  // under a Sunday start.
  ["2026-01-19T00:30:00Z", "UTC", "start of week", "-"],
  ["2026-01-19T00:30:00Z", "UTC", "start of week", "7"],
  // February in a common year, and the leap year next door.
  ["2026-02-10T12:00:00Z", "UTC", "end of month", "-"],
  ["2028-02-10T12:00:00Z", "UTC", "end of month", "-"],
  // A zone that is not UTC: the boundary is local midnight, not 00:00Z.
  ["2026-01-15T12:00:00Z", "Europe/Kyiv", "start of month", "-"],
  ["2026-01-15T12:00:00Z", "Asia/Tokyo", "start of week", "-"],
  ["2026-01-15T12:00:00Z", "America/Los_Angeles", "start of week", "-"],
  // Santiago has no midnight on 2026-09-06: the day begins at 01:00 local.
  ["2026-09-06T15:00:00Z", "America/Santiago", "start of month", "-"],
  ["2026-09-06T15:00:00Z", "America/Santiago", "start of week", "-"],
  ["2026-09-06T15:00:00Z", "America/Santiago", "start of week", "7"],
  // The last day of a year, snapped both ways.
  ["2026-12-31T23:00:00Z", "UTC", "start of year", "-"],
  ["2026-12-31T23:00:00Z", "UTC", "end of year", "-"],
];

console.log("### snap");
for (const [instant, zone, snap, weekStart] of CASES) {
  const zdt = Temporal.Instant.from(instant).toZonedDateTimeISO(zone);
  const week = weekStart === "-" ? undefined : Number(weekStart);
  const out = SNAPS[snap](zdt, week);
  console.log(`${instant}\t${zone}\t${snap}\t${weekStart}\t${out.toString()}`);
}

console.log("### windows");
for (const [name, w] of Object.entries(WINDOWS)) {
  const wraps = w.wraps ? "wraps" : "open";
  console.log(`${name}\t-\twindow\t-\t${w.start}/${w.end} ${wraps}`);
}
