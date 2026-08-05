import {
  Decimal,
  deriveValue,
  type OpSignature,
  type PlaceMeta,
  SmartputError,
  type Value,
} from "@smartput/core";
import { COUNTRIES } from "./data/countries";
import { NO_GEONAME_ID } from "./postal";

/**
 * A place that names somewhere real but carries no coordinates — today, a postal
 * code reached without a provider.
 *
 * Its own error rather than `DimensionMismatchError`, because the operands are
 * the right kinds and the signature is the right one: what is missing is data,
 * not a reading. The message names the provider path (spec §8), since that is
 * the thing a caller can actually do about it.
 */
export class UnpositionedPlaceError extends SmartputError {
  readonly place: string;
  constructor(place: string, country: string) {
    super(
      `${JSON.stringify(place)} has no coordinates: a postal code is positioned by a provider, and none resolved it. Its country ${country.toUpperCase()} does have a position.`,
      place,
    );
    this.name = "UnpositionedPlaceError";
    this.place = place;
  }
}

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
    // A postal code has no position of its own until a provider resolves one
    // (spec §8), and it borrows its country's so the rest of the Value is
    // usable. Measuring from that borrowed point answers a question nobody
    // asked: every pair of codes in one country came out "0 kilometres", so
    // "SW1A 1AA to EH1 1YZ" — London to Edinburgh — measured zero. Refusing is
    // the same choice `evaluate` makes over `AmbiguityError`: a wrong answer
    // delivered confidently is worse than an error that names the remedy.
    for (const side of [l, r]) {
      const meta = side.meta as Partial<PlaceMeta> | undefined;
      if (meta?.geonameId === NO_GEONAME_ID) {
        throw new UnpositionedPlaceError(meta.name ?? side.unit, side.unit);
      }
    }

    // Rounded to the metre. Capital coordinates carry five decimal places, so
    // anything finer is invented precision — and the corpus asserts formatted
    // output verbatim, which a host's Math.sin last bit must not decide.
    const metres = Math.round(metresBetween(positionOf(l), positionOf(r)));
    return deriveValue(l, new Decimal(metres), { kind: "length", unit: "km" });
  },
};
