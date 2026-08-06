/**
 * `@smartput/geocode/providers` — the sources a `Geocoder` searches.
 *
 * A separate subpath for the reason geo §8 gives its own: a consumer who only
 * wants the types and the ranker must not link a provider they never construct.
 * M7.1 ships the two that reach no network; `geonames`, `postalCodes`, `photon`
 * and `nominatim` land here in M7.2.
 */
export { type BundledOptions, bundled } from "./bundled";
export { type CustomOptions, custom } from "./custom";
