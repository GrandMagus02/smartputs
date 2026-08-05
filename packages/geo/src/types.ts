/**
 * One country of the T0 table (spec §7.1).
 *
 * Flat and primitive-typed. The matcher builds a trie over `aliases` and the
 * kind copies most of the rest straight into `PlaceMeta`, so a nested shape
 * would be unpacked at both ends for nothing. Numbers stay `number` rather than
 * `Decimal` because this is data at rest — `geonameId` is wrapped once, where
 * the Value is built, and nothing else is ever arithmetic.
 *
 * Generated into `data/countries.ts` by `scripts/geo/build.ts` and committed.
 * Never hand-edited: `data/countries.test.ts` recomputes the file's body hash.
 */
export interface CountryRow {
  /** ISO 3166-1 alpha-2, lowercased. The kind's unit id (spec §4.1). */
  readonly a2: string;
  /** ISO 3166-1 alpha-3, lowercased. */
  readonly a3: string;
  /** GeoNames' English name, e.g. "Japan". Display form, not normalized. */
  readonly name: string;
  /**
   * Lowercased, deduplicated, at most four words each. Includes `a2`, `a3` and
   * `name`. One- and two-letter entries are refused unless the entry is `a2`,
   * because two letters is the whole ISO code space plus most of the unit
   * vocabulary and a place must not claim a token another kind owns.
   */
  readonly aliases: readonly string[];
  /** The capital as GeoNames names the city, "" for the few with none. */
  readonly capital: string;
  /** ISO 4217, uppercase. "" for Antarctica, which has no legal tender. */
  readonly currency: string;
  /** Calling code without the plus, e.g. "81". May be "" or comma-joined. */
  readonly phone: string;
  readonly population: number;
  /** Square kilometres. */
  readonly area: number;
  /** The capital's latitude — the country's position for distance purposes. */
  readonly lat: number;
  /** The capital's longitude. */
  readonly lon: number;
  /**
   * The capital's IANA zone. Always present, which is what lets a country be an
   * `in` target for a datetime without datetime knowing anything about places.
   */
  readonly zone: string;
  /** The *country's* GeoNames id, not the capital's. The Value's canonical. */
  readonly geonameId: number;
  /** GeoNames' postal-code regex, "" where the country has no postal system. */
  readonly postalRegex: string;
}
