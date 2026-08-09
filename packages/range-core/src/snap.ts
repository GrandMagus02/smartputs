import type { Temporal } from "@smartput/datetime";

export interface SnapOptions {
  /** ISO weekday the week starts on: 1 is Monday, 7 is Sunday. Defaults to 1. */
  weekStart?: number;
}

export const DEFAULT_WEEK_START = 1;

/**
 * Every boundary is `startOfDay()` of the target calendar date, and the date is
 * always chosen *before* the snap rather than after it.
 *
 * Two things force that order. First, a wall clock is not guaranteed to have a
 * midnight: Santiago springs forward at 00:00, so 2026-09-06 begins at 01:00
 * local and `with({ hour: 0 })` would name a time that does not exist there.
 * `startOfDay()` asks the zone when the day actually starts.
 *
 * Second, `startOfDay().subtract({ days: 6 })` is not the start of the day six
 * days back — date arithmetic on a `ZonedDateTime` preserves the wall clock, so
 * snapping the 6th to 01:00 and then walking back lands on 01:00 of the 31st, a
 * full hour into a day that does have a midnight. Walking first and snapping
 * last is the only order that lands on a day boundary at both ends.
 */
function dayStart(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return zdt.startOfDay();
}

/**
 * The start of the week containing `zdt`.
 *
 * `(dayOfWeek - start + 7) % 7` handles both arms without a branch: a day
 * already on the boundary walks back zero days, and a Sunday under a Monday
 * week start walks back six rather than forward one.
 */
export function startOfWeek(
  zdt: Temporal.ZonedDateTime,
  opts: SnapOptions = {},
): Temporal.ZonedDateTime {
  const start = opts.weekStart ?? DEFAULT_WEEK_START;
  const back = (zdt.dayOfWeek - start + 7) % 7;
  return dayStart(zdt.subtract({ days: back }));
}

/**
 * The **exclusive** end of that week — the instant the next one begins, per
 * design §3.1. `add({ weeks: 1 })` rather than `{ days: 7 }` goes through the
 * calendar, and the result is re-snapped for the reason `dayStart` explains.
 */
export function endOfWeek(
  zdt: Temporal.ZonedDateTime,
  opts: SnapOptions = {},
): Temporal.ZonedDateTime {
  return dayStart(startOfWeek(zdt, opts).add({ weeks: 1 }));
}

export function startOfMonth(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return dayStart(zdt.with({ day: 1 }));
}

/**
 * Exclusive: the first of the next month. `add({ months: 1 })` is what makes
 * December roll the year and February end on the 1st of March whether or not
 * the year is a leap year — the arithmetic is the calendar's, not ours.
 */
export function endOfMonth(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return dayStart(startOfMonth(zdt).add({ months: 1 }));
}

export function startOfYear(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return dayStart(zdt.with({ month: 1, day: 1 }));
}

/** Exclusive: January 1st of the following year. */
export function endOfYear(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return dayStart(startOfYear(zdt).add({ years: 1 }));
}
