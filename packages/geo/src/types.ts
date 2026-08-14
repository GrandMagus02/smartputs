import type { GeoKind } from "./features";
import type { Place } from "./place";

/** `[west, south, east, north]`, degrees. The order GeoJSON and Photon use. */
export type Bbox = readonly [number, number, number, number];

/** A point, in the order every mapping API writes it. */
export interface Coord {
  readonly lat: number;
  readonly lon: number;
}

/**
 * A search, as a record rather than a string (geocode spec §4.1).
 *
 * The complaint this answers is that `lookup(q: string)` is not a search: it
 * carries no proximity, no bounding box, no language, no abort and no score,
 * and every real gazetteer — GeoNames, Photon, Nominatim, Pelias — takes at
 * least four of those. Wiring one of them behind a bare string throws away most
 * of what it can answer.
 *
 * Every field but `text` is optional, and a bare string is accepted as sugar
 * for `{ text }` wherever a query is taken.
 */
export interface GeoQuery {
  readonly text: string;
  /**
   * Proximity bias. **Not a filter** — a near miss still ranks, just lower.
   *
   * The asymmetry with `bbox` is deliberate. Proximity is how a launcher says
   * "I am in Berlin, prefer things near me", and turning that into a filter
   * would make a user in Berlin unable to find Tokyo.
   */
  readonly near?: Coord;
  /**
   * A filter: a hit outside the box is dropped.
   *
   * A bounding box is how a caller says "this widget covers Bavaria", which is
   * a claim about which results are *admissible* and not about which are likely.
   */
  readonly bbox?: Bbox;
  /** ISO 3166-1 alpha-2, any case. A filter. */
  readonly countries?: readonly string[];
  /** A filter. Absent or empty means every kind the provider can answer. */
  readonly kinds?: readonly GeoKind[];
  /**
   * BCP 47. Providers that carry one name per language use it, which is the
   * whole of this package's internationalization story: GeoNames holds the
   * alternate names in ~250 languages and answers in the one asked for, so no
   * translation is vendored, reviewed or kept in step here.
   */
  readonly lang?: string;
  /** Overrides the `Geo`'s default for this query alone. */
  readonly limit?: number;
  readonly signal?: AbortSignal;
  /**
   * The Enter-key query rather than the typing (geocode spec §5.3).
   *
   * Providers that declare `interactive: false` run only on a committed query.
   * That is a licence condition and not a performance hint — the OSMF Nominatim
   * policy forbids client-side autocomplete outright — so it is typed rather
   * than left to a README paragraph the consumer will skip.
   */
  readonly committed?: boolean;
}

/**
 * One result (geocode spec §4.2).
 *
 * A hit *wraps* a `Place` rather than widening it. `score`, `matched` and
 * `source` are facts about a search and not about a place, and putting them on
 * `Place` would carry them into every Value's meta, where they mean nothing.
 */
export interface GeoHit {
  /** Unchanged from geo spec §8, so it still drops into a Value's meta. */
  readonly place: Place;
  readonly kind: GeoKind;
  /** 0..1, recomputed by `rank` so it is comparable across providers (§6). */
  readonly score: number;
  /** The name or alias that hit — a search for "muenchen" shows "München". */
  readonly matched: string;
  /** The provider id, for attribution and for debugging a merge. */
  readonly source: string;
}

/**
 * What a source has to implement to be searched (geocode spec §4.3).
 *
 * Three fields and one method are required; `reverse` is optional because two
 * shipped sources genuinely cannot do it — a postal index has no notion of
 * "nearest", and GeoNames charges `findNearby` against a separate budget.
 */
export interface GeoProvider {
  readonly id: string;
  /**
   * The credit line this source requires, ready to render.
   *
   * Required rather than optional: GeoNames is CC BY 4.0 and OSM is ODbL, both
   * of which oblige the consumer, and a consumer cannot comply with a string
   * they cannot reach. `Geo.attribution` is the union over the providers that
   * contributed.
   */
  readonly attribution: string;
  /** May this provider be called on every keystroke? See `GeoQuery.committed`. */
  readonly interactive: boolean;
  search(q: GeoQuery): Promise<GeoHit[]>;
  reverse?(at: Coord, q?: GeoQuery): Promise<GeoHit[]>;
}
