import Holidays from "date-holidays";
import type { HolidayOccurrence, HolidayPlace } from "./types";

/**
 * The one place `date-holidays` is touched. Everything above this file works on
 * `HolidayOccurrence`, which is why the scorer can be tested without a country
 * in sight.
 *
 * `import Holidays from "date-holidays"` is the class itself, not a namespace
 * object: 3.34.1 is dual-published and its `exports` map points the `import`
 * condition at real ESM whose last line is `export { Holidays as default }`.
 * There is no interop shim here because there is nothing to shim.
 */

/**
 * Names come back in the country's *own* language by default, not in English —
 * `new Holidays("UA")` answers "Різдво Христове", and an English query scores 0
 * against it. Pinning the language is therefore not a nicety, it is what makes
 * the named half of `findHoliday` work outside anglophone countries.
 *
 * English only, and not configurable: M5 owns i18n, and a language option added
 * here now would have to be threaded through the scorer's tokeniser, which is
 * ASCII-shaped. It is in the cache key anyway so that making it configurable
 * later is a change to one function rather than to the cache's correctness.
 */
const LANGUAGE = "en";

/**
 * Every date is read as UTC, so `start` is UTC midnight of the day the holiday
 * falls on.
 *
 * The rejected alternative is the library's default, which anchors `start` to
 * midnight in the country's *first* time zone. That is a defensible instant and
 * it is host-independent either way, but it makes `start` render as the wrong
 * day for any consumer not standing in that country: Ukrainian Christmas comes
 * back as 2026-12-24T22:00:00Z, and a caller formatting it in UTC prints
 * Christmas Eve. The fact a holiday actually carries is a calendar date, so the
 * epoch we hand out is the one whose UTC fields spell that date.
 */
const TIMEZONE = "UTC";

/**
 * Where to look when the caller names no country.
 *
 * Stated because it is arbitrary and someone will want it different:
 * `date-holidays` cannot enumerate without a country — there is no global
 * holiday set — and sweeping all 206 would be both slow and ambiguous, since
 * "labour day" exists in dozens of them on different dates. A default that one
 * argument overrides beats a search that returns noise.
 */
export const DEFAULT_COUNTRY = "US";

/** A `HolidayPlace` with every hole filled, so it can be a cache key. */
export interface ResolvedPlace {
  country: string;
  state: string;
  region: string;
}

export function resolvePlace(
  place: HolidayPlace | undefined,
  fallbackCountry: string,
): ResolvedPlace {
  return {
    // Upper-cased because a launcher may hand either case and ISO codes are
    // upper — the library accepts "us", but two casings would otherwise be two
    // cache entries and two `country` fields for one country.
    country: (place?.country ?? fallbackCountry).toUpperCase(),
    state: place?.state ?? "",
    region: place?.region ?? "",
  };
}

function keyOf(place: ResolvedPlace): string {
  return `${place.country}|${place.state}|${place.region}|${LANGUAGE}`;
}

/**
 * Both caches are unbounded, which is fine because the key space is the set of
 * places the caller actually asks about — one or two in a launcher, not 206.
 * Retaining fifty `Holidays` instances measured as a ~0 KB heap delta: they
 * share one frozen rule table rather than copying it.
 */
const instances = new Map<string, Holidays>();
const years = new Map<string, readonly HolidayOccurrence[]>();

/**
 * Construction is *not* the expensive part — it measures at ~0.1 ms. The cost
 * this cache exists for is `getHolidays(year)`, which has no internal memo at
 * all: asking the same instance for the same year twice re-parses the rules
 * both times, at ~0.5 ms a year, so the three-year candidate sweep below is
 * ~1.3 ms. A launcher re-scoring on every keystroke pays that per keystroke.
 * The instance cache is kept as well, but it is the smaller half of the win.
 */
function instanceFor(place: ResolvedPlace): Holidays {
  const key = keyOf(place);
  const cached = instances.get(key);
  if (cached !== undefined) return cached;

  const opts = { languages: LANGUAGE, timezone: TIMEZONE };
  // The positional overloads rather than the `{ country, state, region }` one:
  // `HolidaysTypes.Country` declares `state?: string`, and under the repo's
  // `exactOptionalPropertyTypes` a struct carrying `state: string | undefined`
  // is not assignable to it. Building the object conditionally would work too
  // and reads worse than this.
  //
  // A region without a state is dropped rather than passed: the library keys
  // regions under a state, so `(country, "", region)` names nothing.
  const made =
    place.state !== "" && place.region !== ""
      ? new Holidays(place.country, place.state, place.region, opts)
      : place.state !== ""
        ? new Holidays(place.country, place.state, opts)
        : new Holidays(place.country, opts);

  instances.set(key, made);
  return made;
}

/**
 * Every occurrence in one year, in one place, best-effort.
 *
 * An unknown country comes back empty rather than throwing, matching the
 * library — `new Holidays("ZZ")` constructs and answers nothing. That is the
 * right shape here too: `findHoliday`'s contract is already "empty when nothing
 * matches", and a launcher holding a stale country code should degrade to no
 * answer rather than throw mid-keystroke. `holidayCountries()` is what a caller
 * that wants to know uses.
 */
export function occurrences(
  year: number,
  place: ResolvedPlace,
): readonly HolidayOccurrence[] {
  const key = `${keyOf(place)}|${year}`;
  const cached = years.get(key);
  if (cached !== undefined) return cached;

  const list = instanceFor(place)
    .getHolidays(year)
    .map<HolidayOccurrence>((raw) => ({
      name: raw.name,
      type: raw.type,
      start: raw.start.getTime(),
      end: raw.end.getTime(),
      // `isHoliday()` omits `rule` at runtime despite the types requiring it;
      // `getHolidays()` always carries it, and the fallback costs nothing.
      rule: raw.rule ?? "",
      country: place.country,
      substitute: raw.substitute === true,
    }));

  // Frozen because the array is handed out by reference and kept: a caller that
  // sorted it in place would corrupt every later query for the same year.
  const frozen = Object.freeze(list.map((item) => Object.freeze(item)));
  years.set(key, frozen);
  return frozen;
}

/** The raw list for one year, for callers that want to do their own thing with it. */
export function holidaysFor(
  year: number,
  place?: HolidayPlace,
): readonly HolidayOccurrence[] {
  return occurrences(year, resolvePlace(place, DEFAULT_COUNTRY));
}

let countries: Readonly<Record<string, string>> | null = null;

/**
 * Every country code `date-holidays` knows, mapped to its English name, so a
 * consumer can validate a code without constructing a `Holidays` — and without
 * discovering the code was wrong by getting an empty result back.
 *
 * English names explicitly: the no-argument form answers in each country's own
 * language ("Україна"), which is fine for a lookup key and wrong for anything
 * shown to a user.
 */
export function holidayCountries(): Readonly<Record<string, string>> {
  countries ??= Object.freeze({ ...new Holidays().getCountries(LANGUAGE) });
  return countries;
}
