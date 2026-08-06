/**
 * The vocabulary of this package, in a module of its own so a consumer can
 * `import type` it without pulling `date-holidays` in behind it.
 *
 * None of these types are re-exports of `HolidaysTypes`. Handing the library's
 * own `Holiday` back would put `date-holidays` in the *type* surface of every
 * consumer — the subpath that exists precisely so nobody pays a megabyte they
 * did not ask for would then be unavoidable for anyone who so much as names the
 * return type. Declaring the five fields here costs one mapping function in
 * `source.ts` and keeps the dependency behind the door.
 */

/**
 * The five kinds `date-holidays` distinguishes. Repeated rather than aliased to
 * `HolidaysTypes.HolidayType` for the reason above; the union is checked against
 * the library's at the one place the two meet.
 */
export type HolidayType = "public" | "bank" | "school" | "optional" | "observance";

/** Where to ask. Every field optional — see `DEFAULT_COUNTRY` for what an absent country means. */
export interface HolidayPlace {
  /** ISO 3166-1 alpha-2. Case-insensitive; upper-cased before it reaches the library. */
  country?: string;
  /** ISO 3166-2, e.g. `"ENG"` for England. */
  state?: string;
  /** Sub-state region, only meaningful alongside a state. */
  region?: string;
}

/** One occurrence of one holiday, in one place, in one year. */
export interface HolidayOccurrence {
  /** Canonical English name, e.g. `"Christmas Day"`. */
  name: string;
  type: HolidayType;
  /**
   * Epoch ms of the holiday's start, anchored to **UTC midnight of the local
   * calendar date** — see the `TIMEZONE` note in `source.ts`. Ukrainian
   * Christmas is 2026-12-25T00:00:00Z here, not the 2026-12-24T22:00:00Z that
   * Kyiv's own midnight would give.
   */
  start: number;
  /** Epoch ms of the end, usually `start` plus a day. Part-day rules exist. */
  end: number;
  /** The `date-holidays` rule that generated this occurrence, verbatim. */
  rule: string;
  /**
   * The country asked about, upper-cased. Carried over from the query rather
   * than read off the result: `HolidaysTypes.Holiday` has no country field, and
   * a match with no way back to the place it came from is not usable by a
   * caller that searches more than one.
   */
  country: string;
  /**
   * True for the "day off in lieu" entries — `"Boxing Day (substitute day)"`.
   * Not in the plan's field list, but the scorer's behaviour around these is
   * observable (see `find.ts`) and a caller that wants to hide them should not
   * have to pattern-match on the name to find out.
   */
  substitute: boolean;
}

/** An occurrence together with why it ranked where it did. */
export interface HolidayMatch extends HolidayOccurrence {
  /**
   * `nameScore - proximityPenalty`, in `[0, 1]`. The number `minScore` filters
   * on. It is *not* the sort key — `find.ts` explains why.
   */
  score: number;
  /** The similarity half alone, in `[0, 1]`. `1` for every candidate of a nameless query. */
  nameScore: number;
}

export interface HolidayQuery {
  /**
   * The phrase as typed. Case and punctuation are normalised away. Empty or
   * absent makes this a question about *when*, not about *which* — see the two
   * query shapes in `find.ts`.
   */
  name?: string;
  /** Epoch ms. Everything is scored relative to this; nothing reads the host clock. */
  now: number;
  /**
   * Restrict to one type. Absent means no restriction on a named query and
   * `"public"` on a nameless one; `find.ts` states both halves of that ruling.
   */
  type?: HolidayType;
}

export interface FindHolidayOptions {
  /** How many matches to return, best first. Default 5. */
  limit?: number;
  /** Below this a match is a guess, not an answer. Default 0.6. */
  minScore?: number;
  /** Used when `place.country` is absent. Default `"US"`. */
  defaultCountry?: string;
}
