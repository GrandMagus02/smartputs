import type { MatchCtx } from "@smartput/core";
import {
  LAST_ORDINAL,
  nthWeekdayOfMonth,
  parseOrdinalPhrase,
  Temporal,
} from "@smartput/datetime";
import {
  DEFAULT_WEEK_START,
  endOfWeek,
  type SnapOptions,
  startOfWeek,
} from "@smartput/range-core";
import type { Span } from "./phrases";

/**
 * "second week Aug 2027" — the same counting `@smartput/datetime` does for
 * "second monday in Aug 2027", landing on a span instead of a day.
 *
 * The ordinal words, the month scope and the nth-weekday arithmetic all come
 * from `@smartput/datetime/ordinal`, so the two grammars cannot drift apart
 * about which September "of september" means or where "of" is allowed to be
 * left out.
 */

/**
 * **A week of a month is one that starts in it.** The nth week begins on the
 * nth week-start weekday — the nth Monday by default — which makes
 * "second week Aug 2027" and "second monday in Aug 2027" name the same day and
 * differ only in what they return.
 *
 * Two consequences, both deliberate. A month whose 1st is not a Monday opens
 * with days that belong to the previous month's last week: 2027-08-01 is a
 * Sunday, so the first week of August 2027 runs from the 2nd. And the last week
 * of a month may end in the next one — the last week of August 2027 is the
 * 30th to 5 September — because a selected week is a whole week or it is not a
 * week. Clipping either end would hand back a span of three days under a word
 * that means seven.
 *
 * The boundary is `SnapOptions.weekStart`, so an embedder who counts Sunday
 * weeks gets Sunday-started weeks here too, with no separate dial.
 */
const WEEK_PATTERN = "week";

export interface OrdinalWeekMatch {
  span: Span;
  length: number;
}

/**
 * Reads an ordinal-week phrase anchored at `offset`, or returns null.
 */
export function ordinalWeekAt(
  input: string,
  offset: number,
  ctx: MatchCtx,
  opts: SnapOptions = {},
): OrdinalWeekMatch | null {
  const phrase = parseOrdinalPhrase(input.slice(offset), WEEK_PATTERN, ctx);
  if (phrase === null) return null;

  // "last week" with no month is the phrase table's, and means the week just
  // gone. Only a named month gives `last` a month to be the last week *of*.
  if (!phrase.scoped && phrase.nth === LAST_ORDINAL) return null;

  const { scope } = phrase;
  const day = nthWeekdayOfMonth(
    scope.year,
    scope.month,
    phrase.nth,
    opts.weekStart ?? DEFAULT_WEEK_START,
  );
  // A month with only four week-starts has no fifth week, and the honest answer
  // is that the phrase names nothing.
  if (day === null) return null;

  // Already aligned to the week boundary by construction; both snappers are
  // called anyway so the DST handling in `@smartput/range-core` is the only
  // copy of that logic — see `dayStart` there for why a wall clock is not
  // guaranteed to have a midnight.
  const start = Temporal.PlainDate.from({
    year: scope.year,
    month: scope.month,
    day,
  }).toZonedDateTime(ctx.timeZone);

  return {
    span: { start: startOfWeek(start, opts), end: endOfWeek(start, opts) },
    length: phrase.length,
  };
}
