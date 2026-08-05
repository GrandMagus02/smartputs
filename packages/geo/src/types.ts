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

/**
 * One city of the T1 table (spec §7.1), generated into `data/cities.ts`.
 *
 * Narrower than `CountryRow` on purpose. A city has no currency, no calling code
 * and no postal regex — those belong to the country it joins to through
 * `country`, and duplicating them across five thousand rows would cost more
 * bytes than the whole T0 tier for facts that cannot disagree.
 *
 * T1 is a separate entry point (`@smartput/geo/cities`) precisely because it is
 * an order of magnitude larger than T0, so every field here has to earn the
 * ~5000 copies of itself it is about to have.
 */
export interface CityRow {
  /** The Value's canonical, as `CountryRow.geonameId` is for a country. */
  readonly geonameId: number;
  /** GeoNames' display form, "Paris". Not normalized; the aliases are. */
  readonly name: string;
  /**
   * Lowercased, deduplicated, at most four words, at least `MIN_NAME_LENGTH`
   * characters, and never a member of `RESERVED_WORDS` when it is a single word.
   *
   * The reserved filter runs in the generator rather than in the matcher so the
   * shipped table cannot claim a word the engine needs: the literal fold is
   * destructive, and a rule enforced at match time is one `if` away from being
   * skipped. What that costs is listed in `data/reserved.ts`'s header.
   */
  readonly aliases: readonly string[];
  /** Lowercase alpha-2. Joins to `CountryRow.a2`; the Value's `unit` (spec §4.1). */
  readonly country: string;
  /**
   * GeoNames' admin1 code — "TX" for Texas, "11" for a numbered division — or ""
   * when the city has none or the code names no `Admin1Row`. Joined with the
   * uppercased country it is `Admin1Row.key`, which is what makes `paris texas`
   * one walk down the matcher's trie rather than an operation (spec §5.2).
   */
  readonly admin1: string;
  readonly lat: number;
  readonly lon: number;
  /** IANA. The city's own, not the country's: `houston` is not `washington`. */
  readonly zone: string;
  readonly population: number;
  /**
   * GeoNames feature code PPLC — a seat of government. Carried as a flag rather
   * than left to be recovered by matching `CountryRow.capital` by name, because
   * that join is the one M6.1 found unreliable, and §6.1 weights a capital above
   * a city of the same size.
   */
  readonly capital: boolean;
}

/**
 * One first-level division — a state, an oblast, a prefecture — carried only so
 * a city can be scoped by one (spec §5.2, `paris texas`).
 *
 * It is deliberately not a place of its own: it has no coordinates, no zone and
 * no population, so `texas to japan` is not a distance and `georgia` stays the
 * country. Making divisions first-class would double the ambiguity surface for
 * a reading nobody asked for.
 */
export interface Admin1Row {
  /** GeoNames' key: the country's alpha-2 uppercased, a dot, then the code. */
  readonly key: string;
  /** GeoNames' English name, "Texas". */
  readonly name: string;
  /**
   * Lowercased, deduplicated, `["texas", "tx"]`.
   *
   * These are allowed below `MIN_NAME_LENGTH` where the country aliases are not,
   * because an admin1 alias is only ever read in the scoped position — the
   * second word of a two-word claim — and two words in a row are nobody's unit
   * and nobody's keyword. `RESERVED_WORDS` still applies, which is what keeps
   * Indiana's "in" and Oregon's "or" out of `paris in ukraine`.
   */
  readonly aliases: readonly string[];
}
