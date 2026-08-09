import { wantsPostal } from "../features";
import { type Place, PlaceProviderError } from "../place";
import type { GeoHit, GeoProvider, GeoQuery } from "../types";

const ID = "postal-codes";

/**
 * The zauberware collection republishes GeoNames' own postal export per country,
 * so the credit is GeoNames' and the republication's licence is the same one.
 */
export const POSTAL_CODES_ATTRIBUTION =
  "Postal code data from GeoNames (https://www.geonames.org/) via the " +
  "zauberware postal-codes collection, licensed under CC BY 4.0 " +
  "(https://creativecommons.org/licenses/by/4.0/).";

/**
 * One row of a zauberware country file, which is a flat array of these. Every
 * field is a string, coordinates included — the collection is a CSV export
 * wearing JSON, and reading `latitude` as a number is this file's job.
 */
interface PostalRow {
  readonly country_code?: string;
  readonly zipcode?: string;
  readonly place?: string;
  readonly state?: string;
  readonly state_code?: string;
  readonly latitude?: string;
  readonly longitude?: string;
}

export interface PostalCodesOptions {
  /**
   * The consumer's mirror, with the country substituted into it. `{country}`
   * takes the alpha-2 lowercased and `{COUNTRY}` uppercased — the placeholder's
   * own case decides, because the upstream zips are `US.zip` and the JSON
   * inside them is `zipcodes.us.json`, and a mirror may have kept either. A url
   * with neither placeholder is fetched as it stands, which is what a
   * single-country mirror wants.
   *
   * There is no default. The collection is a few hundred megabytes and the
   * project that publishes it hosts zips, not an API; naming any third party
   * here would hardcode their bandwidth as this package's transport.
   */
  readonly url: string;
  /** The alpha-2 used when a query does not name one. */
  readonly country?: string;
  /** Injected for tests; defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
}

/** Uppercased, inner whitespace collapsed: "sw1a  1aa" and "SW1A 1AA" are one. */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Split a query into a country and a code, accepting exactly the two forms geo
 * spec §6.2 rules are one literal: `us 90210` and `90210 us`. The country is a
 * token of exactly two letters at either end, which is why `SW1A 1AA` survives
 * intact — neither of its tokens is two letters — and why `gb SW1A 1AA` also
 * works.
 *
 * Parsed here rather than by the caller so that the string the matcher claimed
 * is the string this provider is handed, with no second grammar in between.
 */
export function splitQuery(q: string): { code: string; country: string | undefined } {
  const words = q.trim().split(/\s+/).filter(Boolean);
  const isCode = (w: string | undefined): boolean =>
    w !== undefined && /^[a-zA-Z]{2}$/.test(w);

  if (words.length > 1 && isCode(words[0])) {
    return { country: words[0], code: words.slice(1).join(" ") };
  }
  if (words.length > 1 && isCode(words[words.length - 1])) {
    return { country: words[words.length - 1], code: words.slice(0, -1).join(" ") };
  }
  return { country: undefined, code: words.join(" ") };
}

/**
 * Postal codes from a mirror of the zauberware collection (geo spec §8), which
 * is GeoNames' own postal export republished per country as JSON, CC BY 4.0.
 *
 * A country file is fetched whole and kept, because these files are one request
 * for tens of thousands of rows: `us` is 12 MB and 41 490 codes, so a
 * per-lookup request would re-download all of it to answer one code. That makes
 * the cache below the difference between usable and not, and not an
 * optimisation.
 *
 * The cache holds the in-flight *promise*, not its value, so a burst of lookups
 * on a cold country makes one request rather than one per lookup — the same
 * reason `QueryCache` does. A rejection deletes the entry, so the failure
 * reaches every waiting caller and the next call retries instead of awaiting a
 * settled rejection forever.
 */
export class PostalCodes implements GeoProvider {
  readonly id = ID;
  readonly attribution = POSTAL_CODES_ATTRIBUTION;
  /** A file, not a rationed API. Whether the consumer types at it is theirs. */
  readonly interactive = true;

