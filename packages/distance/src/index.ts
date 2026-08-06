/**
 * `@smartput/distance` — the place kind's one op (spec §4.3): `kyiv to warsaw`
 * is a length, measured along the great circle between the two.
 *
 * No data and no kind. `PlaceDistance` is built over the table its kind
 * registered, which is what keeps this package below `@smartput/country`:
 * `definePlace` names this one, so naming it back would be a cycle. The single
 * edge out is to `@smartput/zip`, for the id a postal code carries when nothing
 * has positioned it — the case `between` refuses rather than answering zero.
 */
export {
  EARTH_RADIUS_M,
  metresBetween,
  PlaceDistance,
  type Position,
  type PositionedPlace,
  UnpositionedPlaceError,
} from "./distance";
