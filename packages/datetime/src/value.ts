import { Decimal, type Value } from "@smartput/core";
import { Temporal } from "./temporal";

export const DATETIME_KIND = "datetime";
export const DURATION_KIND = "duration";

const NS_PER_SECOND = new Decimal(1e9);

/**
 * A datetime `Value` is an ordinary `Value` — no new field, no class instance.
 *
 * `canonical` is the epoch nanosecond count, which is what makes ordering and
 * subtraction work without the engine knowing what a date is. The zone and the
 * wall clock live on `meta.iso`, as a string rather than a Temporal object:
 * `Result` has to survive `JSON.stringify` for `@smartput/http`, and core's
 * `deepFreeze` walks whatever it is handed.
 */
export function wrap(zdt: Temporal.ZonedDateTime): Value {
  return Object.freeze({
    kind: DATETIME_KIND,
    canonical: new Decimal(zdt.epochNanoseconds.toString()),
    unit: zdt.timeZoneId,
    meta: Object.freeze({ iso: zdt.toString() }),
  });
}

export function unwrap(value: Value): Temporal.ZonedDateTime {
  const iso = value.meta?.iso;
  if (typeof iso !== "string") {
    throw new TypeError(
      `datetime value is missing meta.iso: ${JSON.stringify(value.unit)}`,
    );
  }
  return Temporal.ZonedDateTime.from(iso);
}

/** Seconds per core duration unit. Mirrors `duration.ts`'s ratio table. */
const DURATION_SECONDS: Record<string, number> = {
  ms: 0.001,
  s: 1,
  min: 60,
  h: 3_600,
  d: 86_400,
  wk: 604_800,
};

/** Largest first: `durationValue` reports in the biggest unit that reads >= 1. */
const DURATION_SCALE: Array<[string, number]> = [
  ["wk", 604_800],
  ["d", 86_400],
  ["h", 3_600],
  ["min", 60],
  ["s", 1],
  ["ms", 0.001],
];

/**
 * The difference between two datetimes, as a core `duration`.
 *
 * Spec §8 says the result keeps the left operand's unit, but the left operand
 * here is a datetime whose "unit" is a time zone — there is no unit to keep. So
 * the largest unit the magnitude fills is chosen instead, which is what makes
 * a three-week gap read as "3wk" rather than "1814400s".
 */
export function durationValue(nanoseconds: Decimal): Value {
  const seconds = nanoseconds.div(NS_PER_SECOND);
  const magnitude = seconds.abs();
  const found = DURATION_SCALE.find(([, size]) => magnitude.gte(size));
  return Object.freeze({
    kind: DURATION_KIND,
    canonical: seconds,
    unit: found?.[0] ?? "s",
  });
}

/**
 * Adds (sign 1) or subtracts (sign -1) a core `duration` from a datetime.
 *
 * A whole number of days or weeks is added through the *calendar*, so a DST
 * boundary moves the wall clock rather than the instant — spec §8's "date math
 * uses Temporal, never milliseconds". Everything else is exact: two hours is
 * two hours whatever the calendar is doing.
 */
export function addDuration(
  zdt: Temporal.ZonedDateTime,
  duration: Value,
  sign: 1 | -1,
): Temporal.ZonedDateTime {
  const perUnit = DURATION_SECONDS[duration.unit];
  const authored =
    perUnit === undefined ? null : duration.canonical.div(perUnit).times(sign);

  if (authored?.isInteger()) {
    if (duration.unit === "d") return zdt.add({ days: authored.toNumber() });
    if (duration.unit === "wk") return zdt.add({ weeks: authored.toNumber() });
  }

  const nanoseconds = duration.canonical.times(NS_PER_SECOND).times(sign);
  return zdt.add(Temporal.Duration.from({ nanoseconds: Number(nanoseconds.toFixed(0)) }));
}
