import {
  Decimal,
  deriveValue,
  type OpSignature,
  type PlaceMeta,
  SmartputError,
  type Value,
} from "@smartput/core";

const PLACE_KIND = "place";

/**
 * The `geonameId` a place carries when nothing has positioned it — a postal code
 * reached without a provider.
 *
 * Declared here rather than imported, which is a change: it used to come from
 * `@smartput/zip`, and that package's postal machinery now lives inside
 * `@smartput/geo`. Importing it from there would close a cycle, because the
 * place kind `@smartput/geo` defines names `PlaceDistance`. So the constant is
 * restated in the package that *branches* on it, for the reason core restates
 * `RatioTable` structurally: the dependency has to run one way, and `0` written
 * twice cannot drift — it is not a tuning number, it is "not a GeoNames id",
 * and GeoNames will not start issuing zero.
 */
const NO_GEONAME_ID = 0;

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

/** Somewhere on the Earth. `CountryRow` and `PlaceMeta` both satisfy it. */
export interface Position {
  readonly lat: number;
  readonly lon: number;
}

/**
 * A row this op can fall back to when an operand carries no usable meta.
 *
 * Structural, and the table arrives through the constructor rather than being
 * imported: `@smartput/country` registers this op on its kind, so naming that
 * package from here would close a cycle. It is also the honest shape of the
 * dependency — the op needs a position per unit and nothing else a country row
 * happens to carry.
 */
export interface PositionedPlace extends Position {
  /** ISO 3166-1 alpha-2, lowercased — the unit a place Value carries. */
  readonly a2: string;
}

/**
 * IUGG mean Earth radius, metres. A sphere rather than the WGS84 ellipsoid:
 * the two disagree by under 0.5%, and each endpoint is a capital city standing
 * in for a whole country, which is a far coarser approximation than the figure
 * of the Earth.
 */
export const EARTH_RADIUS_M = 6371008.8;

const RAD = Math.PI / 180;

/**
 * Great-circle metres between two points. The arithmetic underneath
 * `PlaceDistance`, exported because "how far apart are these two coordinates" is
 * a question worth asking without an engine, a Value or a country table.
 */
export function metresBetween(a: Position, b: Position): number {
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
 * The place kind's one op (spec §4.3), as something you build over a table.
 *
 * ```ts
 * import { PlaceDistance } from "@smartput/distance";
 *
 * defineKind({ …, ops: [new PlaceDistance(COUNTRIES).op] });
 * ```
 *
 * A class over a bare `OpSignature` constant because the fallback table is the
 * part that varies: a build with a different gazetteer measures from different
 * capitals, and the op has to close over the one its kind registered. `.op` is
 * the signature `defineKind` takes, and `between` is the same measurement asked
 * of two Values directly.
 *
 * `in`'s surface words in English are in, to and as, so "kyiv to warsaw" parses
 * with no new keyword and no new OpSymbol.
 */
export class PlaceDistance {
  /**
   * The signature `defineKind` registers.
   *
   * The result unit is km, not the canonical metre: `formatValue` renders
   * `value.unit` and nothing rescales it — `typical` bands are read by
   * completion, not by the formatter — so metres would print seven digits for
   * every pair of countries there is.
   */
  readonly op: OpSignature;

  readonly #byA2: Map<string, Position>;

  /**
   * `places` is the position each unit falls back to — the shipped table is
   * `COUNTRIES`, whose `lat`/`lon` are the capital's. An empty table is legal
   * and means every operand must carry its own meta.
   */
  constructor(places: readonly PositionedPlace[]) {
    this.#byA2 = new Map(places.map((row) => [row.a2, { lat: row.lat, lon: row.lon }]));
    this.op = {
      op: "in",
      left: PLACE_KIND,
      right: PLACE_KIND,
      result: "length",
      // Recorded because great-circle is defensible but not the only reading:
      // driving distance is what a person often means, and no free dataset
      // carries it. Static on the signature, so it names the model rather than
      // the pair.
      assumption: {
        code: "great-circle",
        message: "Measured along the great circle between the two places.",
        detail: { model: "sphere", radius: `${EARTH_RADIUS_M} m` },
      },
      apply: (l: Value, r: Value): Value => this.between(l, r),
    };
    Object.freeze(this);
  }

  /** Two place Values in, a `length` in kilometres out. `op.apply` is this. */
  between(l: Value, r: Value): Value {
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
    const metres = Math.round(metresBetween(this.#positionOf(l), this.#positionOf(r)));
    return deriveValue(l, new Decimal(metres), { kind: "length", unit: "km" });
  }

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
  #positionOf(value: Value): Position {
    const meta = value.meta as PlaceMeta | undefined;
    if (meta !== undefined && !value.canonical.isZero()) return meta;
    return this.#byA2.get(value.unit) ?? meta ?? { lat: 0, lon: 0 };
  }
}
