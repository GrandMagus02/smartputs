import type { UnitTable } from "@smartput/shared";

export type TempoUnit = "bpm" | "hz";

/**
 * Canonical beats per minute, because the kind exists for musical tempo and
 * bpm is the number a person types. Hertz is one cycle per second, so exactly
 * 60 per minute — an integer, with nothing for a decimal string to round.
 * Unlike `speed`'s knot there is no definition to re-derive, so this package
 * ships no `units.test.ts`.
 *
 * Two units, deliberately. The other spellings people reach for — "period",
 * "ms per beat", "seconds per cycle" — are all the *duration* side of the same
 * quantity, and `index.ts` answers those with `in | tempo | duration` rather
 * than with more rows here. A `spb` unit would be a second way to say what the
 * bridge already says, and the two would then have to agree.
 *
 * `hertz` is spelled out as an alias because it is also its own plural, so the
 * English vocabulary in `locale/en.ts` can carry it as a `forms` entry that
 * parses back. `bpm` has no such form: "beats per minute" is a compound the
 * parser rejects, the same reason `speed`'s mps/kph carry none.
 */
export const TEMPO_UNITS: UnitTable<TempoUnit> = {
  canonical: "bpm",
  ratio: {
    bpm: "1",
    hz: "60",
  },
  alias: {
    bpm: "bpm",
    hz: "hz",
    hertz: "hz",
  },
};
