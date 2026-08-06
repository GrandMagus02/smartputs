import { defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { addDuration, parseDateTime } from "@smartput/datetime";
import { formatClock, TIME_KIND, TIME_UNIT, unwrap, wrap } from "./value";

export interface TimeOptions {
  /**
   * Summed into every claim this kind makes. Negative by default so that a bare
   * "3pm" still reads as a `datetime` and formats as it always has; the range
   * signatures in `@smartput/time-range` carry +20 of their own, which is what
   * lets "10:00 - 20:00" outscore `datetime - datetime`.
   */
  weight?: number;
}

export const DEFAULT_TIME_WEIGHT = -5;

/**
 * The one matcher this kind registers, and it does not run chrono.
 *
 * `@smartput/datetime` has already read the span; this re-reads the *same*
 * match through the bridge and claims it only when the user typed a clock time
 * and no calendar day. Claiming the identical span is what makes the two
 * readings coexist: `foldLiterals` ties on `end` and carries both forward, so
 * "3pm" reaches the solver as `[datetime, time]` rather than as whichever kind
 * happened to be registered first.
 */
const timeLiteral =
  (weight: number): LiteralMatcher =>
  (input, offset, ctx) => {
    const match = parseDateTime(input, offset, ctx);
    if (match === null) return null;
    // A clock the user named, and no calendar day. "2026-03-01 08:00" is both
    // and belongs to datetime alone; "today" is neither and belongs to `date`.
    if (!match.hasTime || match.hasDate) return null;
    const value = wrap(match.zdt);
    return {
      kind: TIME_KIND,
      unit: value.unit,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: match.length,
      weight,
      // "20:00" has to be able to stand on the right of `to`.
      targetable: true,
    };
  };

/**
 * A clock time with no calendar day. Opaque, because its canonical is a
 * nanosecond-of-day count rather than a point on a ratio line with convertible
 * units, and every operation it supports is a declared signature.
 *
 * Neither `in` nor `- | time | time` is declared here. There is no zone to
 * convert to — the unit slot went to `clock` — so "10:00 in tokyo" keeps
 * resolving through `in | datetime | datetime`, and the two-clock subtraction
 * belongs to `@smartput/time-range`, which owns the signature that turns it
 * into a span rather than a duration.
 */
export function createTime(opts: TimeOptions = {}): Kind {
  return defineKind({
    id: TIME_KIND,
    value: { mode: "opaque", units: { [TIME_UNIT]: { aliases: [], symbol: "" } } },
    literals: [timeLiteral(opts.weight ?? DEFAULT_TIME_WEIGHT)],
    ops: [
      {
        // Arithmetic runs on the *instant* chrono resolved, not on the
        // nanosecond count, so "23:30 + 90 min" rolls into the next day through
        // Temporal and comes back as 01:00 — `wrap` reads the wall clock of
        // wherever it landed and the day falls away again.
        op: "+",
        left: TIME_KIND,
        right: "duration",
        result: TIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, 1)),
      },
      {
        // "90 min + 10:00" is the same expression written the other way round,
        // and a solver with no signature for it reports a dimension mismatch on
        // input a user considers obviously fine.
        op: "+",
        left: "duration",
        right: TIME_KIND,
        result: TIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(r), l, 1)),
      },
      {
        op: "-",
        left: TIME_KIND,
        right: "duration",
        result: TIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, -1)),
      },
    ],
    format: (value) => formatClock(value.canonical),
  });
}

/** The kind as every consumer gets it: the default weight, no overrides. */
export const time: Kind = createTime();
