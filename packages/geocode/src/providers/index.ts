/**
 * `@smartput/geocode/providers` — the sources a `Geocoder` searches.
 *
 * A separate subpath for the reason geo §8 gives its own: a consumer who only
 * wants the types and the ranker must not link a provider they never construct.
 * M7.1 ships the two that reach no network; `geonames`, `postalCodes`, `photon`
 * and `nominatim` land here in M7.2.
 */
// The two row shapes are exported alongside the options they fill, so a caller
// who builds rows by hand can name what `bundled()` reads without reaching for
// `@smartput/city` — the package this one deliberately does not depend on.
export {
  type BundledAdmin1,
  type BundledCity,
  type BundledOptions,
  bundled,
} from "./bundled";
export { type CustomOptions, custom } from "./custom";
