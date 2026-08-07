import { Decimal, type Value } from "@smartput/core";
import { Temporal } from "@smartput/datetime";

export const TIME_KIND = "time";

/**
 * The kind's one unit, and deliberately not a time zone.
 *
 * See `@smartput/date`'s `DATE_UNIT` for the full argument: a `convert` node
 * takes its targets from the unit-alias index, so a `time` that copied
 * datetime's zone table would make "tokyo" a time target — and "10:00 in tokyo"
 * would match `in | time | time`, which is a time-range, and outscore the zone
 * conversion because both operands would agree on kind and collect the context
 * bonus. One unit closes that off by construction.
 *
 * Hyphenated for the reason `DATE_UNIT` gives at length: this kind ships no
 * vocabulary, so ruling R2 indexes the unit under its own id, and a bare
 * "clock" would be a typeable word that reads as a time.
 */
export const TIME_UNIT = "wall-clock";

export const NS_PER_DAY = new Decimal("86400000000000");

const NS_PER_SECOND = new Decimal("1000000000");
const NS_PER_MINUTE = new Decimal("60000000000");

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Nanoseconds since local midnight, read off the *wall clock* rather than
 * measured as elapsed time from `startOfDay()`.
 *
 * The two differ exactly once or twice a year. On a spring-forward day only 23
 * hours have elapsed by the following midnight, so an instant-based count would
 * make 10:00 read 09:00's number; on a fall-back day 24:30 would exist and the
 * count would leave the `0 <= x < 86_400e9` range the design fixes for this
 * kind. A clock time is a wall-clock fact — "10:00 to 20:00 is ten hours
 * whatever day it lands on" — so the fields are the source of truth and the
 * instant is not.
 */
function nanosecondOfDay(zdt: Temporal.ZonedDateTime): Decimal {
  const seconds = (zdt.hour * 60 + zdt.minute) * 60 + zdt.second;
  return new Decimal(seconds)
    .times(NS_PER_SECOND)
    .plus(zdt.millisecond * 1_000_000)
    .plus(zdt.microsecond * 1_000)
    .plus(zdt.nanosecond);
}

/**
 * Canonical is nanoseconds since local midnight, not an epoch count.
 *
 * Two clock times compared across different days must still order by clock, and
 * 10:00 to 20:00 is ten hours whatever day it lands on. `meta.iso` still keeps
 * the full zoned string, so `unwrap` can rebuild the day chrono resolved without
 * re-deriving it — the same trick `@smartput/datetime`'s `value.ts` uses.
 */
export function wrap(zdt: Temporal.ZonedDateTime): Value {
  return Object.freeze({
    kind: TIME_KIND,
    canonical: nanosecondOfDay(zdt),
    unit: TIME_UNIT,
    meta: Object.freeze({
      iso: zdt.toString(),
      hms: `${pad(zdt.hour)}:${pad(zdt.minute)}:${pad(zdt.second)}`,
      zone: zdt.timeZoneId,
    }),
  });
}

export function unwrap(value: Value): Temporal.ZonedDateTime {
  const iso = value.meta?.iso;
  if (typeof iso !== "string") {
    throw new TypeError(`time value is missing meta.iso: ${JSON.stringify(value.unit)}`);
  }
  return Temporal.ZonedDateTime.from(iso);
}

/**
 * `hh:mm` from a canonical nanosecond-of-day count.
 *
 * The double modulo folds a count that has left the day back into it, in either
 * direction: `wrap` never produces one, because it re-reads the wall clock of
 * whatever instant the arithmetic landed on, but a value built by hand — a
 * range endpoint, a snapped window — can, and "25:00" is not a clock time.
 */
export function formatClock(canonical: Decimal): string {
  const total = canonical.mod(NS_PER_DAY).plus(NS_PER_DAY).mod(NS_PER_DAY);
  const minutes = total.div(NS_PER_MINUTE).floor().toNumber();
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
