import { normalizeName } from "./place";
import type { Bbox, Coord, GeoHit, GeoQuery } from "./types";

/**
 * Cross-provider ranking (geocode spec §6).
 *
 * Provider scores are not comparable and cannot be made so. Photon returns an
 * OpenSearch relevance number, GeoNames returns rows in its own order with a
 * Lucene score attached to some endpoints and none at all to others, and a local
 * table has population and nothing else. Under a merge these have to become one
 * list, so this module recomputes rather than trusts, and every provider in this
 * package hands its hits over with `score: 0` for exactly that reason.
 *
 * Everything here is a plain function over plain data: no clock, no randomness,
 * no `this`. That is what makes the determinism property testable — the same
 * query against the same rows produces the same order on every run and every
 * platform — and an unstable order is the kind of bug that only ever appears in
 * someone else's UI.
 */

/** How much each term is worth. They sum to 1, so a score is a 0..1. */
export const WEIGHTS = {
  /** Dominant: what the user typed is the strongest evidence there is. */
  name: 0.6,
  /** A tiebreaker with teeth — "Springfield" has to mean the big one. */
  population: 0.2,
  /** Only ever non-zero when the query carried a `near`. */
  proximity: 0.15,
  /** The declared order of the providers, decaying. */
  source: 0.05,
} as const;

/**
 * Population is compressed logarithmically before it is scored.
 *
 * Tokyo has 8 336 599 people and Nuku'alofa has 22 400, and on a linear scale
 * the capital of Tonga scores 0.003 — indistinguishable from a hamlet, which is
 * not what a picker should say about a national capital. `log10` puts the whole
 * inhabited range into roughly 0..7.5 and this divisor maps that onto 0..1.
 */
const LOG_POPULATION_CEILING = 7.5;

/** Distance at which the proximity term has fallen to half. */
const PROXIMITY_HALF_LIFE_KM = 250;

/** Mean Earth radius, kilometres. The figure the haversine formula assumes. */
const EARTH_RADIUS_KM = 6371;

/**
 * Prefix-and-token similarity between what was typed and what was matched.
 *
 * Deliberately over `normalizeName`d strings — the same fold the matcher's trie
 * assumes — so a name means one thing in both places. Deliberately *not*
 * diacritic-stripping, for the reason `normalizeName` gives: it would make
 * "malmo" find Malmö and also make two genuinely different names collide.
 *
 * Three bands, in falling order of confidence: the whole string, the whole
 * string as a prefix, and the words in common. The last is what lets "paris tx"
 * score against "Paris" at all, since neither is a prefix of the other.
 */
export function similarity(text: string, matched: string): number {
  const a = normalizeName(text);
  const b = normalizeName(matched);
  if (a === "" || b === "") return 0;
  if (a === b) return 1;

  // A prefix is worth almost everything, discounted by how much of the name the
  // user has not yet typed: "ky" against "Kyiv" is a good guess and "ky" against
  // "Kyzyl-Kiya" is a worse one, and a launcher has to rank them apart.
  if (b.startsWith(a)) return 0.95 * (a.length / b.length) + 0.05;
  if (a.startsWith(b)) return 0.9 * (b.length / a.length);

  const wordsA = a.split(" ");
  const wordsB = new Set(b.split(" "));
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  if (shared === 0) return b.includes(a) ? 0.3 : 0;
  // Over the *union*, so "paris" against "Paris" beats "paris" against "Paris
  // Mountain State Park": sharing one word out of one is better than one out of
  // four, and a plain overlap count cannot say so.
  return (0.8 * shared) / (wordsA.length + wordsB.size - shared);
}

/** Great-circle kilometres between two points. */
export function haversine(a: Coord, b: Coord): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 1 at the query's own point, 0.5 at the half-life, asymptotic to 0. */
function proximity(near: Coord | undefined, at: Coord): number {
  if (near === undefined) return 0;
  return PROXIMITY_HALF_LIFE_KM / (PROXIMITY_HALF_LIFE_KM + haversine(near, at));
}

/** 0..1 over the inhabited range, log-compressed. See the ceiling's header. */
function populationScore(population: number): number {
  if (population <= 0) return 0;
  return Math.min(1, Math.log10(population + 1) / LOG_POPULATION_CEILING);
}

/**
 * A provider's standing, from its index in the declared list.
 *
 * This is what lets a consumer write "prefer my self-hosted Photon, fall back to
 * the bundled table" under a merge without writing a comparator. Halving rather
 * than a linear step, so the first provider is decisively preferred and the
 * fifth is not scored below the sixth by a rounding error.
 */
function sourceWeight(index: number): number {
  return index < 0 ? 0 : 0.5 ** index;
}

