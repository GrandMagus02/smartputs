/**
 * `@smartput/geo` — free-text place search and the GeoNames web service, whole.
 *
 * Countries, states, regions, cities, postal codes, rivers, mountains, parks and
 * everything else GeoNames holds, answered by a network gazetteer rather than by
 * a table committed into this repository. That is the trade the package exists to
 * make: a library release is the wrong unit for a data release — populations
 * move, names change, borders are redrawn — and the alternative was a megabyte
 * of generated TypeScript plus a translation of it per language, refreshed by
 * hand and reviewed by nobody. GeoNames already holds every toponym's names in
 * some 250 languages, so `lang` is the whole of the internationalization story
 * here (see `GeoQuery.lang`).
 *
 * The shape is `@smartput/rate`'s, one level up. Rates has one provider
 * interface and ships `ecb()` and `custom()` behind it; this has one provider
 * interface and ships `geonames()`, `postalCodes()`, `bundled()` and `custom()`
 * behind it, plus a `Geo` that searches several at once and ranks their answers
 * into one list. Adding a source — Photon, Nominatim, Pelias, a table in the
 * consumer's own database — is one object with an `id`, an `attribution`, an
 * `interactive` flag and a `search`.
 *
 * ```ts
 * import { Geo } from "@smartput/geo";
 * import { geonames } from "@smartput/geo/providers";
 *
 * const geo = new Geo({ providers: [geonames({ username: "demo" })] });
 *
 * await geo.search("paris tx");                          // ranked hits
 * await geo.search({ text: "dnipro", kinds: ["water"] }); // the river, not the city
 * await geo.search({ text: "київ", lang: "uk" });         // names in any language
 * await geo.reverse({ lat: 48.85, lon: 2.35 });
 * await geo.resolve("berlin");                            // one Place, or null
 * ```
 *
 * The network is reachable only through `@smartput/geo/providers`. Everything at
 * this door is types, ranking and the `Geo` that orchestrates them, so a bundle
 * that imports a `GeoKind` links no fetch.
 */
export { QueryCache, type QueryCacheOptions } from "./cache";
export { GeoError, type ProviderFailure } from "./errors";
export {
  featureClasses,
  GEO_KINDS,
  type GeoKind,
  kindOf,
  wantsPostal,
  wantsToponyms,
} from "./features";
export { cacheKey, Geo, type GeoOptions, type GeoStrategy } from "./geo";
export { RateLimiter, type RateLimiterOptions } from "./limiter";
export {
  normalizeName,
  type Place,
  type PlaceHint,
  type PlaceLookup,
  type PlaceProvider,
  PlaceProviderError,
  type PlaceSnapshot,
  placeSnapshot,
} from "./place";
// The ranking pieces are public because a consumer merging their own provider in
// wants to know — and to be able to assert — how their rows will be ordered
// against everyone else's. `WEIGHTS` above all: it is the one number in this
// package that is a judgement call rather than a fact.
export {
  dedupe,
  haversine,
  identity,
  inBbox,
  rank,
  score,
  similarity,
  WEIGHTS,
} from "./rank";
export type { Bbox, Coord, GeoHit, GeoProvider, GeoQuery } from "./types";
