import type { MatchCtx } from "@smartput/core";
import { type CalendarUnit, parseDateTime, type Temporal } from "@smartput/datetime";
import { type EndpointParser, resolveEndpoint, type Window } from "@smartput/range-core";

/**
 * The base endpoint parser: whatever chrono reads through
 * `@smartput/datetime`'s bridge, and nothing else.
 *
 * It re-reads the bridge rather than chrono directly for the reason `date` and
 * `time` do — the bridge's accept-gate and arithmetic cut are what keep "5 min"
 * out of a date reading, and an endpoint parser that skipped them would let
 * "from 5 min to 10 min" become a span of two instants.
 */
export const datetimeEndpoint: EndpointParser = (text, ctx) => {
  const match = parseDateTime(text, 0, ctx);
  return match === null ? null : { zdt: match.zdt, length: match.length };
};

/**
 * The day words a window can hang off, and the day offset each names.
 *
 * `next` is here as a synonym for `tomorrow` rather than as a general
 * modifier: "next morning" is the morning of the following day, which is what
 * +1 gives for free, and there is no "next week morning" to disambiguate
 * against because a window belongs to one day.
 *
 * The possessive spellings are separate entries rather than a stripped
 * suffix. Core's normalizer leaves the apostrophe alone, and a suffix rule
 * broad enough to fold `today's` into `today` would also fold a hypothetical
 * `tomorrows` into a plural nobody wrote.
 */
const DAY_WORDS: Record<string, number> = {
  yesterday: -1,
  yesterdays: -1,
  "yesterday's": -1,
  today: 0,
  todays: 0,
  "today's": 0,
  tomorrow: 1,
  tomorrows: 1,
  "tomorrow's": 1,
  next: 1,
};

/**
 * The one-word contractions of a day word and a window word.
 *
 * "tonight" is listed in the design's phrase table and does not decompose:
 * there is no space for the two-word walk below to find, and the day it names
 * is today while the window it names wraps into tomorrow. Kept as data beside
 * `DAY_WORDS` so the two tables read as one grammar.
 */
const MERGED_WORDS: Record<string, { shift: number; window: string }> = {
  tonight: { shift: 0, window: "night" },
};

/**
 * Both tables as entry lists.
 *
 * Built at module scope because `Object.entries` allocates a fresh array of
 * fresh pairs on every call, and `dayWindowAt` is offered every token boundary
 * of every keystroke — §7's "hoist tables to module scope", applied to the two
 * tables that cannot change.
 */
const MERGED_ENTRIES = Object.entries(MERGED_WORDS);
const DAY_ENTRIES = Object.entries(DAY_WORDS);

/**
 * How much text a head cut reads: at least as long as the longest word any
 * grammar in this file opens with, which is `"yesterday's"` at 11.
 *
 * Only the lower bound is load-bearing, which is why the number sits above the
 * tables rather than being derived from them. A head longer than the longest
 * word copies a few characters nobody looks at; a head shorter than one would
 * silently stop that word matching. An over-estimate cannot be wrong, so a
 * `Math.max` over four tables would be bundle bytes spent on a hazard that does
 * not exist.
 *
 * Cutting the head at all is the point: a matcher is offered every token
 * boundary, so lowercasing the whole tail at each one is work proportional to
 * the line, at every offset in it.
 */
const HEAD = 16;

/** The whole span a window covers on the day `shift` days from `day`. */
function windowSpan(
  day: Temporal.ZonedDateTime,
  shift: number,
  window: Window,
): { start: Temporal.ZonedDateTime; end: Temporal.ZonedDateTime } {
  const base = day.add({ days: shift });
  return {
    start: base.add({ hours: window.start }),
    // A wrapping window closes on the *following* calendar day: "night" is
    // 22:00 today to 06:00 tomorrow, not a backwards span within one day.
    end: window.wraps
      ? base.add({ days: 1, hours: window.end })
      : base.add({ hours: window.end }),
  };
}

