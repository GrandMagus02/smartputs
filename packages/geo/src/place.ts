import { type PlaceMeta, SmartputError } from "@smartput/core";

/**
 * One resolved place as a provider hands it back (geo spec §8).
 *
 * It *extends* core's `PlaceMeta` rather than paralleling it, for the reason
 * `RateSnapshot extends RateLookup`: core declares the contract, the plugin
 * satisfies it structurally, and a provider row therefore drops straight into a
 * Value's meta with no adapter in between. A separate provider-shaped record
 * plus a mapper would be one more place for the field list to drift, and the
 * fields it would drift away from are the ones the datetime and rates bridges
 * read (geo spec §3.1).
 *
 * Two fields the vendored tiers do not need. `admin1` is here because a live
 * gazetteer is where `paris texas` finally has a second Paris to choose between
 * (geo spec §5.2), and `postal` because a postal row is a place whose name is a
 * code (§6.2). Both are "" rather than optional, so a consumer never has to
 * distinguish absent from empty on data that is missing far more often than it
 * is present.
 *
 * What a provider cannot always fill, and does not fake:
 *
 * - `zone` is "" on a postal row. Neither the GeoNames postal index nor the
 *   zauberware files carry one, and defaulting to the country capital's zone
 *   would put a confident wrong answer behind the `in | datetime | place`
 *   bridge — Beverly Hills is not on New York time.
 * - `currency` is "" on every row this package produces. It is a country-level
 *   fact and `@smartput/country`'s `COUNTRIES` already holds it, so a caller
 *   joins on `country`; shipping a currency table here would give this package
 *   the data geocode spec §3 promises it does not have. The one exception is
 *   `GeoNames.countries()`, which asks GeoNames for countries and is handed the
 *   currency by upstream — see its header.
 * - `geonameId` is 0 on a postal row, which upstream gives no feature id at all.
 *   0 is not a GeoNames id, so it reads as "none" — but two such rows compare
 *   equal under geo spec §4.2's canonical identity, and that is the known cost.
 *   The rejected alternative was hashing the code into a synthetic id: it would
 *   look stable, survive into a Value's canonical, and collide with a real id.
 */
export interface Place extends PlaceMeta {
  /** GeoNames' admin1 code — "TX", "11" — or "" where upstream carries none. */
  readonly admin1: string;
  /** The postal code this row was found under, "" for a feature row. */
  readonly postal: string;
}

/**
 * How a caller narrows an ambiguous name. Deliberately the same two axes the
 * matcher's scope walks (geo spec §5.2) — a scope is a division or a country —
 * so the string a matcher claimed and the hint a provider takes describe one
 * idea.
 */
export interface PlaceHint {
  /** ISO 3166-1 alpha-2, either case. */
  readonly country?: string;
  /** An admin1 code as GeoNames writes it, either case. */
  readonly admin1?: string;
}

/** The sync half: a name in, at most one place out. */
export interface PlaceLookup {
  find(name: string, hint?: PlaceHint): Place | null;
}

/** A dated, immutable lookup — the geo mirror of `RateSnapshot`. */
export interface PlaceSnapshot extends PlaceLookup {
  readonly asOf: string;
}

/**
 * The narrow async half that shipped with the four-package split: a string in,
 * rows out.
 *
 * Superseded by `GeoProvider` in `types.ts`, which takes a `GeoQuery` and
 * returns scored hits, and kept because `@smartput/country/providers` still
 * re-exports it and because `custom(fn)` is the one-line adapter that turns any
 * async source into a provider. Geocode spec §1 states the complaint in full: a
 * bare string carries no proximity, no bounding box, no language, no abort and
 * no score, and every real gazetteer answers at least four of those.
 */
export interface PlaceProvider {
  readonly id: string;
  lookup(q: string): Promise<Place[]>;
}

