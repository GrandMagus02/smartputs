/**
 * The opt-in half of this package, and the only module that reaches
 * `@smartput/holiday`. Importing `@smartput/datetime-range` therefore never
 * reaches `date-holidays` — a 768 KB rule table nobody asking for "whole week"
 * agreed to download. `check-size.ts`'s `datetime-range root (no holiday data)`
 * row fails by a megabyte the moment this import lands in the root graph.
 *
 * **It reaches holiday through `@smartput/datetime/holiday`, not through
 * `findHoliday`.** That subpath already owns the whole phrase grammar — the
 * selector ("next", "closest"), the shift ("day before", "3 weeks after"), the
 * type nouns, the name scorer with its `verbatim` gate, the pool-by-canonical-
 * name rule, and the accept-gate that keeps "days" in "3 days + 2 days" from
 * scoring against "Christmas Day". Calling `findHoliday` here would be a second,
 * worse copy of all of it, and the two copies would answer "day before
 * christmas" differently the first time either was touched. What this file adds
 * is the last inch: a `LiteralMatcher` speaks core's claim shape and an
 * `EndpointParser` speaks `range-core`'s, so the adapter below is the whole job.
 */
import type { Kind } from "@smartput/core";
import { unwrap } from "@smartput/datetime";
import {
  createHolidayLiteral,
  type HolidayLiteralOptions,
} from "@smartput/datetime/holiday";
import type { HolidayPlace } from "@smartput/holiday";
import type { EndpointParser } from "@smartput/range-core";
import { createDatetimeRange, type DatetimeRangeOptions } from "./datetime-range";
import { datetimeEndpoint } from "./phrases";

/**
 * Both re-exported so an embedder can spell `place` and `minScore` without
 * importing two more packages to do it — and, less cosmetically, so the emitted
 * `holiday.d.ts` names `@smartput/holiday` the way `check-deps.ts`'s entry for
 * this manifest says it does. A published declaration naming a package the
 * manifest omits is a dependency a consumer discovers on install.
 */
export type { HolidayLiteralOptions, HolidayPlace };

/**
 * One end of a range, resolved by the holiday grammar.
 *
 * The bridge's matcher is built once and reused across calls, because
 * `createHolidayLiteral` closes over a `FindHolidayOptions` it assembles
 * eagerly; rebuilding it per endpoint would rebuild that object twice for every
 * "from X to Y".
 *
 * `unwrap` rather than reading `meta.iso` by hand: a `LiteralMatch` is
 * structurally a `Value`, and `@smartput/datetime` already owns the one place
 * that knows how a zoned datetime survives the round trip through `meta`.
 *
 * The offset is always 0. An `EndpointParser` is handed a segment that `fromToAt`
 * has already cut at the closer, not the whole input, and the `length` it
 * returns is measured from the start of that segment — which is exactly what
 * offset 0 gives.
 *
 * A `LiteralMatcher` may hand back an array, and core's contract for one is
 * "several readings of the *same* text, ranked, best first". Today's bridge
 * returns a single match — the offset grammar picks exactly one occurrence —
 * but an endpoint has one slot either way, so the first reading is taken and the
 * rest are dropped. Not a lost ranking: `resolveEndpoint` is preference and not
 * scoring, so there is nothing downstream that could have chosen between them.
 */
export function createHolidayEndpoint(opts: HolidayLiteralOptions = {}): EndpointParser {
  const matcher = createHolidayLiteral(opts);
  return (text, ctx) => {
    const found = matcher(text, 0, ctx);
    const match = found === null ? undefined : Array.isArray(found) ? found[0] : found;
    return match === undefined ? null : { zdt: unwrap(match), length: match.length };
  };
}

/** The endpoint parser with the bridge's defaults: `"US"`, `minScore` 0.6. */
export const holidayEndpoint: EndpointParser = createHolidayEndpoint();

/**
 * Everything `createDatetimeRange` takes except the parser list, plus
 * everything the holiday grammar takes.
 *
 * `parsers` is omitted rather than merged because it is the one option this
 * factory exists to supply: a caller who passed their own list would either
 * lose the holiday endpoint — making the subpath a no-op — or have it appended
 * to a list they thought was exhaustive. A caller who genuinely wants a third
 * parser composes `createDatetimeRange({ parsers: [...] })` with
 * `holidayEndpoint` directly, which is the same call with the ordering visible.
 */
export interface DatetimeRangeHolidayOptions
  extends Omit<DatetimeRangeOptions, "parsers">,
    HolidayLiteralOptions {}

/**
 * `datetimeRange` with holiday endpoints behind it. A drop-in replacement for
 * the root export in an engine's `kinds` list — the same kind id, the same unit,
 * the same window grammar — so register one or the other, never both. This
 * mirrors `datetimeWithHolidays` in `@smartput/datetime`, deliberately: the two
 * subpaths make the same trade and should read the same way.
 *
 * `datetimeEndpoint` stays first. `resolveEndpoint` is preference, not scoring,
 * and a segment chrono can read is a date — the holiday grammar's name scorer
 * is an edit-distance guess, and a guess must not cost the reading that was
 * already right. That is the same ordering rule the bridge's matcher enforces
 * internally against `parseDateTime`, applied one level up.
 */
export function createDatetimeRangeHoliday(opts: DatetimeRangeHolidayOptions = {}): Kind {
  const { place, defaultCountry, minScore, ...range } = opts;
  // Spread conditionally: the repo compiles with `exactOptionalPropertyTypes`,
  // so `{ place: undefined }` is not an absent `place`.
  const holiday = createHolidayEndpoint({
    ...(place === undefined ? {} : { place }),
    ...(defaultCountry === undefined ? {} : { defaultCountry }),
    ...(minScore === undefined ? {} : { minScore }),
  });
  return createDatetimeRange({ ...range, parsers: [datetimeEndpoint, holiday] });
}

/** The kind as a consumer normally wants it: default windows, default place. */
export const datetimeRangeHoliday: Kind = createDatetimeRange({
  parsers: [datetimeEndpoint, holidayEndpoint],
});
