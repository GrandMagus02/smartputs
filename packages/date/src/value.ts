import { Decimal, type Value } from "@smartput/core";
import { Temporal } from "@smartput/datetime";

export const DATE_KIND = "date";

/**
 * The kind's one unit, and deliberately not a time zone.
 *
 * A `convert` node takes its targets from the unit-alias index, so a `date`
 * that copied datetime's zone table would make "tokyo" a date target — and
 * "today in tokyo" would match `in | date | date`, which is a date-range, and
 * outscore the zone conversion because both operands would agree on kind and
 * collect the context bonus. One unit closes that off by construction.
 *
 * It registers no aliases at all, which is the other half of the same guard:
 * the word "day" is `duration`'s, and an alias here would give the solver a
 * second kind to consider for "3 days".
 */
export const DATE_UNIT = "day";

/** Midnight of `zdt`'s calendar day, in `zdt`'s own zone. */
export function startOfDay(zdt: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  return zdt.startOfDay();
}

/**
 * A date `Value`: the same ordinary `Value` every other kind produces, with the
 * day's midnight instant as `canonical` so ordering and comparison work without
 * the engine knowing what a date is.
 *
 * `meta.iso` is the full zoned string, which is what `unwrap` rebuilds from;
 * `meta.day` is the plain calendar date the formatter prints; `meta.zone` is
 * the zone the two of them were read in. Strings rather than `Temporal`
 * objects, for the reason `@smartput/datetime`'s `value.ts` gives: a `Result`
 * has to survive `JSON.stringify` for `@smartput/http`, and core's `deepFreeze`
 * walks whatever it is handed.
 */
export function wrap(zdt: Temporal.ZonedDateTime): Value {
  const day = startOfDay(zdt);
  return Object.freeze({
    kind: DATE_KIND,
    canonical: new Decimal(day.epochNanoseconds.toString()),
    unit: DATE_UNIT,
    meta: Object.freeze({
      iso: day.toString(),
      day: day.toPlainDate().toString(),
      zone: day.timeZoneId,
    }),
  });
}

export function unwrap(value: Value): Temporal.ZonedDateTime {
  const iso = value.meta?.iso;
  if (typeof iso !== "string") {
    throw new TypeError(`date value is missing meta.iso: ${JSON.stringify(value.unit)}`);
  }
  return Temporal.ZonedDateTime.from(iso);
}
