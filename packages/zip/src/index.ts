/**
 * `@smartput/zip` — postal codes: the literal matcher that reads one inside an
 * expression (spec §6.2), and the validation and normalization layer that asks
 * the same question directly (spec §10).
 *
 * No data. Every entry point here takes the country rows you hand it, which is
 * what keeps this package below `@smartput/country` in the graph rather than
 * beside it: the place kind names `createPostalLiteral`, so a dependency in the
 * other direction would be a cycle. `PostalCountry` is the row contract, and
 * `CountryRow` satisfies it.
 */

// `MAX_CODE_LENGTH` is public because it is the one number a caller has to agree
// with rather than merely observe — a field that accepts more characters than
// this refuses them again downstream — and `isBacktrackRisk` because screening a
// pattern that never reaches this package is the only use it has.
export {
  isBacktrackRisk,
  MAX_CODE_LENGTH,
  normalizePostal,
  PostalFormat,
  PostalFormats,
  postalAccepts,
  postalShape,
} from "./format";
export {
  createPostalLiteral,
  MIN_ALIAS_LENGTH,
  NO_GEONAME_ID,
  RANK_STEP,
} from "./literal";
export type { PostalCountry } from "./types";
