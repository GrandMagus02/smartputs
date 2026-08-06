import { normalizeName } from "./place";
import type { GeocodeHit, GeocodeQuery } from "./query";

/**
 * The four terms of §6, summing to one so a score is a fraction and not a
 * scale nobody can read. Name dominates, because every other term is a
 * tie-breaker on a question the user did not ask: they typed a name.
 */
const W_NAME = 0.6;
const W_POP = 0.15;
const W_PROX = 0.15;
const W_SOURCE = 0.1;

/** log10 of a population, over the largest a place plausibly has. */
const POP_CEILING_LOG = 8;

/** Where the proximity term has fallen to a half, in kilometres. */
const PROX_HALF_KM = 500;

/**
 * How close two names are, on the same normalization the matcher's trie uses:
 * lowercased, trimmed, inner whitespace collapsed, diacritics *left alone*.
 * Stripping them would make "malmo" find Malmö and also collide two genuinely
 * different names, and a lookup that disagrees with the matcher about what one
 * name is would be the worse bug (geo §8).
 *
 * Three bands, deliberately non-overlapping so the ordering between them is a
 * fact and not an accident of tuning: exact is 1, a prefix is 0.7–0.9, and a
 * token hit is 0.3–0.6.
 */
export function similarity(text: string, matched: string): number {
  const a = normalizeName(text);
  const b = normalizeName(matched);
  if (a === "" || b === "") return 0;
  if (a === b) return 1;
  if (b.startsWith(a)) return 0.7 + 0.2 * (a.length / b.length);

  const wanted = a.split(" ");
  const have = new Set(b.split(" "));
  let hits = 0;
  for (const w of wanted) if (have.has(w)) hits += 1;
  if (hits === 0) return 0;
  return 0.3 + 0.3 * (hits / wanted.length);
}

/**
 * A monotone decreasing function of separation, **not** a measurement.
 *
 * Equirectangular with a cosine correction rather than the haversine
 * `metresBetween` in `@smartput/distance`: this number is multiplied by 0.15
 * and thrown away, and importing the real one would pull `@smartput/zip` and
 * `decimal.js` into a package the spec gives one dependency (§3). If you ever
 * need a distance a user will *read*, it comes from `@smartput/distance` and
 * never from here.
 */
export function proximity(
  near: { readonly lat: number; readonly lon: number },
  place: { readonly lat: number; readonly lon: number },
): number {
  // Wrapped, so a pair either side of the antimeridian is close and not half a
  // world apart.
  let dLon = place.lon - near.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;

  const meanLat = ((near.lat + place.lat) / 2) * (Math.PI / 180);
  const x = dLon * Math.cos(meanLat);
  const y = place.lat - near.lat;
  // 111.32 km per degree at the equator.
  const km = Math.sqrt(x * x + y * y) * 111.32;
  return PROX_HALF_KM / (PROX_HALF_KM + km);
}

function popTerm(population: number): number {
  if (population <= 0) return 0;
  return Math.min(1, Math.log10(population + 1) / POP_CEILING_LOG);
}

/**
 * Recomputed and never trusted: a Photon relevance number, GeoNames' unscored
 * row order and `bundled()`'s population are three different scales, and under
 * `merge` they have to become one list (§6).
 */
export function scoreHit(
  hit: GeocodeHit,
  q: GeocodeQuery,
  sourceWeight: number,
): GeocodeHit {
  const score =
    W_NAME * similarity(q.text, hit.matched) +
    W_POP * popTerm(hit.place.population) +
    W_PROX * (q.near === undefined ? 0 : proximity(q.near, hit.place)) +
    W_SOURCE * sourceWeight;
  return { ...hit, score };
}

/**
 * The identity of a place, as far as a merge can tell.
 *
 * A non-zero GeoNames id is the answer. Zero is not a GeoNames id — geo §8
 * rules that a postal row carries none and that hashing the code into a
 * synthetic one would look stable and collide with a real id — so those fall
 * back to name, country and coordinates rounded to three decimals, about 110 m.
 */
function identity(hit: GeocodeHit): string {
  const p = hit.place;
  if (p.geonameId !== 0) return `id:${p.geonameId}`;
  return `at:${normalizeName(p.name)}|${p.country.toLowerCase()}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`;
}

/** One row per place, the highest-scoring copy kept. */
export function dedupe(hits: readonly GeocodeHit[]): GeocodeHit[] {
  const best = new Map<string, GeocodeHit>();
  for (const hit of hits) {
    const key = identity(hit);
    const seen = best.get(key);
    if (seen === undefined || hit.score > seen.score) best.set(key, hit);
  }
  return [...best.values()];
}

/**
 * Score, dedupe, sort, limit.
 *
 * The tie-break chain is total — score, then population, then GeoNames id, all
 * descending — so the same query against the same rows returns the same order
 * on every run and every platform. An unstable order is the kind of bug that
 * only ever appears in someone else's UI, which is why a test asserts this
 * rather than trusting `Array.prototype.sort`.
 */
export function rankHits(
  hits: readonly GeocodeHit[],
  q: GeocodeQuery,
  weightOf: (source: string) => number,
): GeocodeHit[] {
  const scored = hits.map((h) => scoreHit(h, q, weightOf(h.source)));
  const out = dedupe(scored).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.place.population !== a.place.population) {
      return b.place.population - a.place.population;
    }
    return b.place.geonameId - a.place.geonameId;
  });
  return q.limit === undefined ? out : out.slice(0, q.limit);
}
