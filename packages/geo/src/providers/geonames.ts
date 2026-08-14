import { featureClasses, type GeoKind, kindOf, wantsToponyms } from "../features";
import { type Place, PlaceProviderError } from "../place";
import type { Bbox, Coord, GeoHit, GeoProvider, GeoQuery } from "../types";

const ID = "geonames";

/**
 * GeoNames is CC BY 4.0, and the licence requires the credit to travel with the
 * data wherever it goes. A constant rather than a README line, because the data
 * ships compiled into a launcher's UI, where nobody reads a README — a consumer
 * rendering a place needs the exact string to hand.
 */
export const GEONAMES_ATTRIBUTION =
  "Geographical data from GeoNames (https://www.geonames.org/), " +
  "licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).";

/**
 * The default host is `secure.geonames.org`, not the `api.geonames.org` the
 * docs print. `api` resolves, but its TLS certificate names only
 * `secure.geonames.org`, so every https request to it fails the hostname check;
 * the docs' examples are plain http, which a library has no business defaulting
 * to. Same service, same account, same paths.
 */
const GEONAMES = "https://secure.geonames.org";

/**
 * Free accounts are throttled by credits per hour and per day, so a request
 * that asks for a hundred rows costs the same as one that asks for ten and
 * throws away ninety. Ten is what a disambiguation list can show.
 */
const MAX_ROWS = 10;

export interface GeoNamesOptions {
  /**
   * A free GeoNames account name. There is no key and no header: the username
   * is a query parameter, and a fresh account must be enabled for the free web
   * service by hand before it answers anything — until then every call returns
   * HTTP 200 carrying `status.value` 10.
   */
  readonly username: string;
  /** Injected for tests; defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
  /** Override the host, e.g. for the commercial endpoint or a proxy. */
  readonly url?: string;
  /** Rows per request. Default 10. */
  readonly maxRows?: number;
  /**
   * BCP 47, applied when a query names none.
   *
   * This is the whole of the package's internationalization: GeoNames holds
   * every toponym's alternate names in some 250 languages and answers in the
   * one asked for, so no translated table is vendored here, reviewed here or
   * kept in step with upstream here.
   */
  readonly lang?: string;
}

/** The error envelope, which arrives with HTTP 200. */
interface GeoNamesStatus {
  readonly status?: { readonly message?: string; readonly value?: number };
}

/** A `searchJSON`/`getJSON`/`childrenJSON` row under `style=FULL`. */
interface SearchRow {
  readonly geonameId?: number;
  readonly name?: string;
  readonly toponymName?: string;
  readonly asciiName?: string;
  readonly countryCode?: string;
  readonly countryName?: string;
  readonly adminCode1?: string;
  readonly adminName1?: string;
  readonly population?: number;
  readonly lat?: string | number;
  readonly lng?: string | number;
  readonly fcl?: string;
  readonly fcode?: string;
  readonly fclName?: string;
  readonly fcodeName?: string;
  readonly timezone?: { readonly timeZoneId?: string };
  readonly alternateNames?: readonly {
    readonly lang?: string;
    readonly name?: string;
  }[];
  readonly bbox?: {
    readonly west?: number;
    readonly south?: number;
    readonly east?: number;
    readonly north?: number;
  };
}

/** A `postalCodeLookupJSON` row. Note the all-lowercase `postalcode`. */
interface PostalRow {
  readonly postalcode?: string;
  readonly placeName?: string;
  readonly countryCode?: string;
  readonly adminCode1?: string;
  readonly lat?: string | number;
  readonly lng?: string | number;
}

/** A `findNearbyPostalCodesJSON` row. Note the camel-case `postalCode`. */
interface NearbyPostalRow {
  readonly postalCode?: string;
  readonly placeName?: string;
  readonly countryCode?: string;
  readonly adminCode1?: string;
  readonly lat?: string | number;
  readonly lng?: string | number;
  readonly distance?: string | number;
}

/** A `countryInfoJSON` row. */
interface CountryRow {
  readonly geonameId?: number;
  readonly countryCode?: string;
  readonly countryName?: string;
  readonly isoAlpha3?: string;
  readonly capital?: string;
  readonly currencyCode?: string;
  readonly population?: string | number;
  readonly areaInSqKm?: string | number;
  readonly continent?: string;
  readonly continentName?: string;
  readonly languages?: string;
  readonly postalCodeFormat?: string;
  readonly west?: number;
  readonly south?: number;
  readonly east?: number;
  readonly north?: number;
}

