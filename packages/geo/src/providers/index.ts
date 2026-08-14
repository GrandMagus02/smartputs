/**
 * `@smartput/geo/providers` — the sources, and a third entry point for the
 * reason the other two are separate: this one reaches the network, and a
 * consumer who only wants the types and the ranking must not link a fetch call
 * they never make.
 *
 * It carries no data of its own. Every provider here returns `Place` rows as
 * upstream gives them, so the country-level facts none of them can know —
 * currency above all — are joined by whoever asked.
 */
export {
  type BundledOptions,
  bundled,
  type CustomOptions,
  custom,
} from "./custom";
export {
  GEONAMES_ATTRIBUTION,
  type GeoCountry,
  GeoNames,
  type GeoNamesOptions,
  type GeoNode,
  type GeoTimezone,
  geonames,
  toCountry,
  toPlace,
} from "./geonames";
export {
  POSTAL_CODES_ATTRIBUTION,
  PostalCodes,
  type PostalCodesOptions,
  postalCodes,
  splitQuery,
} from "./postal-codes";
