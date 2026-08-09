import { OFFSET_ZONES } from "./offset";
import { ZONES } from "./zones";

/**
 * What a formatter prints for a zone id: `JST` for `Asia/Tokyo`, `UTC+03:00`
 * for `+03:00`, and the id itself for a zone neither table names.
 *
 * Falling back to the id rather than throwing, because a consumer may register
 * zones this package never shipped — `extendsKind` merges units, and a caller
 * who adds `Africa/Lagos` should get a working conversion whose label is honest
 * about not having a symbol, not a formatter that dies on it.
 */
export function zoneSymbol(zone: string): string {
  return ZONES[zone]?.symbol ?? OFFSET_ZONES[zone]?.symbol ?? zone;
}