/**
 * The span a phrase names, in the one shape both grammars below return.
 *
 * Both ends are already `ZonedDateTime`: `fromToAt` unwraps its `Endpoint`s
 * before returning so that the caller has a single shape to build from and no
 * narrowing to do. `length` is measured from the offset the matcher was
 * offered, which is what core's fold wants.
 */
export interface PhraseSpan {
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
  length: number;
}

/**
 * "yesterday morning": a day word supplying the date and a window word
 * supplying the hours. "next morning" is tomorrow morning, and "tonight" is
 * the one word that carries both halves itself.
 *
 * Matching is done on a lowercased copy while `length` is counted in the
 * original's characters. The two agree because lowercasing is
 * character-for-character for the ASCII words in these tables — but the length
 * is deliberately derived from the *table entries*, never from the lowercased
 * slice, so a locale table with a multi-character lowering could not silently
 * move the span.
 *
 * The day word is tested first, against a lowercased head no longer than the
 * longest one, and everything else — the tail copy, the window table's
 * entries, `startOfDay()` — happens only once one has matched. Almost every
 * offset in a line is not a day word, and that offset should cost a short
 * `slice` and a handful of `startsWith` calls rather than a copy of the rest of
 * the input. The boundary after the word is read off `input` directly, so
 * "exactly this word" and "this word then a space" stay exact rather than
 * becoming a fact about a truncated copy.
 */
export function dayWindowAt(
  input: string,
  offset: number,
  windows: Record<string, Window>,
  now: Temporal.ZonedDateTime,
): PhraseSpan | null {
  const head = input.slice(offset, offset + HEAD).toLowerCase();

  for (const [word, merged] of MERGED_ENTRIES) {
    if (!head.startsWith(word)) continue;
    // The word is the whole rest of the input, or it ends at a space — past
    // the end reads `undefined`, which the `??` turns into the former.
    if ((input[offset + word.length] ?? " ") !== " ") continue;
    const window = windows[merged.window];
    if (window === undefined) continue;
    return {
      ...windowSpan(now.startOfDay(), merged.shift, window),
      length: word.length,
    };
  }

  for (const [word, shift] of DAY_ENTRIES) {
    if (!head.startsWith(word) || input[offset + word.length] !== " ") continue;
    const after = input.slice(offset + word.length + 1).toLowerCase();
    for (const [name, window] of Object.entries(windows)) {
      // `startsWith` rather than equality: the phrase may be followed by more
      // input, and the fold discards any claim that misses a token boundary,
      // so "tomorrow morningish" cannot survive as a claim of "tomorrow
      // morning" plus a stray suffix.
      if (!after.startsWith(name)) continue;
      // "next day" names a *day*, not the daylight window inside one — it is
      // tomorrow, and chrono already reads it that way. Every other day word
      // pairs with `day` harmlessly ("tomorrow day" is nobody's phrasing), but
      // this one collides with an input a user really types, so it is refused
      // here rather than left to the solver to score.
      if (word === "next" && name === "day") continue;
      return {
        ...windowSpan(now.startOfDay(), shift, window),
        length: word.length + 1 + name.length,
      };
    }
  }
  return null;
}

const OPENERS = ["from "] as const;
const CLOSERS = [" to ", " until ", " till ", " through "] as const;
const BARE_CLOSERS = ["until ", "till ", "through "] as const;

/**
 * Cuts `from X to Y` at its closer before either end is parsed.
 *
 * The obvious shape — resolve `X` from the whole tail, then look for a closer
 * in whatever it left over — does not work, and the reason is chrono. chrono
 * has range support of its own: given "today to friday" it returns *one*
 * result covering the entire string, so the start endpoint consumes the closer
 * and the search for it finds nothing. Cutting first hands each parser a
 * segment that can only be one endpoint.
 *
 * Earliest closer wins. A later one would let "from today to friday until
 * monday" pair the wrong two ends, and no endpoint grammar this package
 * resolves contains a closer word inside itself.
 */
