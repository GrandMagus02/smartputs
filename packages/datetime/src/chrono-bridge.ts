import type { MatchCtx } from "@smartput/core";
import * as chrono from "chrono-node";
import { Temporal } from "./temporal";

/**
 * Letterless runs a date is allowed to claim: an ISO date, an ISO date-time,
 * or a bare clock time. Everything else without letters is arithmetic.
 */
const LETTERLESS_OK =
  /^(\d{4}-\d{2}-\d{2}([T ]\d{1,2}:\d{2}(:\d{2})?)?|\d{1,2}:\d{2}(:\d{2})?)$/;

const LETTER_RUN = /\p{L}+/gu;

/**
 * Regular English plural suffixes, mirroring `locale/en`'s `suffixStripper`.
 *
 * The alias index stores singulars (`week`, `hour`) and core recovers the plural
 * at *resolve* time through an analyzer, so `isUnitAlias("weeks")` is false even
 * though `2 weeks` is unambiguously a duration. The gate therefore strips the
 * suffix itself; without that, "30 hours - 10 minutes" would be claimed as a
 * date and the pure-duration arithmetic spec §11 requires would be gone before
 * the solver ever ran.
 */
const PLURAL_SUFFIXES = ["es", "s"] as const;
const MIN_STEM = 2;

function isUnitWord(word: string, isUnitAlias: (s: string) => boolean): boolean {
  if (isUnitAlias(word)) return true;
  for (const suffix of PLURAL_SUFFIXES) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, word.length - suffix.length);
    if (stem.length >= MIN_STEM && isUnitAlias(stem)) return true;
  }
  return false;
}

/**
 * The accept-gate (plan ruling R4).
 *
 * The literal fold is destructive: once "10 m" is a date, the length reading is
 * gone before the solver ever runs. chrono is happy to read a bare quantity as
 * a duration-from-now, so the bridge refuses any match whose letter runs are
 * *all* registered unit aliases. "5 min" is refused; "next week monday" is not,
 * because `next` and `monday` are nobody's unit.
 */
export function accepts(text: string, isUnitAlias: (s: string) => boolean): boolean {
  const words = text.toLowerCase().match(LETTER_RUN) ?? [];
  if (words.length === 0) return LETTERLESS_OK.test(text.trim());
  return !words.every((w) => isUnitWord(w, isUnitAlias));
}

/**
 * Where the expression stops being a date and starts being arithmetic.
 *
 * chrono reads "today + 5 h" as one relative date-and-time and reports the whole
 * string as its match — which would fold the operator and its right operand into
 * the literal, destroying the `datetime + duration` reading the plugin exists to
 * provide. So the bridge never offers chrono anything past the first operator.
 *
 * `-` and `/` only count when whitespace-delimited, because both appear inside
 * dates chrono reads: the hyphens of "2026-03-01" and the slashes of "1/15/2026".
 * `+` and `*` appear in no date syntax, so they cut wherever they stand — which
 * is what makes "today+3d" work. Unspaced "today-1d" is the residue of that
 * asymmetry and is recorded in m4-followups.md. Parentheses cut anywhere.
 */
const ARITHMETIC_TAIL = /[()+*]|\s[-/]\s/;

function beforeArithmetic(rest: string): string {
  const cut = ARITHMETIC_TAIL.exec(rest);
  return cut === null ? rest : rest.slice(0, cut.index);
}

/**
 * chrono's reference has to be expressed in the *engine's* time zone, not the
 * host's, or an injected clock stops being deterministic: chrono fills implied
 * components (the date behind "3pm") from the reference's local wall clock, and
 * a JS Date's local wall clock is the machine's.
 */
function referenceFor(ctx: MatchCtx): chrono.ParsingReference {
  const zoned = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
    ctx.timeZone,
  );
  return {
    instant: new Date(ctx.now),
    timezone: zoned.offsetNanoseconds / 60_000_000_000,
  };
}

const WEEK_PHRASE = /\bweeks?\b/i;
const TRAILING_WORD = /^(\s+)(\p{L}+)/u;

