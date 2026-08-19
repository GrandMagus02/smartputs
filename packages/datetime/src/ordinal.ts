import type { MatchCtx } from "@smartput/core";
import * as chrono from "chrono-node";
import { beforeOperator } from "./operator-cut";
import { referenceFor } from "./reference";
import { Temporal } from "./temporal";

/**
 * The pieces every "nth <thing> of <month>" phrase is built from: the ordinal,
 * the month the count runs inside, and the arithmetic that turns the two into a
 * calendar day.
 *
 * Its own module because two packages count the same way. `@smartput/datetime`
 * reads "first friday next month" as a day; `@smartput/date-range` reads
 * "second week Aug 2027" as a span. Both need the ordinal words, both need the
 * month scope, and a second copy of either would let the two grammars disagree
 * about which September "of september" means.
 *
 * English-only, like everything else this package spells in words
 * (`OPERATOR_TAIL`, `PLURAL_SUFFIXES`). `MatchCtx` carries a locale name and a
 * unit-alias predicate, not the locale's ordinals, so a translated form waits on
 * the same widening the m4 follow-ups already record for chrono locales.
 */

/** `last` is not an nth, so it gets a sentinel rather than a number. */
export const LAST_ORDINAL = -1;

const ORDINALS: Readonly<Record<string, number>> = {
  first: 1,
  "1st": 1,
  second: 2,
  "2nd": 2,
  third: 3,
  "3rd": 3,
  fourth: 4,
  "4th": 4,
  fifth: 5,
  "5th": 5,
  last: LAST_ORDINAL,
};

const DAYS_PER_WEEK = 7;

/** `of` and `in` are optional; "first friday next month" says the same thing. */
const CONNECTOR = /^(\s+(?:of|in)\s+|\s+)/iu;

/**
 * The two month scopes chrono cannot read. It resolves "this month", "next
 * month", "last month", "September" and "Aug 2027" perfectly well, so those are
 * left to it; "the month" and "current month" are not dates in chrono's grammar
 * at all and would otherwise fail the whole phrase.
 */
const PLAIN_MONTH = /^(?:the|current)\s+month\b/iu;

export interface MonthScope {
  year: number;
  month: number;
  hour: number;
  minute: number;
  second: number;
  /** Whether the phrase named a clock time, rather than defaulting to midnight. */
  hasTime: boolean;
  /** Characters of the scope text consumed. */
  length: number;
}

function midnightIn(year: number, month: number, length: number): MonthScope {
  return { year, month, hour: 0, minute: 0, second: 0, hasTime: false, length };
}

/** The month the clock is in, which is what an unscoped ordinal counts inside. */
export function referenceMonth(ctx: MatchCtx): MonthScope {
  const now = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
    ctx.timeZone,
  );
  return midnightIn(now.year, now.month, 0);
}

/**
 * Which month the count runs inside, read by handing the tail to chrono.
 *
 * Delegating rather than listing month names keeps one answer to "which
 * September is meant" — chrono's — instead of a second convention that would
 * disagree with the rest of the package the first time a year had to be
 * implied.
 *
 * A tail that names a *day* is refused: "first friday of march 5" is not a
 * phrase of this shape, and reading it as "first friday of March" would silently
 * throw away the 5 the user typed. A tail that names a weekday is refused for
 * the same reason — "first friday of monday" is nothing.
 */
