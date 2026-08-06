import type { Admin1Row, CityRow } from "@smartput/city/types";
import { normalizeName, type Place, type PlaceSnapshot, placeSnapshot } from "../place";
import type { GeocodeHit, GeocodeProvider, GeocodeQuery } from "../query";
import { similarity } from "../rank";

const ID = "bundled";

/**
 * The string CC BY 4.0 requires a consumer to display. Duplicated from
 * `@smartput/country`'s `GEONAMES_ATTRIBUTION` rather than imported, because
 * importing it would give this package a runtime edge on a 108 KB country table
 * to obtain forty characters.
 */
const ATTRIBUTION = "GeoNames (https://www.geonames.org/), CC BY 4.0";

export interface BundledOptions {
  readonly cities: readonly CityRow[];
  /** Divisions, so `texas` is findable. Absent means cities only. */
  readonly admin1?: readonly Admin1Row[];
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
function cityPlace(row: CityRow): Place {
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
function adminPlace(row: Admin1Row): Place {
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
