import { normalizeName, type Place, type PlaceSnapshot, placeSnapshot } from "../place";
import type { GeocodeHit, GeocodeProvider, GeocodeQuery } from "../query";
import { similarity } from "../rank";

const ID = "bundled";

/**
 * The shape this provider reads off a `@smartput/city` `CityRow`, spelled
 * structurally rather than imported — core's `RatioTable` does the same to a
 * `@smartput/shared` `UnitTable`, for the same reason.
 *
 * The geocode spec §3 says this package takes no edge on `@smartput/city`.
 * `import type` compiles away, but it survives into the emitted `.d.ts`, and a
 * published declaration naming a package the manifest does not is that edge in
 * everything but the install line: every consumer who wanted the ranker would
 * install a 1.5 MB gazetteer to get it. A real `CityRow` satisfies this, so
 * `bundled({ cities: CITIES })` still typechecks at every call site — the
 * dev-only import in `bundled.test.ts` is what proves it still does.
 *
 * `capital` is absent because nothing here reads it: the tie-break that wants it
 * lives in `@smartput/country`'s matcher, and a field this provider ignores has
 * no business narrowing what a caller may pass.
 */
export interface BundledCity {
  readonly geonameId: number;
  readonly name: string;
  readonly aliases: readonly string[];
  /** Lowercase alpha-2, as `Place.country` carries it. */
  readonly country: string;
  readonly admin1: string;
  readonly lat: number;
  readonly lon: number;
  /** IANA, the city's own. */
  readonly zone: string;
  readonly population: number;
}

/** The structural view of a `@smartput/city` `Admin1Row`; see `BundledCity`. */
export interface BundledAdmin1 {
  /** The country's alpha-2 uppercased, a dot, then the division code. */
  readonly key: string;
  readonly name: string;
  readonly aliases: readonly string[];
}

/**
 * The string CC BY 4.0 requires a consumer to display. Duplicated from
 * `@smartput/country`'s `GEONAMES_ATTRIBUTION` rather than imported, because
 * importing it would give this package a runtime edge on a 108 KB country table
 * to obtain forty characters.
 */
const ATTRIBUTION = "GeoNames (https://www.geonames.org/), CC BY 4.0";

export interface BundledOptions {
  readonly cities: readonly BundledCity[];
  /** Divisions, so `texas` is findable. Absent means cities only. */
  readonly admin1?: readonly BundledAdmin1[];
  /** When the table was generated. What demotes T1 from truth to floor (§8). */
  readonly asOf: string;
  readonly id?: string;
  readonly attribution?: string;
}

interface Alias {
  readonly key: string;
  /**
   * The row's one hit object, shared by every alias that reaches it and never
   * copied here — object identity is what `search` dedupes on, so a per-alias
   * copy would make "Berlin" and its alias "berlin" two candidates for one city.
   * `matched` is stamped at push time, where the alias that actually hit is
   * known.
   */
  readonly hit: GeocodeHit;
}

/** A city row as the rest of the package sees it. */
function cityPlace(row: BundledCity): Place {
  return {
    geonameId: row.geonameId,
    name: row.name,
    // The city's own zone and not its country's: houston is not washington.
    zone: row.zone,
    // A country-level fact this table deliberately does not carry (geo §7.1).
    // A caller joins on `country`.
    currency: "",
    lat: row.lat,
    lon: row.lon,
    population: row.population,
    country: row.country,
    admin1: row.admin1,
    postal: "",
  };
}

/**
 * A division as a `Place`, which it is not quite: no coordinates, no zone, no
 * population, and `geonameId` 0 because `Admin1Row` carries none.
 *
 * Included anyway, because a consumer typing "texas" gets nothing otherwise and
 * geo §5.2 already treats a division as a thing a name can reach. What it must
 * not become is a place a *distance* is measured to — the zeroed coordinates
 * are what `UnpositionedPlaceError` in `@smartput/distance` already refuses.
 */
function adminPlace(row: BundledAdmin1): Place {
  const [country = "", code = ""] = row.key.split(".");
  return {
    geonameId: 0,
    name: row.name,
    zone: "",
    currency: "",
    lat: 0,
    lon: 0,
    population: 0,
    country: country.toLowerCase(),
    admin1: code,
    postal: "",
  };
}

/**
 * The demoted T1 tier: this repo's vendored gazetteer as one provider among
 * several rather than as the tier the engine assumes (§1, §8).
 *
 * It takes its rows as an argument instead of importing `@smartput/city`, which
 * is the same rule `definePlace()` follows and the reason the tiering in geo §3
 * is a fact about the import graph rather than a promise in a comment.
 *
 * The index is a flat alias list bucketed by first character. Six thousand
 * cities at ~1.2 aliases each is ~7,500 entries, and scanning all of them per
 * keystroke is measurable; bucketing cuts it to a few hundred. A trie would cut
 * it further and is what `@smartput/country`'s matcher already builds — not
 * duplicated here because that trie is tied to the fold and the scope walk, and
 * lifting it is a change to the matcher, which M7.1 does not touch.
 */
export function bundled(opts: BundledOptions): GeocodeProvider {
  const buckets = new Map<string, Alias[]>();
  const places: Place[] = [];

  const add = (alias: string, hit: GeocodeHit): void => {
    const key = normalizeName(alias);
    if (key === "") return;
    const bucket = key.slice(0, 1);
    const list = buckets.get(bucket);
    const entry: Alias = { key, hit };
    if (list === undefined) buckets.set(bucket, [entry]);
    else list.push(entry);
  };

  for (const row of opts.cities) {
    const place = cityPlace(row);
    places.push(place);
    const hit: GeocodeHit = {
      place,
      kind: "city",
      score: 0,
      matched: "",
      source: opts.id ?? ID,
    };
    add(row.name, hit);
    for (const alias of row.aliases) add(alias, hit);
  }

  for (const row of opts.admin1 ?? []) {
    const place = adminPlace(row);
    const hit: GeocodeHit = {
      place,
      kind: "admin",
      score: 0,
      matched: "",
      source: opts.id ?? ID,
    };
    add(row.name, hit);
    for (const alias of row.aliases) add(alias, hit);
  }

  const snapshot: PlaceSnapshot = placeSnapshot(opts.asOf, places);

  return {
    id: opts.id ?? ID,
    attribution: opts.attribution ?? ATTRIBUTION,
    interactive: true,
    snapshot,
    async search(q: GeocodeQuery): Promise<readonly GeocodeHit[]> {
      const text = normalizeName(q.text);
      if (text === "") return [];
      const bucket = buckets.get(text.slice(0, 1)) ?? [];
      const countries = q.countries?.map((c) => c.toLowerCase());

      const out: GeocodeHit[] = [];
      const seen = new Set<GeocodeHit>();
      for (const entry of bucket) {
        if (similarity(text, entry.key) === 0) continue;
        // One hit per place, whichever alias reached it first: two aliases of
        // one city are one candidate, and `dedupe` upstream would collapse them
        // anyway — doing it here keeps `limit` meaning what a caller expects.
        if (seen.has(entry.hit)) continue;
        if (countries !== undefined && !countries.includes(entry.hit.place.country)) {
          continue;
        }
        seen.add(entry.hit);
        out.push({ ...entry.hit, matched: entry.key });
        if (q.limit !== undefined && out.length >= q.limit) break;
      }
      return out;
    },
  };
}
