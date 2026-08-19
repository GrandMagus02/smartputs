import type { MatchCtx } from "@smartput/core";
import type * as chrono from "chrono-node";
import { Temporal } from "./temporal";

/**
 * chrono's reference has to be expressed in the *engine's* time zone, not the
 * host's, or an injected clock stops being deterministic: chrono fills implied
 * components (the date behind "3pm") from the reference's local wall clock, and
 * a JS Date's local wall clock is the machine's.
 *
 * Its own file because both callers — the bridge and the ordinal-weekday
 * recognizer that runs ahead of it — have to build the *same* reference, and a
 * second copy that drifted would give one grammar a different "today" from the
 * other.
 */
export function referenceFor(ctx: MatchCtx): chrono.ParsingReference {
  const zoned = Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(
    ctx.timeZone,
  );
  return {
    instant: new Date(ctx.now),
    timezone: zoned.offsetNanoseconds / 60_000_000_000,
  };
}
