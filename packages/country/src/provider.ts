/**
 * Moved to `@smartput/geocode` in M7.1 (geocode spec §3). Re-exported here so
 * no consumer import breaks; removed at the next major.
 *
 * @deprecated Import from `@smartput/geocode`.
 */
export {
  normalizeName,
  type Place,
  type PlaceHint,
  type PlaceLookup,
  type PlaceProvider,
  PlaceProviderError,
  type PlaceSnapshot,
  placeSnapshot,
} from "@smartput/geocode";
