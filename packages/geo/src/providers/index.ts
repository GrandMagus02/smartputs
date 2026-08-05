/**
 * `@smartput/geo/providers` — the T2 path (spec §8), and a third entry point for
 * the reason the other two are separate: this one reaches the network, and a
 * consumer who only wants the vendored tiers must not link a fetch call they
 * never make.
 *
 * It carries no data of its own. Both providers here return `Place` rows exactly
 * as upstream gives them, so the country-level facts they cannot know —
 * currency above all — are joined from `COUNTRIES` by whoever asked.
 */
export {
  type Place,
  type PlaceHint,
  type PlaceLookup,
  type PlaceProvider,
  PlaceProviderError,
  type PlaceSnapshot,
  placeSnapshot,
} from "../provider";
export { type GeoNamesOptions, type GeoNamesProvider, geonames } from "./geonames";
export { type PostalCodesOptions, postalCodes } from "./postal-codes";
