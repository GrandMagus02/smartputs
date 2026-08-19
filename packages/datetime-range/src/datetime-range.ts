import { Decimal, defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { Temporal } from "@smartput/datetime";
import {
  assertOrdered,
  type EndpointParser,
  unwrapRange,
  WINDOWS,
  type Window,
  wrapRange,
} from "@smartput/range-core";
import { calendarSpanAt, datetimeEndpoint, dayWindowAt, fromToAt } from "./phrases";

export const DATETIME_RANGE_KIND = "datetime-range";

/**
 * The kind's one unit, and a label rather than a scale. A span between two
 * instants has no second unit to convert into — "span in hours" is a duration,
 * which is `@smartput/duration`'s question, not this kind's.
 *
 * Hyphenated and kind-named rather than the bare "span" it used to be, for the
 * reason `@smartput/date`'s `DATE_UNIT` gives: this kind ships no vocabulary,
 * ruling R2 therefore indexes the unit under its own id, and "span" was both a
 * typeable word and a key `@smartput/date-range` claimed too.
 */
export const DATETIME_RANGE_UNIT = "datetime-span";

export interface DatetimeRangeOptions {
  /**
   * Overrides merged over `range-core`'s `WINDOWS`. Per engine, not global:
   * an app whose users start work at 04:00 changes `morning` here and leaves
   * every other engine in the process alone.
   */
  windows?: Record<string, Window>;
  /**
   * Endpoint parsers for `from X to Y`, in preference order. The default is
   * `[datetimeEndpoint]`; the `./holiday` subpath appends one more so that
   * importing this module never reaches `date-holidays` (design §5.3).
   */
  parsers?: readonly EndpointParser[];
  /**
   * Weight on a calendar-interval claim — "next week", "second week Aug 2027".
   * Separate from `weight` because these are the one phrases another kind reads
   * better; see `DEFAULT_CALENDAR_SPAN_WEIGHT`.
   */
  calendarSpanWeight?: number;
  /**
   * Summed into every claim this kind makes. Positive by default; see
   * `DEFAULT_DATETIME_RANGE_WEIGHT` for why the sign is the opposite of
   * `date`'s and `time`'s. `0` restores the plain datetime reading of
   * "yesterday morning" without removing the `from`/`until` grammar, which has
   * no competitor to lose to.
   */
  weight?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `YYYY-MM-DD HH:MM`, built from Temporal fields rather than
 * `Intl.DateTimeFormat`, for the reason `@smartput/datetime`'s formatter gives:
 * the golden corpus asserts formatted output verbatim and ICU's date patterns
 * move between runtime versions.
 */
const stamp = (z: Temporal.ZonedDateTime) =>
  `${z.year}-${pad(z.month)}-${pad(z.day)} ${pad(z.hour)}:${pad(z.minute)}`;

/**
 * The default reading weight, mirroring `RANGE_WEIGHTS.reading` — but with the
 * sign the other way round, because this kind is on the other side of the
 * contest. `date` and `time` are penalised so a bare "3pm" keeps reading as a
 * datetime; a `datetime-range` literal is *rewarded* so "yesterday morning",
 * which chrono also reads as a plain instant, resolves to the span the user
 * described rather than to 06:00 on its own.
 *
 * The number matches `RANGE_WEIGHTS.signature` (+20) so the two entry paths of
 * design §5 — an op signature and a literal matcher — cost a range the same to
 * win, and stays under `CONTEXT_BONUS` (30) so it cannot overturn a corrected
 * reading.
 */
export const DEFAULT_DATETIME_RANGE_WEIGHT = 20;

/**
 * The weight on a calendar-interval claim, and the one number in this package
 * chosen to *lose*.
 *
 * "next week" is a span of whole days, and `@smartput/date-range` says so in
 * the format a person wants to read — `2026-01-19 → 2026-01-25`, not
 * `2026-01-19 00:00 → 2026-01-26 00:00 UTC`. So in an engine carrying both
 * kinds the day-granular reading has to win, and +4 against that package's
 * `DEFAULT_PHRASE_WEIGHT` of +5 is what says so.
 *
 * It is still positive, and that is the other half: an engine carrying this
 * kind and not `date-range` answers "next week" with the span rather than with
 * the bare instant `datetime` reads at weight 0. The two packages support the
 * same strings; which of them answers depends only on which is registered.
 */
export const DEFAULT_CALENDAR_SPAN_WEIGHT = 4;

/**
 * `canonical` is the start instant, so ordering and comparison work without the
 * engine knowing what a range is — the trick `range-core` documents and
 * datetime plays with epoch nanoseconds.
 */
function build(
  input: string,
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
) {
  assertOrdered(input, start, end);
  return wrapRange(
    DATETIME_RANGE_KIND,
    DATETIME_RANGE_UNIT,
    new Decimal(start.epochNanoseconds.toString()),
    { start: start.toString(), end: end.toString(), zone: start.timeZoneId },
  );
}

/**
 * A span between two instants, entered by literal phrase alone.
 *
 * No op signatures: the two-endpoint shapes this kind would want —
 * `in | datetime | datetime` above all — are already claimed by zone
 * conversion, and registry pass 4 refuses a second claimant. That is the
 * acknowledged wart of design §5.1, and the `from X to Y` matcher is the answer
 * to it.
 *
 * A factory as well as a constant so an embedder can retune the window table or
 * the endpoint parsers without forking the kind.
 */
export function createDatetimeRange(opts: DatetimeRangeOptions = {}): Kind {
  const windows = { ...WINDOWS, ...(opts.windows ?? {}) };
  const parsers = opts.parsers ?? [datetimeEndpoint];
  const weight = opts.weight ?? DEFAULT_DATETIME_RANGE_WEIGHT;
  const calendarWeight = opts.calendarSpanWeight ?? DEFAULT_CALENDAR_SPAN_WEIGHT;

  const matcher: LiteralMatcher = (input, offset, ctx) => {
    const now = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
      ctx.timeZone,
    );
    // The window grammar first: it is the cheaper test, and no phrase it
    // claims can also open with `from` or `until`.
    const span =
      dayWindowAt(input, offset, windows, now) ??
      fromToAt(input, offset, ctx, now, parsers);
    if (span === null) return null;
    const value = build(input, span.start, span.end);
    return {
      kind: DATETIME_RANGE_KIND,
      unit: DATETIME_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: span.length,
      weight,
    };
  };

  // A second matcher rather than a second reading out of the first, because the
  // two carry different weights and a `LiteralMatch` has one.
  const calendarMatcher: LiteralMatcher = (input, offset, ctx) => {
    const span = calendarSpanAt(input, offset, ctx);
    if (span === null) return null;
    const value = build(input, span.start, span.end);
    return {
      kind: DATETIME_RANGE_KIND,
      unit: DATETIME_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: span.length,
      weight: calendarWeight,
    };
  };

  return defineKind({
    id: DATETIME_RANGE_KIND,
    value: { mode: "opaque", units: [DATETIME_RANGE_UNIT] },
    literals: [matcher, calendarMatcher],
    ops: [],
    format: (value) => {
      const { start, end, zone } = unwrapRange(value);
      return `${stamp(Temporal.ZonedDateTime.from(start))} → ${stamp(
        Temporal.ZonedDateTime.from(end),
      )} ${zone}`;
    },
  });
}

/** The kind as a consumer normally wants it: default windows, default parsers. */
export const datetimeRange: Kind = createDatetimeRange();
