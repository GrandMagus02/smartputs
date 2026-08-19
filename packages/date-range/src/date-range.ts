import {
  Decimal,
  defineKind,
  type Kind,
  type LiteralMatcher,
  type Value,
} from "@smartput/core";
import { DATE_KIND, unwrap as unwrapDate } from "@smartput/date";
import { addDuration, Temporal } from "@smartput/datetime";
import {
  assertOrdered,
  RANGE_WEIGHTS,
  type SnapOptions,
  unwrapRange,
  wrapRange,
} from "@smartput/range-core";
import { ordinalWeekAt } from "./ordinal-week";
import { phraseAt, spanFor } from "./phrases";

export const DATE_RANGE_KIND = "date-range";

/**
 * The kind's one unit, and a label rather than a scale: a span of days is not a
 * point on a ratio line. It ships no vocabulary for the reason `date`'s
 * `DATE_UNIT` gives — an alias here would be a second kind for the solver to
 * consider every time someone writes "3 spans".
 *
 * Hyphenated, and named for its own kind rather than the bare "span" it used to
 * be, on the same argument `DATE_UNIT` sets out: ruling R2 indexes a unit under
 * its own id when no language has spoken for the kind, so the id has to be
 * something `lex` cannot build a word token out of. It also stops this kind and
 * `@smartput/datetime-range` sharing one registry key, which they did while
 * both were called "span".
 */
export const DATE_RANGE_UNIT = "date-span";

/**
 * Charged to every phrase claim, and the plan did not anticipate needing it.
 *
 * Four of the sixteen phrases are also chrono dates: "next month", "this year",
 * "next year" and "last year" all come back from `parseDateTime` as a match of
 * exactly the same length, so `@smartput/datetime` claims the identical span and
 * the two readings tie at 0 — which is an `AmbiguityError`, not a range.
 *
 * The tiebreak goes to the phrase because a month is not a day. "next month"
 * names an interval, and the reading that returns one should win over the
 * reading that returns a single instant inside it.
 *
 * `@smartput/datetime` used to make that argument for us — those four phrases
 * came back from `parseDateTime` with `hasDate: false`, so `@smartput/date`
 * declined them and only the datetime reading was left to outweigh. They now
 * resolve to the interval's first day and carry `hasDate: true`, which is what
 * lets a `date` engine answer "next week" at all, so this weight is now
 * outrunning three readings rather than one: `datetime` at 0, `date` at -5 and
 * `datetime-range`'s calendar span at +4. +5 still clears all three, and the
 * last of them was chosen against this number — see
 * `DEFAULT_CALENDAR_SPAN_WEIGHT` over there.
 *
 * +5 is the mirror of `RANGE_WEIGHTS.reading`, and it is deliberately small: a
 * gap of 1 already clears the 0.05 ambiguity epsilon after the softmax, so the
 * number only has to be positive and stay well under CONTEXT_BONUS (30) and
 * TYPO_PENALTY (15) — a phrase must not be able to overturn a corrected reading
 * or a binary whose operands agree.
 */
export const DEFAULT_PHRASE_WEIGHT = 5;

export interface DateRangeOptions extends SnapOptions {
  /**
   * Weight on the `in | date | date` signature, design §4.2's second dial.
   *
   * It has to exceed twice `RANGE_WEIGHTS.reading` or the two -5 date readings
   * cancel it and "today to friday" ties with whatever else claims the pair.
   * 0 removes the range reading's advantage entirely, which is the setting for
   * an embedder who wants `to` to mean conversion and nothing else.
   */
  signatureWeight?: number;
  /**
   * Weight on every phrase claim. 0 hands "next month" back to the datetime
   * reading — or rather back to `AmbiguityError`, since the two then tie.
   */
  phraseWeight?: number;
}

/**
 * Every range this kind produces goes through here, so the ordering check is
 * unskippable. `input` is threaded in only to name the expression in the error:
 * `InvertedRangeError` reports what the user typed, not what the ops saw.
 */