/**
 * "next week monday" is two chrono matches, not one: chrono resolves "next week"
 * to the same weekday one week on, and leaves "monday" as a separate result ten
 * characters later. Neither reading is what the phrase means.
 *
 * So when a week-naming match is followed by a bare weekday, the weekday selects
 * the day *inside* that week — the week is Monday-to-Sunday, as ISO says — and
 * the literal claims both words. Returns the day offset to apply and the total
 * length claimed, or null when the phrase is not of that shape.
 */
function weekdaySnap(
  source: string,
  text: string,
  date: Temporal.PlainDate,
  ctx: MatchCtx,
): { days: number; length: number } | null {
  if (!WEEK_PHRASE.test(text)) return null;

  const trailing = TRAILING_WORD.exec(source.slice(text.length));
  const gap = trailing?.[1];
  const word = trailing?.[2];
  if (gap === undefined || word === undefined) return null;

  const parsed = chrono.parse(word, referenceFor(ctx), { forwardDate: false })[0];
  if (parsed === undefined || parsed.index !== 0 || parsed.text.length !== word.length) {
    return null;
  }
  // `isCertain("weekday")` separates "monday", where the user named the day,
  // from a weekday chrono merely derived from a date it resolved.
  if (!parsed.start.isCertain("weekday")) return null;
  const weekday = parsed.start.get("weekday");
  if (weekday === null) return null;

  // chrono counts Sunday as 0; Temporal counts Monday as 1 and Sunday as 7.
  const target = weekday === 0 ? 7 : weekday;
  return {
    days: target - date.dayOfWeek,
    length: text.length + gap.length + word.length,
  };
}

export interface BridgeMatch {
  zdt: Temporal.ZonedDateTime;
  length: number;
}

/**
 * Parses a date anchored at `offset`, or returns null.
 *
 * Anchored, not "somewhere in the string": the fold offers every token boundary
 * in turn, so a match that starts later belongs to a later call. Accepting an
 * unanchored match here would let "5 h + today" report a length measured from
 * the wrong place.
 */
export function parseDateTime(
  input: string,
  offset: number,
  ctx: MatchCtx,
): BridgeMatch | null {
  const rest = beforeArithmetic(input.slice(offset));
  if (rest.length === 0) return null;

  const results = chrono
    .parse(rest, referenceFor(ctx), { forwardDate: false })
    .filter((r) => r.index === 0)
    .sort((a, b) => b.text.length - a.text.length);

  for (const result of results) {
    // chrono reports the matched text verbatim, and some patterns keep the
    // whitespace that separated their parts. The fold turns `length` into a
    // token span, so a trailing space would claim the gap before the next
    // token and land the span off a boundary.
    const text = result.text.trimEnd();
    if (text.length === 0) continue;

    const year = result.start.get("year");
    const month = result.start.get("month");
    const day = result.start.get("day");
    if (year === null || month === null || day === null) continue;

    // Implied components are chrono's guesses about what the user left out.
    // A time the user did not type is midnight, deliberately and always: a
    // formatted result that silently carried the reference's own clock time
    // would make "today" depend on when the test ran.
    const certainTime = result.start.isCertain("hour");
    let plain = new Temporal.PlainDateTime(
      year,
      month,
      day,
      certainTime ? (result.start.get("hour") ?? 0) : 0,
      certainTime ? (result.start.get("minute") ?? 0) : 0,
      certainTime ? (result.start.get("second") ?? 0) : 0,
    );

    const snap = weekdaySnap(rest, text, plain.toPlainDate(), ctx);
    const length = snap?.length ?? text.length;
    if (snap !== null) plain = plain.add({ days: snap.days });

    // The gate reads everything the literal would swallow, including a weekday
    // the snap pulled in — the fold erases exactly this run and no less.
    if (!accepts(rest.slice(0, length), ctx.isUnitAlias)) continue;

    // An explicit offset in the text ("3pm EST") wins over the engine's zone;
    // the instant is what the user named, and the zone label follows it.
    const offsetMinutes = result.start.isCertain("timezoneOffset")
      ? result.start.get("timezoneOffset")
      : null;

    const zdt =
      offsetMinutes === null
        ? plain.toZonedDateTime(ctx.timeZone)
        : plain
            .toZonedDateTime("UTC")
            .add({ minutes: -offsetMinutes })
            .withTimeZone(ctx.timeZone);

    return { zdt, length };
  }

  return null;
}