/** One country as `GeoNames.countries()` answers it. */
export interface GeoCountry {
  /** ISO 3166-1 alpha-2, lowercased. */
  readonly a2: string;
  /** ISO 3166-1 alpha-3, lowercased. */
  readonly a3: string;
  /** In the language the query asked for, or GeoNames' English default. */
  readonly name: string;
  /** The capital as GeoNames names the city, "" for the few with none. */
  readonly capital: string;
  /** ISO 4217, uppercase. "" for Antarctica, which has no legal tender. */
  readonly currency: string;
  readonly population: number;
  /** Square kilometres. */
  readonly area: number;
  /** Two letters — "EU", "AS". */
  readonly continent: string;
  /** BCP 47 tags, comma-joined, as upstream writes them. */
  readonly languages: string;
  /** GeoNames' human-readable postal mask, "@## #@@" for GB. "" where none. */
  readonly postalFormat: string;
  /** The country's own GeoNames id. The Value's canonical (geo spec §4.2). */
  readonly geonameId: number;
  /** `[west, south, east, north]`, the country's bounding box. */
  readonly bbox: Bbox;
}

/** One rung of `hierarchy()`: Earth, then continent, country, admin1, … */
export interface GeoNode {
  readonly place: Place;
  readonly kind: GeoKind;
  /** GeoNames' feature code — "PCLI", "ADM1", "PPLC". */
  readonly featureCode: string;
  /** GeoNames' rendering of that code — "independent political entity". */
  readonly featureName: string;
  /**
   * Every name this feature answers to, with its language tag.
   *
   * On `Place` there is one name and it is the one the query matched, because a
   * Value's meta has no room for two hundred. Here they survive, because this is
   * the shape `countryTable()` reads: the aliases a matcher's trie is built from
   * are exactly these, and they are the reason no alias table is vendored.
   *
   * GeoNames' pseudo-languages come through unchanged — `abbr` for "UK", `iso`
   * and `fips` for the code systems, `link` for URLs, and "" for an unattributed
   * spelling. Filtering them is the caller's, since which of them is a usable
   * name depends on what the caller is going to do with it.
   */
  readonly alternateNames: readonly { readonly lang: string; readonly name: string }[];
}

/** The timezone `timezoneJSON` puts a coordinate in. */
export interface GeoTimezone {
  /** IANA, "Europe/Kyiv". */
  readonly zone: string;
  /** ISO 3166-1 alpha-2, lowercased. */
  readonly country: string;
  /** Hours from UTC, standard time. */
  readonly rawOffset: number;
  /** Hours from UTC, when daylight saving is in force. */
  readonly dstOffset: number;
}

/** Coordinates are strings in some endpoints and numbers in others. */
function num(v: string | number | undefined): number {
  const n = typeof v === "string" ? Number(v) : v;
  return n === undefined || Number.isNaN(n) ? 0 : n;
}

/**
 * The free GeoNames web service, whole (geocode spec §8).
 *
 * A class and not a bag of functions, matching how the rest of this codebase
 * hands back stateful things: the object owns a base url, a credential, a
 * default language and a row cap, and every method needs all four. The parsers
 * underneath — `toPlace`, `toCountry` — are plain functions and are tested
 * without constructing one.
 *
 * Fourteen methods against eleven endpoints, because GeoNames is not one index
 * and pretending otherwise decides wrongly and silently. `search` walks the
 * toponym index and `postal` walks the postal one, and a code is not a toponym:
 * `searchJSON` with `q=44657` finds nothing at all. `children` walks the admin
 * hierarchy downwards, which is the only way to enumerate a country's states —
 * a search for "states of Ukraine" is a search for a phrase nobody named a place.
 *
 * Nothing here is cached and nothing is rate-limited. The account's credits are
 * the consumer's to spend, and the cache and the limiter that spend them belong
 * to `Geo` (geocode spec §5.3), not to a provider that cannot know how often it
 * is called.
 */
export class GeoNames implements GeoProvider {
  readonly id = ID;
  readonly attribution = GEONAMES_ATTRIBUTION;
  /**
   * GeoNames has no policy against type-ahead — only a credit budget, which is
   * the consumer's. Contrast `nominatim()`, whose usage policy forbids
   * client-side autocomplete outright and which therefore declares `false`.
   */
  readonly interactive = true;

