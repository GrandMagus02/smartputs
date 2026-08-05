export { GEONAMES_ATTRIBUTION } from "./attribution";
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
export type { Admin1Row, CityRow, CountryRow } from "./types";
