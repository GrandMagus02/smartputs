import {
  Decimal,
  deriveValue,
  type OpSignature,
  type PlaceMeta,
  type Value,
} from "@smartput/core";
import { COUNTRIES } from "./data/countries";

interface Position {
  readonly lat: number;
  readonly lon: number;
}

const BY_A2 = new Map<string, Position>(COUNTRIES.map((row) => [row.a2, row]));

/**
 * Where a place sits, from its own `meta` when it has one.
 *
 * A conversion target the matcher declined to claim — "japan to ua", where the
 * alpha-2 code yields to the unit alias (spec §5.1) — reaches `apply` as core's
 * stand-in operand: the right unit, canonical 0, and the *left* operand's meta.
 * Reading that meta would answer "0 km" for two different countries, so a
 * canonical of zero sends the lookup to the unit instead, which is exactly what
 * a unit being a country buys.
 */
function positionOf(value: Value): Position {
  const meta = value.meta as PlaceMeta | undefined;
  if (meta !== undefined && !value.canonical.isZero()) return meta;
  return BY_A2.get(value.unit) ?? meta ?? { lat: 0, lon: 0 };
}

/**
 * IUGG mean Earth radius, metres. A sphere rather than the WGS84 ellipsoid:
 * the two disagree by under 0.5%, and each endpoint is a capital city standing
 * in for a whole country, which is a far coarser approximation than the figure
 * of the Earth.
 */
const EARTH_RADIUS_M = 6371008.8;

const RAD = Math.PI / 180;

function metresBetween(a: Position, b: Position): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  // Clamped asin rather than atan2: near the antipode floating error puts
  // sqrt(h) a hair above 1, and asin of that is NaN.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The kind's one op (spec §4.3). `in`'s surface words in English are in, to and
 * as, so "kyiv to warsaw" parses with no new keyword and no new OpSymbol.
 *
 * The result unit is km, not the canonical metre: `formatValue` renders
 * `value.unit` and nothing rescales it — `typical` bands are read by completion,
 * not by the formatter — so metres would print seven digits for every pair of
 * countries there is.
 */
export const distance: OpSignature = {
  op: "in",
  left: "place",
  right: "place",
  result: "length",
  // Recorded because great-circle is defensible but not the only reading:
  // driving distance is what a person often means, and no free dataset carries
  // it. Static on the signature, so it names the model rather than the pair.
  assumption: {
    code: "great-circle",
    message: "Measured along the great circle between the two places.",
    detail: { model: "sphere", radius: `${EARTH_RADIUS_M} m` },
  },
  apply: (l: Value, r: Value): Value => {
    // Rounded to the metre. Capital coordinates carry five decimal places, so
    // anything finer is invented precision — and the corpus asserts formatted
    // output verbatim, which a host's Math.sin last bit must not decide.
    const metres = Math.round(metresBetween(positionOf(l), positionOf(r)));
    return deriveValue(l, new Decimal(metres), { kind: "length", unit: "km" });
  },
};
