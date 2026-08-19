import type { MatchCtx } from "@smartput/core";
import { LAST_ORDINAL, nthWeekdayOfMonth, parseOrdinalPhrase } from "./ordinal";
import { Temporal } from "./temporal";

/**
 * "first friday next month", "second monday in Aug 2027" — an ordinal, a
 * weekday, and the month the count runs inside.
 *
 * chrono has no rule for this shape, and its failure is the quiet kind: it
 * reads "second monday in Aug 2027" as *two* results — a bare "monday" (the
 * next one, this week) and an unrelated "Aug 2027" — and the bridge, which
 * takes the longest match anchored at the offset, would report the Monday four
 * days from now for a phrase that names a day in 2027. So the recognizer runs
 * ahead of chrono rather than after it: a phrase of this shape never reaches
 * the general parser at all.
 */

/** ISO weekday numbers: Monday is 1, Sunday is 7, as `PlainDate.dayOfWeek` counts. */
const WEEKDAYS: Readonly<Record<string, number>> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  weds: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 7,
  sun: 7,
};

/** Longest-first, for the reason `parseOrdinalPhrase` documents. */
const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).join("|");

export interface OrdinalWeekdayMatch {
  plain: Temporal.PlainDateTime;
  length: number;
  hasTime: boolean;
}

/**
 * Reads an ordinal-weekday phrase anchored at the start of `text`, or returns
 * null.
 */
export function parseOrdinalWeekday(
  text: string,
  ctx: MatchCtx,
): OrdinalWeekdayMatch | null {
  const phrase = parseOrdinalPhrase(text, WEEKDAY_PATTERN, ctx);
  if (phrase === null) return null;

  const weekday = WEEKDAYS[phrase.noun];
  if (weekday === undefined) return null;

  // "last friday" without a month is chrono's phrase, not this one: it means
  // the Friday just gone, and has meant that since M4. An ordinal has no such
  // reading — chrono cannot parse "second monday" at all — so a bare ordinal
  // counts inside the month the clock is in.
  if (!phrase.scoped && phrase.nth === LAST_ORDINAL) return null;

  const { scope } = phrase;
  const day = nthWeekdayOfMonth(scope.year, scope.month, phrase.nth, weekday);
  if (day === null) return null;

  return {
    plain: new Temporal.PlainDateTime(
      scope.year,
      scope.month,
      day,
      scope.hour,
      scope.minute,
      scope.second,
    ),
    length: phrase.length,
    hasTime: scope.hasTime,
  };
}
