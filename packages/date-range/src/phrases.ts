import type { Temporal } from "@smartput/datetime";
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  type SnapOptions,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "@smartput/range-core";

export interface Span {
  start: Temporal.ZonedDateTime;
  /** Exclusive, per design §3.1. Only the formatter subtracts a day. */
  end: Temporal.ZonedDateTime;
}

type Unit = "day" | "week" | "month" | "year";

export interface Phrase {
  text: string;
  unit: Unit;
  /** How many `unit`s away from now the span sits. "last week" is -1. */
  offset: number;
}

/**
 * One snapper per unit, so `spanFor` never branches on the unit itself.
 *
 * `day` is inline rather than borrowed from `@smartput/date`'s `startOfDay`
 * because it needs both ends and the other three entries already produce a
 * pair; a helper that returned one end would make this row the odd one out.
 */
const SNAP: Record<Unit, (z: Temporal.ZonedDateTime, o: SnapOptions) => Span> = {
  day: (z) => ({ start: z.startOfDay(), end: z.startOfDay().add({ days: 1 }) }),
  week: (z, o) => ({ start: startOfWeek(z, o), end: endOfWeek(z, o) }),
  month: (z) => ({ start: startOfMonth(z), end: endOfMonth(z) }),
  year: (z) => ({ start: startOfYear(z), end: endOfYear(z) }),
};

/**
 * Every phrase this kind claims, longest first so that "next week" is never
 * read as the "week" inside it. The fold takes the longest claim anyway, so the
 * ordering is not what makes it correct — `phraseAt` compares lengths — but
 * keeping the table in that order keeps the two facts next to each other.
 *
 * "year", "1 year" and "one year" all name the calendar year containing now,
 * which is design §5.2's most revisable ruling: the competing reading is a
 * duration of one year, and `duration` has no `yr` unit to express it with, so
 * nothing else claims these three today.
 *
 * There is no bare "week", "month" or "day" row. Every one of those words is a
 * `duration` alias, and claiming them here would put a range reading on the
 * right of "3 days" for the solver to weigh. "year" is safe precisely because
 * it is not an alias of anything.
 */
export const PHRASES: readonly Phrase[] = Object.freeze([
  { text: "whole week", unit: "week", offset: 0 },
  { text: "this week", unit: "week", offset: 0 },
  { text: "next week", unit: "week", offset: 1 },
  { text: "last week", unit: "week", offset: -1 },
  { text: "whole month", unit: "month", offset: 0 },
  { text: "this month", unit: "month", offset: 0 },
  { text: "next month", unit: "month", offset: 1 },
  { text: "last month", unit: "month", offset: -1 },
  { text: "whole year", unit: "year", offset: 0 },
  { text: "this year", unit: "year", offset: 0 },
  { text: "next year", unit: "year", offset: 1 },
  { text: "last year", unit: "year", offset: -1 },
  { text: "one year", unit: "year", offset: 0 },
  { text: "1 year", unit: "year", offset: 0 },
  { text: "year", unit: "year", offset: 0 },
  { text: "whole day", unit: "day", offset: 0 },
] satisfies Phrase[]);

const PLURAL: Record<Unit, "days" | "weeks" | "months" | "years"> = {
  day: "days",
  week: "weeks",
  month: "months",
  year: "years",
};

/**
 * The span a phrase names, resolved against `now`.
 *
 * The shift happens *before* the snap, and through the calendar: "next month"
 * from the 31st has to land in the month after this one, and `add({ months: 1 })`
 * clamps to the 28th or 30th rather than spilling into the month after that.
 * Snapping first and shifting second would give the same answer for weeks and
 * the wrong one for months.
 */
export function spanFor(
  phrase: Pick<Phrase, "unit" | "offset">,
  now: Temporal.ZonedDateTime,
  opts: SnapOptions = {},
): Span {
  const shifted =
    phrase.offset === 0 ? now : now.add({ [PLURAL[phrase.unit]]: phrase.offset });
  return SNAP[phrase.unit](shifted, opts);
}

/**
 * The longest phrase matching at `offset`, case-insensitively, or null.
 *
 * Longest wins rather than first, because "this year" and "year" both match at
 * the same offset and only one of them is what the user typed. The fold would
 * eventually prefer the longer claim anyway, but returning the short one here
 * means the long one is never offered at all — `phraseAt` is called once per
 * offset and returns a single reading.
 */
export function phraseAt(input: string, offset: number): Phrase | null {
  const rest = input.slice(offset).toLowerCase();
  let best: Phrase | null = null;
  for (const phrase of PHRASES) {
    if (!rest.startsWith(phrase.text)) continue;
    if (best === null || phrase.text.length > best.text.length) best = phrase;
  }
  return best;
}