/**
 * A place provider could not produce usable rows: the request failed, or the
 * payload was not the shape the parser was written against.
 *
 * Not `RateProviderError`, whose message reads `Rate provider "geonames"
 * failed: …` verbatim — that string reaches a user, and a place lookup is not a
 * rate lookup. Not added to `core/errors.ts` beside it either: core hosts the
 * errors its own evaluate path can throw, and `MissingRateError` is one, but no
 * provider error ever crosses that path — a provider runs before an engine is
 * built and core never constructs or catches this.
 *
 * It still extends `SmartputError`, for exactly the reason `RateProviderError`'s
 * own header gives: `instanceof SmartputError` is the discriminator this
 * codebase branches on, and an error outside it is invisible to every consumer
 * that follows the convention. There is no source expression, so `input` carries
 * the provider id.
 */
export class PlaceProviderError extends SmartputError {
  readonly provider: string;
  constructor(provider: string, detail: string) {
    super(`Place provider ${JSON.stringify(provider)} failed: ${detail}`, provider);
    // Literal, never `new.target.name`: a minifier renames the class.
    this.name = "PlaceProviderError";
    this.provider = provider;
  }
}

/**
 * Fold a name to its index key. Lowercased, trimmed, inner runs of whitespace
 * collapsed — the same normalization the matcher's trie assumes of its aliases,
 * so "  BEVERLY   hills " and "beverly hills" are one key.
 *
 * Diacritics are left alone. Stripping them would make "malmo" find Malmö, and
 * also make two genuinely different names collide; the trie does not do it
 * either, and a lookup that disagrees with the matcher about what one name is
 * would be the worse bug.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * A dated, immutable table of places. Satisfies `PlaceLookup` structurally, the
 * way `snapshot()` does for rates, so nothing downstream imports this file to
 * accept one.
 *
 * A postal code is indexed as one more name the row answers to, in the same map
 * as its place name: `find("90210")` and `find("beverly hills")` are then one
 * call and one miss path. Two indexes were the alternative and buy a
 * distinction no caller makes — `find` is handed a string, not a claim about
 * what kind of string it is.
 *
 * Rows are sorted heaviest-first once, at build, rather than scored per lookup.
 * Population and not geo spec §6.1's weights: those weights are the *matcher's*,
 * computed from a trie node's payload, and a provider row carries neither a
 * capital flag nor the country/city distinction they turn on.
 */
export function placeSnapshot(asOf: string, places: readonly Place[]): PlaceSnapshot {
  const index = new Map<string, Place[]>();
  const add = (key: string, row: Place): void => {
    if (key === "") return;
    const bucket = index.get(key);
    if (bucket === undefined) index.set(key, [row]);
    else bucket.push(row);
  };

  // Copied into the index, so a caller mutating its array afterwards cannot
  // change what a snapshot already handed out.
  for (const row of places) {
    add(normalizeName(row.name), row);
    add(normalizeName(row.postal), row);
  }
  for (const bucket of index.values()) bucket.sort((a, b) => b.population - a.population);

  return Object.freeze({
    asOf,
    find(name: string, hint?: PlaceHint): Place | null {
      const bucket = index.get(normalizeName(name));
      if (bucket === undefined) return null;
      if (hint === undefined) return bucket[0] ?? null;

      const country = hint.country?.toLowerCase();
      const admin1 = hint.admin1?.toLowerCase();
      for (const row of bucket) {
        if (country !== undefined && row.country.toLowerCase() !== country) continue;
        if (admin1 !== undefined && row.admin1.toLowerCase() !== admin1) continue;
        return row;
      }
      // Null rather than the unhinted winner. Geo spec §5.2 rules the other way
      // for the matcher — a scope selecting nothing is dropped — because there
      // the fold is destructive and a refused claim throws the whole input away.
      // Here the caller asked a narrower question and can read null; answering
      // it with Paris, France would be a wrong answer in place of a true one.
      return null;
    },
  });
}
