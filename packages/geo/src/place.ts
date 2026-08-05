import { defineKind, type Kind, type UnitLexeme } from "@smartput/core";
import { COUNTRIES } from "./data/countries";
import { distance } from "./distance";
import { formatPlace } from "./format";
import { createPlaceLiteral, MIN_NAME_LENGTH } from "./matcher";

/**
 * Units are the ISO 3166-1 alpha-2 set (spec §4.1), built from COUNTRIES the
 * way datetime builds its units from ZONES. An opaque unit is a label, not a
 * ratio, and a country is exactly that: indexed, weighted, formatted and usable
 * as an `in` target. Every place Value's unit is therefore its country, which
 * is what lets `LiteralMatch.unit` always name something registered.
 *
 * Names only. The alias index is global — one key, every kind — so shipping the
 * codes as aliases makes "km" Comoros as well as a kilometre, "3pm" a country
 * instead of a time and "3 days ago" unparseable, none of which any weight can
 * undo. §4.1 lists alpha-3 among the aliases; it is dropped here because the
 * matcher's trie carries every code already and offers it a guard the index has
 * no way to express.
 */
const COUNTRY_UNITS: Record<string, UnitLexeme> = {};
for (const row of COUNTRIES) {
  COUNTRY_UNITS[row.a2] = {
    aliases: row.aliases.filter((a) => a.length >= MIN_NAME_LENGTH),
    symbol: row.name,
  };
}

/**
 * A country, a city or a postal code. Opaque for datetime's reason: it is not a
 * scalar on a ratio line, and every operation it supports is a declared
 * signature — one, here.
 */
export const place: Kind = defineKind({
  id: "place",
  // No `equals`: canonical is the GeoNames id (spec §4.2), so two Values are
  // the same place exactly when their canonicals are equal, and that is already
  // the default. Declaring one would restate it and invite it to drift.
  value: { mode: "opaque", units: COUNTRY_UNITS },
  literals: [createPlaceLiteral(COUNTRIES)],
  ops: [distance],
  format: formatPlace,
});