  readonly #fetch: typeof globalThis.fetch;
  readonly #base: string;
  readonly #username: string;
  readonly #maxRows: number;
  readonly #lang: string | undefined;

  constructor(opts: GeoNamesOptions) {
    this.#fetch = opts.fetch ?? globalThis.fetch;
    this.#base = (opts.url ?? GEONAMES).replace(/\/+$/, "");
    this.#username = opts.username;
    this.#maxRows = opts.maxRows ?? MAX_ROWS;
    this.#lang = opts.lang;
  }

  // -------------------------------------------------------------------------
  // The transport
  // -------------------------------------------------------------------------

  /**
   * One request. `params` may repeat a key — `featureClass` and `country` are
   * both repeatable upstream — so it is a list of pairs rather than a record.
   */
  async #request(
    path: string,
    params: readonly (readonly [string, string])[],
    signal?: AbortSignal,
  ): Promise<unknown> {
    const url = new URL(`${this.#base}/${path}`);
    for (const [k, v] of params) url.searchParams.append(k, v);
    url.searchParams.set("username", this.#username);

    const res = await this.#fetch(url.toString(), signal === undefined ? {} : { signal });
    if (!res.ok) {
      throw new PlaceProviderError(ID, `request failed: ${res.status} ${res.statusText}`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new PlaceProviderError(ID, "response was not JSON");
    }

    // The one thing about this service that a `res.ok` check does not cover: an
    // exhausted quota, a username that was never enabled and a malformed query
    // all arrive as HTTP 200 with an error envelope in the body. Checked before
    // the payload, so those come back as errors rather than as no results —
    // which is what a caller retrying on empty would spin on forever.
    const status = (body as GeoNamesStatus | null)?.status;
    if (status !== undefined) {
      throw new PlaceProviderError(
        ID,
        `${status.message ?? "unknown error"} (${status.value})`,
      );
    }
    return body;
  }

  /**
   * An empty result set is an answer, not a failure — a search for a place that
   * does not exist has to be able to say so. That is the opposite of the ECB
   * provider's rule, where an empty table can only mean the format moved, and
   * the difference is that a rate file has known contents and a search does not.
   *
   * Rows that arrive but do not parse are the failure case: if a non-empty
   * payload yields nothing, the shape has changed under the fixture and this
   * says so here rather than returning silence to a caller.
   */
  static #parse<T, R>(rows: unknown, what: string, to: (row: T) => R | null): R[] {
    if (!Array.isArray(rows)) {
      throw new PlaceProviderError(ID, `response carried no ${what} array`);
    }
    const out: R[] = [];
    for (const row of rows as T[]) {
      const mapped = to(row);
      if (mapped !== null) out.push(mapped);
    }
    if (rows.length > 0 && out.length === 0) {
      throw new PlaceProviderError(
        ID,
        `no row in ${what} carried the fields this parses`,
      );
    }
    return out;
  }

  /**
   * The parameters every toponym endpoint shares.
   *
   * `style=FULL` is not a knob. `MEDIUM` omits `timezone`, and a place with no
   * zone cannot serve the `in | datetime | place` bridge that is half the reason
   * this package exists (geo spec §3.1).
   */
  #common(q: GeoQuery | undefined): (readonly [string, string])[] {
    const params: (readonly [string, string])[] = [
      ["style", "FULL"],
      ["maxRows", String(q?.limit ?? this.#maxRows)],
    ];
    const lang = q?.lang ?? this.#lang;
    if (lang !== undefined) params.push(["lang", lang]);
    return params;
  }

  // -------------------------------------------------------------------------
  // Search — the toponym index
  // -------------------------------------------------------------------------

  /**
   * `searchJSON`, with the query's filters pushed upstream wherever GeoNames has
   * a parameter for them.
   *
   * Pushed rather than applied on the way back because the row cap is applied by
   * the server: filtering ten returned rows down to the two in Ukraine gives two
   * results where the caller asked for ten, and spends the same credit doing it.
   * `near` is the exception and stays local — GeoNames has no proximity *bias*,
   * only `findNearby`, which is a different question — so §6's ranking is what
   * honours it.
   */
  async search(q: GeoQuery | string): Promise<GeoHit[]> {
    const query: GeoQuery = typeof q === "string" ? { text: q } : q;
    if (!wantsToponyms(query.kinds)) return [];

    const params = this.#common(query);
    params.push(["q", query.text]);
    // Rows whose name is only an alternate spelling in an unrequested language
    // are noise in a picker; upstream drops them when this is on.
    params.push(["isNameRequired", "true"]);
    for (const cls of featureClasses(query.kinds)) params.push(["featureClass", cls]);
    for (const cc of query.countries ?? []) params.push(["country", cc.toUpperCase()]);
    if (query.bbox !== undefined) {
      const [west, south, east, north] = query.bbox;
      params.push(["west", String(west)], ["south", String(south)]);
      params.push(["east", String(east)], ["north", String(north)]);
    }

    const body = await this.#request("searchJSON", params, query.signal);
    return this.#hits(body, query.kinds);
  }

  /**
   * `findNearbyJSON` — reverse geocoding: what is at this coordinate.
   *
   * `findNearbyPlaceNameJSON` is the neighbouring endpoint and is deliberately
   * not used. It answers with populated places only, which makes a coordinate in
   * the Atlantic return the nearest town on a continent rather than nothing, and
   * a caller who wanted a city can say so with `kinds: ["city"]`.
   */
  async reverse(at: Coord, q?: GeoQuery): Promise<GeoHit[]> {
    const params = this.#common(q);
    params.push(["lat", String(at.lat)], ["lng", String(at.lon)]);
    for (const cls of featureClasses(q?.kinds)) params.push(["featureClass", cls]);

    const body = await this.#request("findNearbyJSON", params, q?.signal);
    return this.#hits(body, q?.kinds);
  }

  /**
   * Shared tail of `search` and `reverse`: rows in, labelled hits out.
   *
   * The kind filter runs *after* `#parse` and not inside its mapper, and the
   * distinction is the whole reason this is a separate step. `#parse` reads a
   * `null` from its mapper as "this row did not carry the fields we read", and
   * throws when every row of a non-empty payload does — which is how a changed
   * upstream shape is caught rather than reported as "no such place". A row
   * dropped because the caller asked for rivers and it is a city parsed
   * perfectly well; folding the two into one `null` turns a legitimate empty
   * answer into a fabricated parser error, which is exactly what it did before
   * the test below caught it.
   */
  #hits(body: unknown, kinds: readonly GeoKind[] | undefined): GeoHit[] {
    const wanted = kinds === undefined || kinds.length === 0 ? null : new Set(kinds);
    const hits = GeoNames.#parse<SearchRow, GeoHit>(
      (body as { geonames?: unknown })?.geonames,
      "geonames",
      (row) => {
        const place = toPlace(row);
        if (place === null) return null;
        return {
          place,
          kind: kindOf(row.fcl ?? "", row.fcode ?? ""),
          // Provider scores are not comparable across sources, so this is a
          // placeholder that `rank` overwrites (geocode spec §6). Left at 0
          // rather than filled with GeoNames' own relevance number, which is an
          // unbounded Lucene score and would look like a 0..1 to anyone who
          // read a raw provider result.
          score: 0,
          matched: row.name ?? row.toponymName ?? "",
          source: ID,
        };
      },
    );
    // `country` and `admin` share feature class A, so a query for one of them
    // fetched both and this is where the other is dropped. Done here rather than
    // upstream because GeoNames has no parameter that says "countries but not
    // their provinces", and after `#parse` for the reason in the header.
    if (wanted === null) return hits;
    return hits.filter((hit) => wanted.has(hit.kind));
  }

  // -------------------------------------------------------------------------
  // The admin hierarchy — states, regions, and what contains what
  // -------------------------------------------------------------------------

  /**
   * `getJSON` — one feature by its id. Null when GeoNames has no such id.
   *
   * The only endpoint that answers with a bare row rather than a wrapper, which
   * is why it does not go through `#parse`.
   */
  async get(geonameId: number, q?: GeoQuery): Promise<Place | null> {
    const params = this.#common(q);
    params.push(["geonameId", String(geonameId)]);
    const body = await this.#request("getJSON", params, q?.signal);
    return toPlace(body as SearchRow);
  }

  /**
   * `childrenJSON` — one level down the administrative tree.
   *
   * This is how a caller enumerates the states of a country or the regions of a
   * state, and there is no other way: those are not searchable by phrase, and
   * the vendored alternative was a division table that has to be regenerated
   * every time a country redraws a border. Earth's children are the continents,
   * a continent's are its countries, a country's are its admin1 divisions.
   */
  async children(geonameId: number, q?: GeoQuery): Promise<GeoNode[]> {
    return this.#nodes("childrenJSON", geonameId, q);
  }

  /**
   * `hierarchyJSON` — every rung above a feature, ordered Earth first.
   *
   * What a UI renders as "Kyiv, Kyiv City, Ukraine, Europe" and what a caller
   * needs to answer "which country is this in" for a feature that carries no
   * `countryCode` — an ocean, a mountain range that straddles a border.
   */
  async hierarchy(geonameId: number, q?: GeoQuery): Promise<GeoNode[]> {
    return this.#nodes("hierarchyJSON", geonameId, q);
  }

  /** `siblingsJSON` — the other divisions at this one's level and parent. */
  async siblings(geonameId: number, q?: GeoQuery): Promise<GeoNode[]> {
    return this.#nodes("siblingsJSON", geonameId, q);
  }

  /**
   * `neighboursJSON` — the countries or divisions that share a border.
   *
   * Land borders only, as upstream computes them: the United Kingdom's one
   * neighbour is Ireland, and the Channel is not a border.
   */
  async neighbours(geonameId: number, q?: GeoQuery): Promise<GeoNode[]> {
    return this.#nodes("neighboursJSON", geonameId, q);
  }

  /** Shared tail of the four hierarchy endpoints, which share a payload shape. */
  async #nodes(path: string, geonameId: number, q?: GeoQuery): Promise<GeoNode[]> {
    const params = this.#common(q);
    params.push(["geonameId", String(geonameId)]);
    const body = await this.#request(path, params, q?.signal);
    return GeoNames.#parse<SearchRow, GeoNode>(
      (body as { geonames?: unknown })?.geonames,
      "geonames",
      (row) => {
        const place = toPlace(row);
        if (place === null) return null;
        return {
          place,
          kind: kindOf(row.fcl ?? "", row.fcode ?? ""),
          featureCode: row.fcode ?? "",
          featureName: row.fcodeName ?? "",
          alternateNames: (row.alternateNames ?? [])
            .filter((n) => n.name !== undefined && n.name !== "")
            .map((n) => ({ lang: n.lang ?? "", name: n.name as string })),
        };
      },
    );
  }

  // -------------------------------------------------------------------------
  // Countries
  // -------------------------------------------------------------------------

  /**
   * `countryInfoJSON` — every country GeoNames holds, in one request.
   *
   * The replacement for a committed country table, and the reason this package
   * can exist without one: ~250 rows, one call, and the names arrive in whatever
   * `lang` asked for. `maxRows` is deliberately not sent — a partial list of
   * countries is not a useful answer to "which countries are there", and the
   * endpoint has no paging worth the name.
   *
   * The one place in this package where a `Place`-shaped row could carry a
   * currency, and it is not one: `GeoCountry` is its own record because a
   * country carries facts — alpha-3, calling area, languages, a postal mask —
   * that have no column in `PlaceMeta` and no business being invented for one.
   */
  async countries(q?: GeoQuery): Promise<GeoCountry[]> {
    const params: (readonly [string, string])[] = [];
    const lang = q?.lang ?? this.#lang;
    if (lang !== undefined) params.push(["lang", lang]);
    const body = await this.#request("countryInfoJSON", params, q?.signal);
    return GeoNames.#parse<CountryRow, GeoCountry>(
      (body as { geonames?: unknown })?.geonames,
      "geonames",
      toCountry,
    );
  }

  /**
   * `countryCodeJSON` — the alpha-2 a coordinate falls in, lowercased, or "" at
   * sea. Cheaper than `reverse` when the country is the whole question.
   */
  async countryAt(at: Coord, q?: GeoQuery): Promise<string> {
    const body = await this.#request(
      "countryCodeJSON",
      [
        ["lat", String(at.lat)],
        ["lng", String(at.lon)],
        ["type", "JSON"],
      ],
      q?.signal,
    );
    return ((body as { countryCode?: string })?.countryCode ?? "").toLowerCase();
  }

  /**
   * `countrySubdivisionJSON` — the admin1 division a coordinate falls in.
   *
   * Distinct from `reverse` filtered to `admin`: this is a point-in-polygon
   * answer and that is a nearest-feature answer, and near a border they
   * disagree. The polygon is the one that is right.
   */
  async subdivision(
    at: Coord,
    q?: GeoQuery,
  ): Promise<{
    readonly country: string;
    readonly admin1: string;
    readonly name: string;
  } | null> {
    const body = (await this.#request(
      "countrySubdivisionJSON",
      [
        ["lat", String(at.lat)],
        ["lng", String(at.lon)],
      ],
      q?.signal,
    )) as {
      countryCode?: string;
      adminCode1?: string;
      adminName1?: string;
    } | null;
    if (body?.countryCode === undefined) return null;
    return {
      country: body.countryCode.toLowerCase(),
      admin1: body.adminCode1 ?? "",
      name: body.adminName1 ?? "",
    };
  }

  // -------------------------------------------------------------------------
  // Postal codes — the other index
  // -------------------------------------------------------------------------

  /**
   * `postalCodeLookupJSON` — the exact-code endpoint, not the
   * `postalCodeSearch` one beside it, whose prefix and place-name knobs are a
   * second grammar for an operation that has one input. Note that the two spell
   * their payload differently, `postalcodes`/`postalcode` here against
   * `postalCodes`/`postalCode` there; the fixture is what pins which of them
   * this parses.
   *
   * `country` is an alpha-2 filter. Without one the lookup is worldwide, which
   * matters because a bare code is ambiguous across countries — 2320 is a real
   * code in Australia and in Belgium.
   */
  async postal(code: string, country?: string, q?: GeoQuery): Promise<Place[]> {
    const params: (readonly [string, string])[] = [
      ["postalcode", code],
      ["maxRows", String(q?.limit ?? this.#maxRows)],
    ];
    if (country !== undefined) params.push(["country", country.toUpperCase()]);

    const body = await this.#request("postalCodeLookupJSON", params, q?.signal);
    return GeoNames.#parse<PostalRow, Place>(
      (body as { postalcodes?: unknown })?.postalcodes,
      "postalcodes",
      (row) => {
        if (row.postalcode === undefined || row.countryCode === undefined) return null;
        return postalPlace(row.postalcode, row.placeName, row.countryCode, row);
      },
    );
  }

  /**
   * `findNearbyPostalCodesJSON` — the codes around a coordinate, nearest first.
   *
   * The camel-case `postalCodes`/`postalCode` here against the all-lowercase
   * spelling in `postal` above is upstream's, not a typo: the two endpoints
   * genuinely disagree, and each fixture pins its own.
   */
  async postalNear(at: Coord, radiusKm?: number, q?: GeoQuery): Promise<Place[]> {
    const params: (readonly [string, string])[] = [
      ["lat", String(at.lat)],
      ["lng", String(at.lon)],
      ["maxRows", String(q?.limit ?? this.#maxRows)],
    ];
    if (radiusKm !== undefined) params.push(["radius", String(radiusKm)]);
    for (const cc of q?.countries ?? []) params.push(["country", cc.toUpperCase()]);

    const body = await this.#request("findNearbyPostalCodesJSON", params, q?.signal);
    return GeoNames.#parse<NearbyPostalRow, Place>(
      (body as { postalCodes?: unknown })?.postalCodes,
      "postalCodes",
      (row) => {
        if (row.postalCode === undefined || row.countryCode === undefined) return null;
        return postalPlace(row.postalCode, row.placeName, row.countryCode, row);
      },
    );
  }

  // -------------------------------------------------------------------------
  // Point facts
  // -------------------------------------------------------------------------

  /**
   * `timezoneJSON` — the IANA zone a coordinate is in, with both its offsets.
   *
   * The bridge geo spec §3.1 describes runs on this: a place with a zone can be
   * an `in` target for a datetime, and a coordinate that arrived from `reverse`
   * or from a postal row has none of its own.
   */
  async timezone(at: Coord, q?: GeoQuery): Promise<GeoTimezone | null> {
    const body = (await this.#request(
      "timezoneJSON",
      [
        ["lat", String(at.lat)],
        ["lng", String(at.lon)],
      ],
      q?.signal,
    )) as {
      timezoneId?: string;
      countryCode?: string;
      rawOffset?: number;
      dstOffset?: number;
    } | null;
    if (body?.timezoneId === undefined) return null;
    return {
      zone: body.timezoneId,
      country: (body.countryCode ?? "").toLowerCase(),
      rawOffset: body.rawOffset ?? 0,
      dstOffset: body.dstOffset ?? 0,
    };
  }

  /** `oceanJSON` — which ocean or sea a coordinate is in, or null on land. */
  async ocean(at: Coord, q?: GeoQuery): Promise<string | null> {
    const body = (await this.#request(
      "oceanJSON",
      [
        ["lat", String(at.lat)],
        ["lng", String(at.lon)],
      ],
      q?.signal,
    )) as { ocean?: { name?: string } } | null;
    return body?.ocean?.name ?? null;
  }

  // -------------------------------------------------------------------------
  // The narrow interface the four-package split shipped
  // -------------------------------------------------------------------------

  /**
   * `PlaceProvider.lookup` — a string in, rows out.
   *
   * Kept so this class still satisfies the interface `@smartput/country`'s
   * providers entry point published, and implemented over `search` rather than
   * beside it so there is one request path. Geocode spec §1 explains why it is
   * not the interface anything new should be written against.
   */
  async lookup(q: string): Promise<Place[]> {
    return (await this.search(q)).map((hit) => hit.place);
  }
}

