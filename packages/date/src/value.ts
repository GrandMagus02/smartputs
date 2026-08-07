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
 * It ships no vocabulary at all, which is the other half of the same guard: the
 * word "day" is `duration`'s, and an alias here would give the solver a second
 * kind to consider for "3 days".
 *
 * Which is why the id is hyphenated rather than the bare "day" it used to be.
 * Ruling R2 indexes a unit under its own registry key whenever no installed
 * language has spoken for the kind, and a kind that ships no vocabulary in any
 * language is exactly that case — so the id *is* the alias now, and "registers
 * no aliases" stopped being something a kind can arrange. `lex` builds a word
 * token out of `\p{L}` runs alone, so one non-letter is what puts the sentinel
 * back out of reach. `@smartput/time-range`'s `clock-span` had the shape
 * already; this is the same convention, now load-bearing.
 */
export const DATE_UNIT = "calendar-day";

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
