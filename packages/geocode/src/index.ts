/**
 * `@smartput/geocode` — free-text place search over sources this library does
 * not own (geocode spec §1).
 *
 * One runtime dependency, `@smartput/core`, for `SmartputError` and the snapshot
 * cache. No data of its own: a gazetteer arrives through a provider, and the
 * provider arrives through the consumer.
 */
export { QueryCache, type QueryCacheOptions } from "./cache";
export { Geocoder, type GeocoderOptions, type GeocodeStrategy } from "./geocoder";
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
export {
  applyFilters,
  cacheKey,
  GeocodeError,
  type GeocodeHit,
  type GeocodeKind,
  type GeocodeProvider,
  type GeocodeQuery,
  type PlaceSnapshotLike,
  toQuery,
} from "./query";
export { dedupe, proximity, rankHits, scoreHit, similarity } from "./rank";