/**
 * The factory, for parity with `ecb()` next door in `@smartput/rate` and for the
 * call sites that read better without `new`.
 */
export function geonames(opts: GeoNamesOptions): GeoNames {
  return new GeoNames(opts);
}

/**
 * A toponym row to a `Place`, or null when it carries neither an id nor a
 * country and therefore cannot be keyed or joined.
 *
 * Exported for the fixture test, which pins the column layout without standing
 * up a client or a fetch.
 */
export function toPlace(row: SearchRow | null | undefined): Place | null {
  if (row?.geonameId === undefined) return null;
  return {
    geonameId: row.geonameId,
    // `name` is the alternate name the query matched and `toponymName` the
    // canonical one — a search for "Dar" answers `{"toponymName": "Njeru",
    // "name": "Daru"}`. The matched form is what the user typed, so it is what
    // they get shown back.
    name: row.name ?? row.toponymName ?? "",
    zone: row.timezone?.timeZoneId ?? "",
    // A country-level fact, and this row is not a country. See `Place`.
    currency: "",
    lat: num(row.lat),
    lon: num(row.lng),
    population: row.population ?? 0,
    country: (row.countryCode ?? "").toLowerCase(),
    admin1: row.adminCode1 ?? "",
    postal: "",
  };
}

/**
 * The two postal endpoints' shared tail. Both spell their fields differently,
 * so the differing ones arrive already read and only the shared ones are taken
 * off the row.
 */
