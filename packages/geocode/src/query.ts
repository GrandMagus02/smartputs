import { SmartputError } from "@smartput/core";
import { normalizeName, type Place } from "./place";

/**
 * What a hit is, as coarsely as a consumer needs to filter. Not GeoNames'
 * feature codes, which are 600 of them and a vocabulary no caller has: a
 * launcher's question is "cities only" or "not a POI", and every provider can
 * answer at this granularity or be mapped to it.
 */
export type GeocodeKind = "country" | "admin" | "city" | "postal" | "address" | "poi";

export interface GeocodeQuery {
  readonly text: string;
  /**
   * Proximity bias. Deliberately not a filter (spec §4.1): it is how a launcher
   * says "I am in Berlin, prefer things near me", and a user in Berlin must
   * still be able to find Tokyo.
   */
  readonly near?: { readonly lat: number; readonly lon: number };
  /** `[west, south, east, north]`. A filter: outside is dropped. */
  readonly bbox?: readonly [number, number, number, number];
  /** ISO 3166-1 alpha-2, any case. A filter. */
  readonly countries?: readonly string[];
  /** A filter. Absent means every kind the provider can answer. */
  readonly kinds?: readonly GeocodeKind[];
  /** BCP 47, for providers carrying one name per language. */
  readonly lang?: string;
  readonly limit?: number;
  readonly signal?: AbortSignal;
  /**
   * The Enter-key query rather than the typing (spec §5.3). Providers that
   * declare `interactive: false` run only on a committed query.
   */
  readonly committed?: boolean;
}

/**
 * One candidate. It *wraps* a `Place` rather than widening it, because `score`,
 * `matched` and `source` are facts about a search and not about a place, and a
 * `Place` travels into a Value's meta where all three mean nothing.
 */
export interface GeocodeHit {
  readonly place: Place;
  readonly kind: GeocodeKind;
  /** 0..1, comparable across providers because `Geocoder` recomputes it (§6). */
  readonly score: number;
  /** The name or alias that hit — what a UI highlights. */
  readonly matched: string;
  /** Provider id, for attribution and for debugging a merge. */
  readonly source: string;
}

export interface GeocodeProvider {
  readonly id: string;
  /** Shown wherever results are. ODbL and CC BY both require it. */
  readonly attribution: string;
  /**
   * May this provider be called on every keystroke?
   *
   * Typed rather than documented because it is a licence condition and not a
   * performance hint: the OSMF Nominatim policy forbids client-side autocomplete
   * outright, and a README paragraph is what every consumer skips (§4.3).
   */
  readonly interactive: boolean;
  /** A local index this provider can answer from with no I/O, if it has one. */
  readonly snapshot?: PlaceSnapshotLike;
  search(q: GeocodeQuery): Promise<readonly GeocodeHit[]>;
  reverse?(lat: number, lon: number, q?: GeocodeQuery): Promise<readonly GeocodeHit[]>;
}

/**
 * Structural rather than an import of `PlaceLookup`, so a provider can expose a
 * lookup without this file deciding what a snapshot is made of.
 */
export interface PlaceSnapshotLike {
  find(name: string): Place | null;
  readonly asOf: string;
}

/**
 * A failure of the *search* rather than of a provider: every provider rejected,
 * `reverse` with nothing that reverses, a bbox that is not one.
 *
 * `PlaceProviderError` stays what a provider throws. Both extend
 * `SmartputError`, because that is the discriminator this codebase branches on
 * and an error outside it is invisible to every consumer following the
 * convention. Neither is added to `core/errors.ts`: core hosts the errors its
 * own evaluate path can throw, and no search error crosses it.
 */
export class GeocodeError extends SmartputError {
  readonly causes: readonly unknown[];
  constructor(detail: string, causes: readonly unknown[] = []) {
    super(`Geocode failed: ${detail}`, detail);
    // Literal, never `new.target.name`: a minifier renames the class.
    this.name = "GeocodeError";
    this.causes = causes;
  }
}

/** `search("berlin")` and `search({ text: "berlin" })` are one call. */
export function toQuery(q: string | GeocodeQuery): GeocodeQuery {
  return typeof q === "string" ? { text: q } : q;
}

/**
 * The cache key: everything that changes the answer, and nothing that does not.
 *
 * `signal` and `committed` are excluded. A signal is the caller's lifetime and
 * not part of the question; `committed` is excluded because it only widens the
 * provider set, and a widened answer is a superset that a later narrow query is
 * still entitled to read — the alternative caches the same text twice.
 *
 * Sets are sorted, so `["us","fr"]` and `["fr","us"]` are one key. `near` is
 * rounded to two decimals (~1.1 km), which is finer than the bias can resolve
 * and coarse enough that a moving cursor does not miss the cache every frame.
 */
export function cacheKey(q: GeocodeQuery): string {
  const near =
    q.near === undefined ? "" : `${q.near.lat.toFixed(2)},${q.near.lon.toFixed(2)}`;
  const countries =
    q.countries === undefined
      ? ""
      : [...q.countries]
          .map((c) => c.toLowerCase())
          .sort()
          .join("+");
  const kinds = q.kinds === undefined ? "" : [...q.kinds].sort().join("+");
  const bbox = q.bbox === undefined ? "" : q.bbox.join(",");
  return [
    normalizeName(q.text),
    countries,
    kinds,
    near,
    bbox,
    q.lang ?? "",
    q.limit ?? "",
  ].join(" ");
}

/**
 * The filters a provider may not have applied. Run over every result whatever
 * its source, because a provider that ignores `countries` and one that honours
 * it must not answer differently — the strategy layer above compares them.
 */
export function applyFilters(hits: readonly GeocodeHit[], q: GeocodeQuery): GeocodeHit[] {
  const countries = q.countries?.map((c) => c.toLowerCase());
  const kinds = q.kinds;
  const bbox = q.bbox;
  return hits.filter((h) => {
    if (countries !== undefined && !countries.includes(h.place.country.toLowerCase())) {
      return false;
    }
    if (kinds !== undefined && !kinds.includes(h.kind)) return false;
    if (bbox !== undefined) {
      const [w, s, e, n] = bbox;
      const { lat, lon } = h.place;
      if (lat < s || lat > n || lon < w || lon > e) return false;
    }
    return true;
  });
}