function splitOnCloser(
  text: string,
): { left: string; right: string; closer: string } | null {
  const lower = text.toLowerCase();
  let cut: { index: number; closer: string } | null = null;
  for (const closer of CLOSERS) {
    const index = lower.indexOf(closer);
    if (index < 0) continue;
    if (cut === null || index < cut.index) cut = { index, closer };
  }
  if (cut === null) return null;
  return {
    left: text.slice(0, cut.index),
    right: text.slice(cut.index + cut.closer.length),
    closer: cut.closer,
  };
}

/**
 * `from X to Y`, and `until Y` with an implied start of now.
 *
 * Claimed by a matcher rather than by an op signature because
 * `in | datetime | datetime` belongs to zone conversion and registry pass 4
 * refuses a second claimant (design §5.1). A run beginning with `from` or
 * `until` has no competing reading, so claiming the whole span costs nothing —
 * which matters, because the fold is destructive for a multi-token claim.
 *
 * A bare `from X` is not claimed: an incomplete range is not an error, it is
 * not a range, and declining lets `X` keep whatever reading it had. The same
 * goes for `from X to <something chrono cannot read>`, which is why the closer
 * loop returns null instead of falling through to the bare-closer loop — the
 * text began with `from`, so it was never a bare `until`.
 *
 * The opening word is tested against the same short `HEAD` cut `dayWindowAt`
 * uses, and the tail is copied only once one has matched. Every other token
 * boundary in a line — which is nearly all of them — then costs a sixteen
 * character slice instead of a copy of the rest of the input.
 */
export function fromToAt(
  input: string,
  offset: number,
  ctx: MatchCtx,
  now: Temporal.ZonedDateTime,
  parsers: readonly EndpointParser[],
): PhraseSpan | null {
  const head = input.slice(offset, offset + HEAD).toLowerCase();

  for (const opener of OPENERS) {
    if (!head.startsWith(opener)) continue;
    const afterOpen = input.slice(offset + opener.length);
    const split = splitOnCloser(afterOpen);
    if (split === null) return null;
    const start = resolveEndpoint(split.left, ctx, parsers);
    // The left segment has to be consumed *whole*. A start that read only part
    // of it would leave text between the two ends that the claim covers and
    // nothing interpreted — "from noise today to friday" would silently become
    // today-to-friday, noise and all.
    if (start === null || start.length !== split.left.length) return null;
    const end = resolveEndpoint(split.right, ctx, parsers);
    if (end === null) return null;
    return {
      start: start.zdt,
      end: end.zdt,
      length: opener.length + split.left.length + split.closer.length + end.length,
    };
  }

  for (const closer of BARE_CLOSERS) {
    if (!head.startsWith(closer)) continue;
    const end = resolveEndpoint(input.slice(offset + closer.length), ctx, parsers);
    if (end === null) return null;
    return { start: now, end: end.zdt, length: closer.length + end.length };
  }

  return null;
}

/**
 * The plural `Temporal` takes for each interval, so closing one is a lookup
 * rather than a switch.
 */
const CALENDAR_PLURAL: Record<CalendarUnit, "weeks" | "months" | "years"> = {
  week: "weeks",
  month: "months",
  year: "years",
};

/**
 * "next week", "last month", "second week Aug 2027" — the calendar intervals,
 * as a span of instants.
 *
 * The reading comes back from `@smartput/datetime`'s bridge already resolved:
 * the phrase's opening midnight as the value, and `calendarUnit` naming the
 * interval it opened. This adds one unit to close it. Nothing here re-reads the
 * words, which is what keeps "next week" meaning the same seven days to
 * `datetime`, `date`, `date-range` and this kind.
 *
 * The end is exclusive, per design §3.1, and re-snapped to a day boundary
 * because `add` preserves the wall clock and a wall clock is not guaranteed to
 * have a midnight — `range-core`'s `dayStart` sets out why.
 */
export function calendarSpanAt(
  input: string,
  offset: number,
  ctx: MatchCtx,
): PhraseSpan | null {
  const match = parseDateTime(input, offset, ctx);
  if (match === null || match.calendarUnit === undefined) return null;
  return {
    start: match.zdt,
    end: match.zdt.add({ [CALENDAR_PLURAL[match.calendarUnit]]: 1 }).startOfDay(),
    length: match.length,
  };
}