function postalPlace(
  postal: string,
  placeName: string | undefined,
  countryCode: string,
  row: { readonly lat?: string | number; readonly lng?: string | number } & {
    readonly adminCode1?: string;
  },
): Place {
  return {
    // The postal index carries no feature id, no population and no timezone;
    // see `Place` for why none of the three is invented.
    geonameId: 0,
    name: placeName ?? "",
    zone: "",
    currency: "",
    lat: num(row.lat),
    lon: num(row.lng),
    population: 0,
    country: countryCode.toLowerCase(),
    admin1: row.adminCode1 ?? "",
    postal,
  };
}

/** A `countryInfoJSON` row to a `GeoCountry`. Exported for the fixture test. */
export function toCountry(row: CountryRow): GeoCountry | null {
  if (row.countryCode === undefined || row.geonameId === undefined) return null;
  return {
    a2: row.countryCode.toLowerCase(),
    a3: (row.isoAlpha3 ?? "").toLowerCase(),
    // Trimmed: "Bonaire, Saint Eustatius and Saba " ships with a trailing space
    // upstream, and it would reach a formatter and an index.
    name: (row.countryName ?? "").trim(),
    capital: (row.capital ?? "").trim(),
    currency: (row.currencyCode ?? "").toUpperCase(),
    population: num(row.population),
    area: num(row.areaInSqKm),
    continent: row.continent ?? "",
    languages: row.languages ?? "",
    postalFormat: row.postalCodeFormat ?? "",
    geonameId: row.geonameId,
    bbox: [row.west ?? 0, row.south ?? 0, row.east ?? 0, row.north ?? 0],
  };
}
