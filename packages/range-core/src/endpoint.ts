import type { MatchCtx } from "@smartput/core";
import type { Temporal } from "@smartput/datetime";

export interface Endpoint {
  zdt: Temporal.ZonedDateTime;
  /** Characters of `text` the parser consumed, so the caller can advance. */
  length: number;
}

/**
 * How a range matcher resolves one end of "from X to Y".
 *
 * A seam rather than a direct call to `parseDateTime`, so that the
 * `@smartput/datetime-range/holiday` subpath can add `findHoliday` without the
 * root entry ever reaching `date-holidays` and its 768 KB rule table.
 */
export type EndpointParser = (text: string, ctx: MatchCtx) => Endpoint | null;

/**
 * First parser to claim the text wins. Order is the caller's preference.
 *
 * Preference, not precision: there is no scoring here and no attempt to pick
 * the longest claim. The root entry passes `[datetimeEndpoint]` and the holiday
 * subpath passes `[datetimeEndpoint, holidayEndpoint]`, so the ordering is a
 * two-element decision the call site makes deliberately. A ranking layer would
 * be a second, weaker copy of the solver's job.
 */
export function resolveEndpoint(
  text: string,
  ctx: MatchCtx,
  parsers: readonly EndpointParser[],
): Endpoint | null {
  for (const parse of parsers) {
    const hit = parse(text, ctx);
    if (hit !== null) return hit;
  }
  return null;
}
