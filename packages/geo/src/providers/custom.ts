import type { GeoKind } from "../features";
import { normalizeName, type Place } from "../place";
import type { GeoHit, GeoProvider, GeoQuery } from "../types";

export interface CustomOptions {
  readonly id?: string;
  readonly attribution?: string;
  /** Default true. A source with a policy against type-ahead says so here. */
  readonly interactive?: boolean;
}

/**
 * Any async source in the provider shape — the mirror of `custom()` in
 * `@smartput/rate`.
 *
 * The escape hatch that keeps this package from being a list of vendors: a
 * consumer with a private gazetteer, a Pelias instance or a table in their own
 * database implements one function and is a first-class provider, ranked and
 * merged beside GeoNames with no adapter of ours in between.
 */
export function custom(
  search: (q: GeoQuery) => Promise<GeoHit[]>,
  opts: CustomOptions = {},
): GeoProvider {
  return {
    id: opts.id ?? "custom",
    attribution: opts.attribution ?? "",
    interactive: opts.interactive ?? true,
    search,
  };
}

export interface BundledOptions {
  readonly id?: string;
  readonly attribution?: string;
  /**
   * When these rows were exported, ISO 8601.
   *
   * Required rather than defaulted, and this is the field that demotes a
   * vendored table from truth to floor: a consumer can read how old their
   * offline data is and decide whether to put a live provider in front of it.
   */
  readonly asOf: string;
  /**
   * What a non-postal row is, when every row in the table is the same thing.
   * Default `city`, which is what a gazetteer usually is.
   */
  readonly kind?: GeoKind;
  /**
   * What a row is, when they are not all the same thing.
   *
   * `Place` carries no feature code — it is `PlaceMeta` plus two columns, and
   * adding a kind to it would put a fact about a *search* into every Value's
   * meta, which is the same objection `GeoHit` exists to answer. So a table of
   * mixed features supplies the labelling as a function instead of as a column,
   * and `kind` above stays the answer for the common case where there is nothing
   * to decide.
   */
  readonly kindOf?: (place: Place) => GeoKind;
}

/**
 * Rows the consumer brought, searched locally. No network, no cache, no limiter.
 *
 * The offline floor (geocode spec §8). It takes rows as an argument rather than
 * importing a table, which is what keeps the tiering rule from geo spec §3 true
 * of this package: the dependency edge runs from the consumer inwards, so a
 * bundle that only wanted a live search never links a gazetteer.
 *
 * Matching is prefix-and-substring over the folded name and the postal code —
 * not the trie the place kind's matcher builds, deliberately. That trie exists
 * to claim a span *inside an expression*, where a wrong claim is destructive;
 * this is a picker, where a generous match is a scroll and a missed one is a
 * dead end. `rank` is what puts them in the right order afterwards.
 */
export function bundled(places: readonly Place[], opts: BundledOptions): GeoProvider {
  const fallback = opts.kind ?? "city";
  const kindOf =
    opts.kindOf ??
    ((place: Place): GeoKind => (place.postal === "" ? fallback : "postal"));
  const id = opts.id ?? "bundled";

  // Built once, not per keystroke: this is the provider on the path a launcher
  // types through, and re-folding every name on every letter is the one thing
  // that would make it slower than the network it exists to avoid.
  const rows = places.map((place) => ({
    place,
    name: normalizeName(place.name),
    postal: normalizeName(place.postal),
  }));

  return {
    id,
    attribution: opts.attribution ?? "",
    interactive: true,
    async search(q: GeoQuery): Promise<GeoHit[]> {
      const text = normalizeName(q.text);
      if (text === "") return [];
      const countries =
        q.countries === undefined || q.countries.length === 0
          ? null
          : new Set(q.countries.map((c) => c.toLowerCase()));

      const hits: GeoHit[] = [];
      for (const row of rows) {
        if (countries !== null && !countries.has(row.place.country)) continue;
        const matched = row.name.includes(text)
          ? row.place.name
          : row.postal.startsWith(text)
            ? row.place.postal
            : "";
        if (matched === "") continue;
        hits.push({
          place: row.place,
          kind: kindOf(row.place),
          score: 0,
          matched,
          source: id,
        });
      }
      return hits;
    },
  };
}