/** True when a point is inside the box, edges included. */
export function inBbox(box: Bbox, at: Coord): boolean {
  const [west, south, east, north] = box;
  if (at.lat < south || at.lat > north) return false;
  // A box that crosses the antimeridian has west > east — "the Pacific" is
  // 170..-170 — and the naive comparison excludes everything in it. Both cases
  // are one line and the naive one is wrong for Fiji.
  return west <= east
    ? at.lon >= west && at.lon <= east
    : at.lon >= west || at.lon <= east;
}

/**
 * Score one hit. The provider's own `score` is discarded, not blended in — see
 * this module's header for why it is not a number anything can be blended with.
 */
export function score(hit: GeoHit, q: GeoQuery, order: readonly string[]): number {
  return (
    WEIGHTS.name * similarity(q.text, hit.matched) +
    WEIGHTS.population * populationScore(hit.place.population) +
    WEIGHTS.proximity * proximity(q.near, hit.place) +
    WEIGHTS.source * sourceWeight(order.indexOf(hit.source))
  );
}

/** Coordinates rounded to ~110 m, the identity fallback for an id-less row. */
function coordKey(at: Coord): string {
  return `${at.lat.toFixed(3)},${at.lon.toFixed(3)}`;
}

/**
 * The identity two hits are the same place under.
 *
 * `geonameId` when it is non-zero, and name-plus-country-plus-coordinates when
 * it is not. The zero case is inherited rather than chosen: geo spec §8 rules
 * that a postal row has no feature id and that hashing the code into a synthetic
 * one would look stable, survive into a Value's canonical, and collide with a
 * real id. That ruling stands; this fallback is what lets a merge live with it.
 *
 * The postal code is part of the key, so two different codes for one town stay
 * two rows — which is what a consumer asking for postal codes wanted.
 */
export function identity(hit: GeoHit): string {
  const p = hit.place;
  if (p.geonameId !== 0) return `id:${p.geonameId}`;
  return `at:${normalizeName(p.name)}|${p.country}|${p.postal}|${coordKey(p)}`;
}

/**
 * Collapse duplicates, keeping the highest-scoring copy of each place.
 *
 * Idempotent by construction — `dedupe(dedupe(x))` is `dedupe(x)` — which is
 * asserted rather than assumed, because a merge runs this over the output of a
 * merge often enough that a non-idempotent version would be a slow leak.
 */
export function dedupe(hits: readonly GeoHit[]): GeoHit[] {
  const best = new Map<string, GeoHit>();
  for (const hit of hits) {
    const key = identity(hit);
    const have = best.get(key);
    if (have === undefined || hit.score > have.score) best.set(key, hit);
  }
  return [...best.values()];
}

/**
 * Score, filter, dedupe and order — the whole of what a `Geo` does to the rows
 * its providers hand back.
 *
 * **Every filter is applied here**, and this is the load-bearing sentence of the
 * module. `kinds`, `countries` and `bbox` are all pushed upstream as well, by
 * each provider that has a parameter for them — that is not redundancy, it is
 * the difference between spending a row cap on rows the caller refused and not.
 * But a filter honoured by some sources and ignored by others is worse than no
 * filter at all, because the caller cannot tell which rows were checked; a
 * `custom()` provider that ignores `kinds` would otherwise leak rivers into a
 * cities-only query and the consumer would have no way to see it. Upstream is
 * the optimisation, here is the guarantee.
 *
 * `near` is the one field that is never a filter — geocode spec §4.1 rules the
 * asymmetry, and a property test asserts that adding a `near` removes nothing.
 *
 * Ties break on `(score, population, geonameId)`, all descending, which makes
 * the order total: two hits can share a score and a population, but not an id,
 * and an id-less postal row is already unique under `identity`.
 */
export function rank(
  hits: readonly GeoHit[],
  q: GeoQuery,
  order: readonly string[],
  limit: number,
): GeoHit[] {
  // An empty list means "no filter", the same reading `featureClasses` gives it
  // and the same one GeoNames gives a missing parameter — never "admit nothing".
  const kinds = q.kinds === undefined || q.kinds.length === 0 ? null : new Set(q.kinds);
  const countries =
    q.countries === undefined || q.countries.length === 0
      ? null
      : new Set(q.countries.map((c) => c.toLowerCase()));

  const scored: GeoHit[] = [];
  for (const hit of hits) {
    if (q.bbox !== undefined && !inBbox(q.bbox, hit.place)) continue;
    if (kinds !== null && !kinds.has(hit.kind)) continue;
    if (countries !== null && !countries.has(hit.place.country.toLowerCase())) continue;
    scored.push({ ...hit, score: score(hit, q, order) });
  }
  const out = dedupe(scored);
  out.sort(
    (a, b) =>
      b.score - a.score ||
      b.place.population - a.place.population ||
      b.place.geonameId - a.place.geonameId ||
      // Last resort, and reached only by two id-less rows of equal population:
      // without it their order is whatever the input order was, and the input
      // order of a parallel merge is whichever provider answered first.
      (a.place.postal < b.place.postal ? -1 : a.place.postal > b.place.postal ? 1 : 0),
  );
  return out.slice(0, limit);
}