export function parseMonthScope(full: string, ctx: MatchCtx): MonthScope | null {
  // The same cut the bridge makes, for the same reason: chrono reads
  // "next month + 3 d" as one relative date and would swallow the operator and
  // its operand into the scope. It also ends the scope at a conversion keyword,
  // which is what leaves the "in tokyo" of "first friday next month in tokyo"
  // to the solver — the `in` these grammars keep is the one consumed as a
  // connector, before the tail begins.
  const tail = beforeOperator(full);
  if (tail.length === 0) return null;

  const plain = PLAIN_MONTH.exec(tail);
  if (plain !== null) {
    return { ...referenceMonth(ctx), length: plain[0].length };
  }

  // `forwardDate` here and nowhere else in the package. A bare month name in
  // this position is a plan — "3rd tuesday of september" typed in January means
  // the September ahead, not the one four months gone — whereas the bridge's own
  // parse stays backward-tolerant so "friday" is still the nearest Friday and
  // "3 days ago" is still in the past. Relative scopes ("next month", "last
  // month") name their own direction and are unaffected either way.
  const parsed = chrono.parse(tail, referenceFor(ctx), { forwardDate: true })[0];
  if (parsed === undefined || parsed.index !== 0) return null;
  if (parsed.start.isCertain("day") || parsed.start.isCertain("weekday")) return null;

  const year = parsed.start.get("year");
  const month = parsed.start.get("month");
  if (year === null || month === null) return null;

  // A clock time in the tail is the user's — "first friday of next month at
  // 9am" — and is carried through. A time they did not type is midnight, the
  // same rule the bridge applies to chrono's implied components.
  const hasTime = parsed.start.isCertain("hour");
  return {
    year,
    month,
    hour: hasTime ? (parsed.start.get("hour") ?? 0) : 0,
    minute: hasTime ? (parsed.start.get("minute") ?? 0) : 0,
    second: hasTime ? (parsed.start.get("second") ?? 0) : 0,
    hasTime,
    length: parsed.text.trimEnd().length,
  };
}

export interface OrdinalPhrase {
  /** 1–5, or `LAST_ORDINAL`. */
  nth: number;
  /** The noun as typed, lowercased: "friday", "fri", "week". */
  noun: string;
  /** The month named, or the month the clock is in when none was. */
  scope: MonthScope;
  /** Whether a month was actually named. `last` is only meaningful when it was. */
  scoped: boolean;
  /** Characters of `text` the phrase claims. */
  length: number;
}

/**
 * Reads "<ordinal> <noun> [of|in] [month]" anchored at the start of `text`.
 *
 * `nounPattern` is an alternation source, and its alternatives must be ordered
 * longest-first: JS alternation is first-match, not longest-match, so with `mon`
 * ahead of `monday` "monday" matches as `mon` and leaves "day" behind — and the
 * `\b` that follows would not catch it, because there is no boundary between
 * "n" and "d".
 *
 * A tail that is not a month leaves the ordinal counting inside the reference
 * month and claims only the words up to the noun, which is what lets
 * "first friday next month in tokyo" hand `in tokyo` back to the solver and
 * "first friday" stand on its own.
 */
export function parseOrdinalPhrase(
  text: string,
  nounPattern: string,
  ctx: MatchCtx,
): OrdinalPhrase | null {
  const head = new RegExp(
    `^(${Object.keys(ORDINALS).join("|")})\\s+(${nounPattern})\\b`,
    "iu",
  ).exec(text);
  if (head === null) return null;

  const nth = ORDINALS[head[1]?.toLowerCase() ?? ""];
  const noun = head[2]?.toLowerCase();
  if (nth === undefined || noun === undefined) return null;

  const gap = CONNECTOR.exec(text.slice(head[0].length))?.[0] ?? "";
  const scope =
    gap === "" ? null : parseMonthScope(text.slice(head[0].length + gap.length), ctx);

  return {
    nth,
    noun,
    scope: scope ?? referenceMonth(ctx),
    scoped: scope !== null,
    length: scope === null ? head[0].length : head[0].length + gap.length + scope.length,
  };
}

/**
 * The day of month the nth `weekday` falls on, or null when the month has no
 * such day.
 *
 * "fifth friday of february 2026" has four Fridays and no fifth, and the honest
 * answer is that the phrase names nothing. Rolling into March would be a date
 * the user did not ask for, and clamping to the fourth Friday would be the
 * wrong day reported as if it were right.
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  nth: number,
  weekday: number,
): number | null {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });

  if (nth === LAST_ORDINAL) {
    const last = first.with({ day: first.daysInMonth });
    return last.day - ((last.dayOfWeek - weekday + DAYS_PER_WEEK) % DAYS_PER_WEEK);
  }

  const day =
    1 +
    ((weekday - first.dayOfWeek + DAYS_PER_WEEK) % DAYS_PER_WEEK) +
    (nth - 1) * DAYS_PER_WEEK;
  return day > first.daysInMonth ? null : day;
}
