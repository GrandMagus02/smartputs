export { GEONAMES_ATTRIBUTION } from "./attribution";
// The kind registers a completer already, so this is not how places are
// completed — it is how they are completed by something that is not an engine.
// A country picker, a "did you mean" list and a form field all want the ranked
// prefix hit and none of them have a `Kind` to ask, and re-deriving one from the
// registry would get the countries and not one city (M6.2: a city is never a
// unit). `PlaceCompleter` is also the only way to move the row cap, since a
// `Kind` has no seam for it: spread the descriptor and hand over
// `.withLimit(n).completions`.
//
// `DEFAULT_LIMIT` stays behind, alone of that module's exports: it is already
// readable as `new PlaceCompleter(COUNTRIES).limit`, and a bare `DEFAULT_LIMIT`
// at a package door names no subject.
export {
  completePlaces,
  createPlaceIndex,
  PlaceCompleter,
  type PlaceIndex,
} from "./completion";
// The table itself is public: a consumer that renders a country picker wants
// the rows, and re-deriving them from the registry's alias index would lose
// everything the kind does not register as a unit.
export { COUNTRIES } from "./data/countries";
// Thrown by the distance op, so a caller catching it by class does not have to
// reach past the entry point for the name.
export { UnpositionedPlaceError } from "./distance";
// T0 only. `CITIES` and `ADMIN1` are deliberately absent — they live behind
// "@smartput/geo/cities" so that this module's import graph never reaches them.
export { definePlace, type PlaceOptions, place } from "./place";
// Validation and normalization as a question, rather than as something that
// happens while an expression is parsed. `PostalFormat.for("GB")` is the door;
// the functions under it take a `CountryRow` you brought yourself.
//
// `MAX_CODE_LENGTH` comes along because it is the one number a caller has to
// agree with rather than merely observe — a field that accepts more characters
// than this refuses them again downstream — and `isBacktrackRisk` because
// screening a pattern that never reaches this package is the only use it has.
export {
  isBacktrackRisk,
  MAX_CODE_LENGTH,
  normalizePostal,
  PostalFormat,
  postalAccepts,
  postalShape,
} from "./postal-format";
export type { Admin1Row, CityRow, CountryRow } from "./types";
