export { GEONAMES_ATTRIBUTION } from "./attribution";
// The table itself is public: a consumer that renders a country picker wants
// the rows, and re-deriving them from the registry's alias index would lose
// everything the kind does not register as a unit.
export { COUNTRIES } from "./data/countries";
export { place } from "./place";
export type { CountryRow } from "./types";
