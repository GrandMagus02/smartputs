/**
 * One city of the T1 table (spec §7.1), generated into `data/cities.ts`.
 *
 * Narrower than `CountryRow` on purpose. A city has no currency, no calling code
 * and no postal regex — those belong to the country it joins to through
 * `country`, and duplicating them across five thousand rows would cost more
 * bytes than the whole T0 tier for facts that cannot disagree.
 *
 * T1 is a package of its own (`@smartput/city`) precisely because it is an order
 * of magnitude larger than T0, so every field here has to earn the ~5000 copies
 * of itself it is about to have. `@smartput/country` names this module through
 * `@smartput/city/types` and never the root, which is what keeps the tiering a
 * fact about the import graph rather than a promise in a comment.
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
   * skipped. What that costs is listed in `@smartput/country`'s
   * `data/reserved.ts` header.
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
