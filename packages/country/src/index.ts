/**
 * `@smartput/country` — the T0 tier and the place kind built on it.
 *
 * The other three packages of the split are underneath this one and each is
 * usable without it: `@smartput/zip` reads a postal code out of rows you bring,
 * `@smartput/distance` measures between two place Values, `@smartput/city` is the
 * T1 gazetteer and no code at all. This is where they meet — a place Value's
 * unit is always its country (spec §4.1), so the kind belongs beside the table
 * that defines those units.
 */
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
// The generator's refusal list. It was unpublished while cities and countries
// shared one package, because a consumer holding it has no operation to perform
// with it; the split gave it one reader that is not this package —
// `@smartput/city`'s data test, which asserts that no shipped alias is a word
// the engine needs. A list asserted against from outside has to be reachable
// from outside.
export { RESERVED_WORDS } from "./data/reserved";
// The two figures `@smartput/zip` respells rather than imports, so that the test
// pinning the two spellings together has something to import. See `MIN_NAME_LENGTH`.
export { MIN_NAME_LENGTH, RANK_STEP } from "./matcher";
// T0 only. `CITIES` and `ADMIN1` are deliberately absent — they are
// `@smartput/city`'s, so that this package's import graph never reaches them.
export { definePlace, type PlaceOptions, place } from "./place";
// Validation and normalization as a question, rather than as something that
// happens while an expression is parsed. `POSTAL_FORMATS.for("GB")` is the door;
// everything under it is `@smartput/zip`'s and takes a `CountryRow` you brought
// yourself.
export { POSTAL_FORMATS } from "./postal-formats";
export type { CountryRow } from "./types";