function build(
  input: string,
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): Value {
  assertOrdered(input, start, end);
  return wrapRange(
    DATE_RANGE_KIND,
    DATE_RANGE_UNIT,
    new Decimal(start.epochNanoseconds.toString()),
    { start: start.toString(), end: end.toString(), zone: start.timeZoneId },
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const day = (z: Temporal.ZonedDateTime) => `${z.year}-${pad(z.month)}-${pad(z.day)}`;

/**
 * The end is stored exclusive and displayed inclusive: the week of the 12th
 * ends on the 18th to a person and at 00:00 on the 19th to arithmetic. Storing
 * the exclusive instant keeps span maths free of off-by-one corrections, and
 * this one subtraction is the whole price of that — design §3.1.
 *
 * The date parts are read off the `ZonedDateTime` rather than formatted through
 * `Intl`, for the reason datetime's formatter gives: the golden corpus asserts
 * formatted output verbatim and ICU's patterns move between runtime versions.
 */
function formatRange(value: Value): string {
  const { start, end } = unwrapRange(value);
  const from = Temporal.ZonedDateTime.from(start);
  const to = Temporal.ZonedDateTime.from(end).subtract({ days: 1 });
  return `${day(from)} → ${day(to)}`;
}

/**
 * The calendar-span phrases, which have no two-operand shape at all: "whole
 * week" names a span without naming either of its ends, so there is nothing for
 * an op signature to receive. Design §5.2's other entry path.
 *
 * Claiming a multi-token run is safe here in a way it would not be for
 * `10:00 - 20:00`, where the fold's destruction of everything under a
 * multi-token claim would delete the subtraction. Nothing under a phrase is
 * worth keeping: the words are adjacent by construction, and the only reading
 * they overlap with — chrono's, for the four phrases it also answers — claims
 * exactly the same span and so survives the fold as a sibling. It then loses on
 * `weight`; see `DEFAULT_PHRASE_WEIGHT`.
 */
const phraseLiteral =
  (opts: SnapOptions, weight: number): LiteralMatcher =>
  (input, offset, ctx) => {
    const phrase = phraseAt(input, offset);
    if (phrase === null) return null;
    const now = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
      ctx.timeZone,
    );
    const span = spanFor(phrase, now, opts);
    const value = build(input, span.start, span.end);
    return {
      kind: DATE_RANGE_KIND,
      unit: DATE_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: phrase.text.length,
      weight,
    };
  };

/**
 * "second week Aug 2027" — a week picked by its position in a month, rather
 * than by its distance from now. The counting is `@smartput/datetime`'s, shared
 * with "second monday in Aug 2027"; see `ordinal-week.ts` for which week of a
 * month is the second one.
 *
 * A separate matcher from `phraseLiteral` because the phrase table is a fixed
 * list of strings and this is a grammar: the month scope is open-ended, so
 * there is nothing to enumerate. It carries the same weight for the same
 * reason — nothing else claims the run today, and a claim that cannot lose is
 * a claim that cannot be corrected.
 */
const ordinalWeekLiteral =
  (opts: SnapOptions, weight: number): LiteralMatcher =>
  (input, offset, ctx) => {
    const match = ordinalWeekAt(input, offset, ctx, opts);
    if (match === null) return null;
    const value = build(input, match.span.start, match.span.end);
    return {
      kind: DATE_RANGE_KIND,
      unit: DATE_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: match.length,
      weight,
    };
  };

/** Both ends move by the same amount, so a shift preserves the span exactly. */
function shift(input: string, range: Value, duration: Value, sign: 1 | -1): Value {
  const { start, end } = unwrapRange(range);
  return build(
    input,
    addDuration(Temporal.ZonedDateTime.from(start), duration, sign),
    addDuration(Temporal.ZonedDateTime.from(end), duration, sign),
  );
}

/**
 * A span of calendar days. Opaque, because a range is not a scalar: its
 * canonical is the start instant purely so that ordering and comparison work
 * without the engine knowing what a range is.
 *
 * A factory as well as a constant so an embedder can move the week boundary or
 * retune the signature weight without forking the kind.
 */
export function createDateRange(opts: DateRangeOptions = {}): Kind {
  const weight = opts.signatureWeight ?? RANGE_WEIGHTS.signature;
  return defineKind({
    id: DATE_RANGE_KIND,
    value: { mode: "opaque", units: [DATE_RANGE_UNIT] },
    literals: [
      phraseLiteral(opts, opts.phraseWeight ?? DEFAULT_PHRASE_WEIGHT),
      ordinalWeekLiteral(opts, opts.phraseWeight ?? DEFAULT_PHRASE_WEIGHT),
    ],
    ops: [
      {
        // `to` and `as` are surface words for `in`, so "today to friday" and
        // "today - friday" are different expressions: this claims the first and
        // datetime's `- | date | date` duration keeps the second, which is what
        // everybody means by a subtraction between two days.
        op: "in",
        left: DATE_KIND,
        right: DATE_KIND,
        result: DATE_RANGE_KIND,
        weight,
        // A day is added to the right endpoint because the user means Friday
        // *included* and the stored end is exclusive.
        apply: (l, r, ctx) =>
          build(ctx.input ?? "", unwrapDate(l), unwrapDate(r).add({ days: 1 })),
      },
      {
        op: "+",
        left: DATE_RANGE_KIND,
        right: "duration",
        result: DATE_RANGE_KIND,
        apply: (l, r, ctx) => shift(ctx.input ?? "", l, r, 1),
      },
      {
        op: "-",
        left: DATE_RANGE_KIND,
        right: "duration",
        result: DATE_RANGE_KIND,
        apply: (l, r, ctx) => shift(ctx.input ?? "", l, r, -1),
      },
    ],
    format: formatRange,
  });
}

/** The kind as a consumer normally wants it: Monday weeks, the default weight. */
export const dateRange: Kind = createDateRange();