  readonly #fetch: typeof globalThis.fetch;
  readonly #url: string;
  readonly #country: string | undefined;
  readonly #files = new Map<string, Promise<Place[]>>();

  constructor(opts: PostalCodesOptions) {
    this.#fetch = opts.fetch ?? globalThis.fetch;
    this.#url = opts.url;
    this.#country = opts.country;
  }

  async #download(country: string): Promise<Place[]> {
    const url = this.#url
      .replaceAll("{country}", country.toLowerCase())
      .replaceAll("{COUNTRY}", country.toUpperCase());

    const res = await this.#fetch(url);
    if (!res.ok) {
      throw new PlaceProviderError(
        ID,
        `request for ${country} failed: ${res.status} ${res.statusText}`,
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new PlaceProviderError(ID, `response for ${country} was not JSON`);
    }
    if (!Array.isArray(body)) {
      throw new PlaceProviderError(
        ID,
        `response for ${country} was not an array of rows`,
      );
    }
    // Empty is an error here where it is an answer in the GeoNames provider: a
    // country file's contents are known in advance, so nothing left is the same
    // signal an empty ECB table is — a mirror serving the wrong thing.
    if (body.length === 0) {
      throw new PlaceProviderError(ID, `response for ${country} carried no rows`);
    }

    const places: Place[] = [];
    for (const row of body as PostalRow[]) {
      if (row.zipcode === undefined) continue;
      places.push({
        // No feature id, no population, no zone: see `Place` for why this file
        // invents none of them rather than defaulting to the country's.
        geonameId: 0,
        name: row.place ?? "",
        zone: "",
        currency: "",
        lat: Number(row.latitude ?? 0) || 0,
        lon: Number(row.longitude ?? 0) || 0,
        population: 0,
        // The requested country as the fallback: a few files omit the column,
        // and the file was fetched by country, so the answer is never in doubt.
        country: (row.country_code ?? country).toLowerCase(),
        admin1: row.state_code ?? "",
        postal: row.zipcode,
      });
    }
    if (places.length === 0) {
      throw new PlaceProviderError(ID, `no row for ${country} carried a zipcode`);
    }
    return places;
  }

  #file(country: string): Promise<Place[]> {
    const key = country.toLowerCase();
    let pending = this.#files.get(key);
    if (pending === undefined) {
      pending = this.#download(key).catch((err: unknown) => {
        this.#files.delete(key);
        throw err;
      });
      this.#files.set(key, pending);
    }
    return pending;
  }

  async lookup(q: string): Promise<Place[]> {
    const { code, country } = splitQuery(q);
    const cc = country ?? this.#country;
    if (cc === undefined) {
      // Loud rather than guessing a country. A postal code means nothing
      // without one — "1000" is Brussels, Sofia, Manila and Ljubljana — and
      // the mirror is per-country, so there is no worldwide file to fall back
      // on the way GeoNames' postal index does.
      throw new PlaceProviderError(ID, `query ${JSON.stringify(q)} names no country`);
    }
    if (code === "") return [];

    const wanted = normalizeCode(code);
    return (await this.#file(cc)).filter((p) => normalizeCode(p.postal) === wanted);
  }

  async search(q: GeoQuery | string): Promise<GeoHit[]> {
    const query: GeoQuery = typeof q === "string" ? { text: q } : q;
    // This index answers exactly one kind, so a query that filters it out is
    // answered with nothing rather than with postal rows the caller refused.
    if (!wantsPostal(query.kinds)) return [];

    // A `countries` filter is the other spelling of the country prefix this
    // provider's own grammar takes, so it is honoured rather than ignored: the
    // first entry is the file to open when the text names none.
    const text =
      splitQuery(query.text).country === undefined && query.countries?.[0] !== undefined
        ? `${query.countries[0]} ${query.text}`
        : query.text;

    return (await this.lookup(text)).map((place) => ({
      place,
      kind: "postal" as const,
      score: 0,
      matched: place.postal,
      source: ID,
    }));
  }
}

/** The factory, for parity with `geonames()` and `ecb()`. */
export function postalCodes(opts: PostalCodesOptions): PostalCodes {
  return new PostalCodes(opts);
}
