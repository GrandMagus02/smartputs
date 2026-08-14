/**
 * The rows the place kind is built from.
 *
 * Three interfaces that used to live in three packages — `CountryRow` in
 * `@smartput/country`, `CityRow` and `Admin1Row` in `@smartput/city`,
 * `PostalCountry` in `@smartput/zip` — and are one module now that the tables
 * they described are gone. The split existed to keep a megabyte of committed
 * gazetteer out of a bundle that only wanted a country; with no gazetteer to
 * keep out, three packages is three release cadences for four interfaces.
 *
 * Flat and primitive-typed. The matcher builds a trie over `aliases` and the
 * kind copies most of the rest straight into `PlaceMeta`, so a nested shape
 * would be unpacked at both ends for nothing. Numbers stay `number` rather than
 * `Decimal` because this is data at rest — `geonameId` is wrapped once, where
 * the Value is built, and nothing else is ever arithmetic.
 *
 * Nothing here is generated any more, and that is the change. A row arrives from
 * a provider — `countryTable()` assembles one from GeoNames — or from whatever
 * the consumer brought, and this file describes its shape rather than a file's
 * contents.
 */

/**
 * One country. The unit of every place Value (geo spec §4.1).
 *
 * Two fields carry a note about where they now come from, because neither is in
 * the endpoint the rest arrives on:
 *
 * - `phone` and `postalRegex` are in GeoNames' `countryInfo.txt` export and not
 *   in `countryInfoJSON`, whose payload stops at `postalCodeFormat`. `countries`
 *   in `../countries.ts` reads the export for them, and derives the regex from
 *   the mask when only the mask is available.
 * - `aliases`, `lat`, `lon` and `zone` come from the country's own **feature**
 *   row — `searchJSON?featureCode=PCLI&style=FULL` — which the country tables
 *   proper do not carry at all.
 */
export interface CountryRow {
  /** ISO 3166-1 alpha-2, lowercased. The kind's unit id (geo spec §4.1). */
  readonly a2: string;
  /** ISO 3166-1 alpha-3, lowercased. */
  readonly a3: string;
  /** GeoNames' name for the country, in whatever language was asked for. */
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
  /**
   * The country feature's latitude — its position for distance purposes.
   *
   * The country's own centroid, where the vendored table used the capital's.
   * The change is upstream's doing rather than a decision: the feature row is
   * where a live source carries a coordinate for a country at all. It is also
   * the better of the two for the one thing this field feeds — `kyiv to warsaw`
   * measures cities, and `ukraine to poland` measuring capitals was always the
   * odder reading.
   */
  readonly lat: number;
  /** The country feature's longitude. */
  readonly lon: number;
  /**
   * IANA. Always present, which is what lets a country be an `in` target for a
   * datetime without datetime knowing anything about places.
   */
  readonly zone: string;
  /** The *country's* GeoNames id, not the capital's. The Value's canonical. */
  readonly geonameId: number;
  /** A postal-code regex, "" where the country has no postal system. */
  readonly postalRegex: string;
}

/**
 * One city.
 *
 * Narrower than `CountryRow` on purpose. A city has no currency, no calling code
 * and no postal regex — those belong to the country it joins to through
 * `country`, and duplicating them across thousands of rows would cost more bytes
 * than the whole country table for facts that cannot disagree.
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
   * The reserved filter is applied to the rows *before* they reach the matcher,
   * so the table cannot claim a word the engine needs: the literal fold is
   * destructive, and a rule enforced at match time is one `if` away from being
   * skipped. `cityRows()` in `../cities.ts` is what applies it.
   */
  readonly aliases: readonly string[];
  /** Lowercase alpha-2. Joins to `CountryRow.a2`; the Value's `unit` (§4.1). */
  readonly country: string;
  /**
   * GeoNames' admin1 code — "TX" for Texas, "11" for a numbered division — or ""
   * when the city has none or the code names no `Admin1Row`. Joined with the
   * uppercased country it is `Admin1Row.key`, which is what makes `paris texas`
   * one walk down the matcher's trie rather than an operation (geo spec §5.2).
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
 * a city can be scoped by one (geo spec §5.2, `paris texas`).
 *
 * Deliberately not a place of its own: it has no coordinates, no zone and no
 * population, so `texas to japan` is not a distance and `georgia` stays the
 * country. Making divisions first-class would double the ambiguity surface for
 * a reading nobody asked for.
 */
export interface Admin1Row {
  /** GeoNames' key: the country's alpha-2 uppercased, a dot, then the code. */
  readonly key: string;
  /** GeoNames' name for the division, "Texas". */
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

/**
 * The subset of a country a postal question actually asks about.
 *
 * `CountryRow` satisfies it — it is that interface with the five fields no
 * postal question ever reads (`name`, `capital`, `phone`, `area`, `geonameId`)
 * left off. Kept as its own interface rather than collapsed into `CountryRow`
 * now that both live in one package, because a row hand-written for one country
 * is a legitimate argument to `PostalFormat.of`, and requiring an area and a
 * GeoNames id to ask "is this a valid British postcode" would make the door a
 * privilege of a full table.
 */
export interface PostalCountry {
  /** ISO 3166-1 alpha-2, lowercased. The Value's unit (geo spec §4.1). */
  readonly a2: string;
  /** ISO 3166-1 alpha-3, lowercased. Read only by `PostalFormats.for`. */
  readonly a3: string;
  /**
   * Lowercased, deduplicated. The qualifier branch reads the single-word ones,
   * `us 90210`; a table with none simply has no qualified reading, which is what
   * `PostalFormat` builds its per-country matcher out of.
   */
  readonly aliases: readonly string[];
  /** A postal-code regex, "" where the country has no postal system. */
  readonly postalRegex: string;
  /** Copied into a claim's `PlaceMeta` — a code borrows its country's facts. */
  readonly zone: string;
  readonly currency: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
}
