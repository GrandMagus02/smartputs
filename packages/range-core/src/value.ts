import type { Decimal, Value } from "@smartput/core";
import { Temporal } from "@smartput/datetime";
import { InvertedRangeError } from "./errors";

export interface RangeMeta extends Record<string, unknown> {
  /** ISO zoned string of the inclusive start. */
  start: string;
  /**
   * ISO zoned string of the **exclusive** end (design §3.1). Only
   * `date-range`'s formatter subtracts a day for display; everything stored is
   * half-open so span arithmetic needs no off-by-one correction.
   */
  end: string;
  /**
   * IANA zone the two ends are read in, or the empty string for a clock span,
   * which is not anchored to a zone at all. Empty is a legitimate value here,
   * not a missing one — `unwrapRange` accepts it.
   */
  zone: string;
}

/**
 * Throws unless `end` is strictly after `start`. Not called by `time-range`.
 *
 * Strictly: an empty range is a mistake in every phrase that can produce one.
 * `from today to today` is either a typo or a misparse, and returning a
 * zero-length span would let it travel silently into arithmetic downstream.
 *
 * The comparison is `Temporal.ZonedDateTime.compare`, which orders by instant.
 * Comparing wall clocks would call 23:00 in Tokyo later than 20:00 UTC when it
 * is in fact six hours earlier.
 */
export function assertOrdered(
  input: string,
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime,
): void {
  if (Temporal.ZonedDateTime.compare(end, start) > 0) return;
  throw new InvertedRangeError(input, start.toString(), end.toString());
}

/**
 * `canonical` is the start, so ordering and comparison work without the engine
 * knowing what a range is — the same trick datetime plays with epoch
 * nanoseconds.
 *
 * The ends live on `meta` as ISO strings rather than `Temporal` objects for the
 * same reason datetime's do: a `Result` has to survive `JSON.stringify` for
 * `@smartput/http`, and core's `deepFreeze` walks whatever it is handed.
 */
export function wrapRange(
  kind: string,
  unit: string,
  canonical: Decimal,
  meta: RangeMeta,
): Value {
  return Object.freeze({ kind, canonical, unit, meta: Object.freeze({ ...meta }) });
}

/**
 * The three keys every range kind stores, checked rather than asserted.
 *
 * A `Value` reaching a range formatter is not necessarily a range value — the
 * engine hands formatters whatever won — so this is a real guard, and it
 * reports the kind because that is what identifies the mistake.
 */
export function unwrapRange(value: Value): { start: string; end: string; zone: string } {
  const { start, end, zone } = (value.meta ?? {}) as Partial<RangeMeta>;
  if (typeof start !== "string" || typeof end !== "string" || typeof zone !== "string") {
    throw new TypeError(`range value is missing start/end/zone: ${value.kind}`);
  }
  return { start, end, zone };
}
