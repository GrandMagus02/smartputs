import type { MatchCtx } from "@smartput/core";
import { LAST_ORDINAL, nthWeekdayOfMonth, parseOrdinalPhrase } from "./ordinal";
import { Temporal } from "./temporal";

/**
 * "next week", "last month", "this year", "second week Aug 2027" — phrases that
 * name a *calendar interval*, resolved to the interval's first day.
 *
 * chrono resolves "next week" to the same weekday one week on (a Thursday, for
 * a Thursday reference) and "next year" to the same date next year, which is
 * neither what a person means by the phrase nor what the range packages
 * downstream can build a span out of. Every phrase here therefore lands on the
 * interval's opening midnight, and reports which interval it opened so that
 * `@smartput/datetime-range` can close it.
 *
 * Ahead of chrono rather than as a correction after it, for the reason the
 * ordinal grammars are: a phrase this file claims never reaches the general
 * parser, so there is one answer rather than one answer and a fix-up.
 */

/** The intervals a phrase can name. `day` is deliberately absent — see below. */
export type CalendarUnit = "week" | "month" | "year";

/**
 * No `day` row, and none of the "whole X" spellings `@smartput/date-range`
 * carries in its phrase table.
 *
 * "next day" already reads as tomorrow through chrono and the datetime-range
 * tests pin it as a plain instant rather than a span; claiming it here would
 * turn it into a span and break a documented reading for no gain, since
 * "tomorrow" says the same thing. "whole week" and its siblings are
 * `date-range`'s own invention rather than anything chrono ever read, so they
 * stay that package's — recorded in the follow-ups as the one place these two
 * grammars do not line up.
 */
const OFFSETS: Readonly<Record<string, number>> = {
  this: 0,
  current: 0,
  the: 0,
  next: 1,
  coming: 1,
  following: 1,
  last: -1,
  previous: -1,
};

const UNITS: Readonly<Record<string, CalendarUnit>> = {
  week: "week",
  month: "month",
  year: "year",
};

const PHRASE = new RegExp(
  `^(${Object.keys(OFFSETS).join("|")})\\s+(${Object.keys(UNITS).join("|")})\\b`,
  "iu",
);

/** Longest-first, for the reason `parseOrdinalPhrase` documents. */
const WEEK_NOUN = "week";

const PLURAL: Record<CalendarUnit, "weeks" | "months" | "years"> = {
  week: "weeks",
  month: "months",
  year: "years",
};

/**
 * The ISO week, Monday to Sunday, and not configurable here.
 *
 * `@smartput/range-core` has a `weekStart` dial and `@smartput/date-range`
 * passes it through; this package sits *below* range-core and cannot import it,
 * and `parseDateTime` is a free function four packages call, so a dial here
 * would have to be threaded through every one of them. Monday is
 * `DEFAULT_WEEK_START` over there, so the two agree unless an embedder changes
 * it — which is in the follow-ups.
 */
const ISO_WEEK_START = 1;
const DAYS_PER_WEEK = 7;

export interface CalendarPhraseMatch {
  /** Opening midnight of the interval. */
  zdt: Temporal.ZonedDateTime;
  unit: CalendarUnit;
  length: number;
}

/** The first instant of the interval `zdt` falls in. */
export function startOfUnit(
  zdt: Temporal.ZonedDateTime,
  unit: CalendarUnit,
): Temporal.ZonedDateTime {
  if (unit === "year") return zdt.with({ month: 1, day: 1 }).startOfDay();
  if (unit === "month") return zdt.with({ day: 1 }).startOfDay();
  // Walk the calendar first and snap last, the order `range-core`'s `dayStart`
  // explains: a wall clock is not guaranteed to have a midnight, and date
  // arithmetic on a `ZonedDateTime` preserves the wall clock rather than the
  // day boundary.
  const back = (zdt.dayOfWeek - ISO_WEEK_START + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return zdt.subtract({ days: back }).startOfDay();
}

function nowIn(ctx: MatchCtx): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(ctx.timeZone);
}

/**
 * "second week Aug 2027" — the same counting `parseOrdinalWeekday` does, landing
 * on the week's first day. `@smartput/date-range` reads the same phrase into a
 * span; both go through `parseOrdinalPhrase`, so the two cannot disagree about
 * which August is meant or where "of" may be left out.
 */
function ordinalWeek(text: string, ctx: MatchCtx): CalendarPhraseMatch | null {
  const phrase = parseOrdinalPhrase(text, WEEK_NOUN, ctx);
  if (phrase === null) return null;
  // "last week" with no month is the relative phrase below, not the last week
  // of anything. Only a named month gives `last` a month to count back from.
  if (!phrase.scoped && phrase.nth === LAST_ORDINAL) return null;

  const { scope } = phrase;
  const day = nthWeekdayOfMonth(scope.year, scope.month, phrase.nth, ISO_WEEK_START);
  if (day === null) return null;

  return {
    zdt: Temporal.PlainDate.from({
      year: scope.year,
      month: scope.month,
      day,
    }).toZonedDateTime(ctx.timeZone),
    unit: "week",
    length: phrase.length,
  };
}

/** "next week", "last month", "this year" — an interval relative to now. */
function relative(text: string, ctx: MatchCtx): CalendarPhraseMatch | null {
  const match = PHRASE.exec(text);
  if (match === null) return null;

  const offset = OFFSETS[match[1]?.toLowerCase() ?? ""];
  const unit = UNITS[match[2]?.toLowerCase() ?? ""];
  if (offset === undefined || unit === undefined) return null;

  const now = nowIn(ctx);
  // The shift happens before the snap and goes through the calendar, the order
  // `date-range`'s `spanFor` sets out: "next month" from the 31st has to land in
  // the month after this one, which `add({ months: 1 })` clamps and a
  // snap-then-shift would overshoot.
  const shifted = offset === 0 ? now : now.add({ [PLURAL[unit]]: offset });
  return { zdt: startOfUnit(shifted, unit), unit, length: match[0].length };
}

/**
 * Reads a calendar-interval phrase anchored at the start of `text`, or returns
 * null. The ordinal form is tried first: "second week" opens with a word the
 * relative table does not have, so the two cannot both match, but the order
 * makes that a fact of the code rather than of the tables.
 */
export function parseCalendarPhrase(
  text: string,
  ctx: MatchCtx,
): CalendarPhraseMatch | null {
  return ordinalWeek(text, ctx) ?? relative(text, ctx);
}
