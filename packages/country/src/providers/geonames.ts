import { type Place, type PlaceProvider, PlaceProviderError } from "../provider";

const ID = "geonames";

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
  fetch?: typeof globalThis.fetch;
  /** Override the host, e.g. for the commercial endpoint or a proxy. */
  url?: string;
  /** Rows per request. Default 10. */
  maxRows?: number;
}

/**
 * Two methods, because GeoNames has two indexes. `lookup` searches toponyms and
 * `postal` looks a code up, and a code is not a toponym: `searchJSON` with
 * `q=44657` finds nothing at all. Routing both through `lookup` on a guess
 * about the query's shape was the alternative and it decides, wrongly and
 * silently, for every country whose codes contain letters.
 */
export interface GeoNamesProvider extends PlaceProvider {
  /**
   * `postalCodeLookupJSON` — the exact-code endpoint, not the `postalCodeSearch`
   * one beside it, whose prefix and place-name knobs are a second grammar for an
   * operation that has one input. Note that the two spell their payload
   * differently, `postalcodes`/`postalcode` here against `postalCodes`/
   * `postalCode` there; the fixture is what pins which of them this parses.
   *
   * `country` is an alpha-2 filter. Without one the lookup is worldwide, which
   * matters because a bare code is ambiguous across countries — 2320 is a real
   * code in Australia and in Belgium.
   */
  postal(code: string, country?: string): Promise<Place[]>;
}

/** The error envelope, which arrives with HTTP 200. */
interface GeoNamesStatus {
  readonly status?: { readonly message?: string; readonly value?: number };
}

interface SearchRow {
  readonly geonameId?: number;
  readonly name?: string;
  readonly toponymName?: string;
  readonly countryCode?: string;
  readonly adminCode1?: string;
  readonly population?: number;
  readonly lat?: string | number;
  readonly lng?: string | number;
  readonly timezone?: { readonly timeZoneId?: string };
}

interface PostalRow {
  readonly postalcode?: string;
  readonly placeName?: string;
  readonly countryCode?: string;
  readonly adminCode1?: string;
  readonly lat?: string | number;
  readonly lng?: string | number;
}

/** Coordinates are strings in `searchJSON` and numbers in the postal one. */
function num(v: string | number | undefined): number {
  const n = typeof v === "string" ? Number(v) : v;
  return n === undefined || Number.isNaN(n) ? 0 : n;
}

/**
 * The free GeoNames web service (spec §8): every toponym GeoNames holds, which
 * is the whole of T2 — the villages, the hamlets and the postal codes that the
 * vendored T1 floor of 100 000 people leaves out.
 *
 * Nothing here is cached and nothing is rate-limited. The account's credits are
 * the consumer's to spend and the TTL facade that spends them belongs to the
 * engine (spec §8.1), not to a provider that cannot know how often it is called.
 */
export function geonames(opts: GeoNamesOptions): GeoNamesProvider {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const base = (opts.url ?? GEONAMES).replace(/\/+$/, "");
  const maxRows = opts.maxRows ?? MAX_ROWS;

  async function request(path: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${base}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("maxRows", String(maxRows));
    url.searchParams.set("username", opts.username);

    const res = await doFetch(url.toString());
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
  function parse<T>(rows: unknown, what: string, to: (row: T) => Place | null): Place[] {
    if (!Array.isArray(rows)) {
      throw new PlaceProviderError(ID, `response carried no ${what} array`);
    }
    const places: Place[] = [];
    for (const row of rows as T[]) {
      const place = to(row);
      if (place !== null) places.push(place);
    }
    if (rows.length > 0 && places.length === 0) {
      throw new PlaceProviderError(
        ID,
        `no row in ${what} carried the fields this parses`,
      );
    }
    return places;
  }

  return {
    id: ID,

    async lookup(q: string): Promise<Place[]> {
      // style=FULL is not a knob. MEDIUM omits `timezone`, and a place with no
      // zone cannot serve the `in | datetime | place` bridge that is half the
      // reason this package exists (§3.1).
      const body = await request("searchJSON", { q, style: "FULL" });
      return parse<SearchRow>(
        (body as { geonames?: unknown })?.geonames,
        "geonames",
        (row) => {
          if (row.geonameId === undefined || row.countryCode === undefined) return null;
          return {
            geonameId: row.geonameId,
            // `name` is the alternate name the query matched and `toponymName`
            // the canonical one — a search for "Dar" answers `{"toponymName":
            // "Njeru","name":"Daru"}`. The matched form is what the user typed,
            // so it is what they get shown back.
            name: row.name ?? row.toponymName ?? "",
            zone: row.timezone?.timeZoneId ?? "",
            currency: "",
            lat: num(row.lat),
            lon: num(row.lng),
            population: row.population ?? 0,
            country: row.countryCode.toLowerCase(),
            admin1: row.adminCode1 ?? "",
            postal: "",
          };
        },
      );
    },

    async postal(code: string, country?: string): Promise<Place[]> {
      const params: Record<string, string> = { postalcode: code };
      if (country !== undefined) params.country = country.toUpperCase();
      const body = await request("postalCodeLookupJSON", params);
      return parse<PostalRow>(
        (body as { postalcodes?: unknown })?.postalcodes,
        "postalcodes",
        (row) => {
          if (row.postalcode === undefined || row.countryCode === undefined) return null;
          return {
            // The postal index carries no feature id, no population and no
            // timezone; see `Place` for why none of the three is invented.
            geonameId: 0,
            name: row.placeName ?? "",
            zone: "",
            currency: "",
            lat: num(row.lat),
            lon: num(row.lng),
            population: 0,
            country: row.countryCode.toLowerCase(),
            admin1: row.adminCode1 ?? "",
            postal: row.postalcode,
          };
        },
      );
    },
  };
}
