/**
 * The row this package reads, declared structurally rather than imported.
 *
 * `@smartput/country`'s `CountryRow` satisfies it — it is that interface with
 * the six fields no postal question ever asks (`name`, `capital`, `phone`,
 * `area`, `geonameId`) left off — and the reason it is redeclared here is the
 * one core gives for `RatioTable`: the dependency has to run one way. The place
 * kind names `createPostalLiteral`, so this package cannot name the kind's
 * package back without closing a cycle, and a postal format has no need of a
 * country's area anyway.
 *
 * A provider row, a `definePlace()` table and a row hand-written for one country
 * all satisfy this, which is what makes `PostalFormat.of` a door and not a
 * privilege of the vendored table.
 */
export interface PostalCountry {
  /** ISO 3166-1 alpha-2, lowercased. The Value's unit (spec §4.1). */
  readonly a2: string;
  /** ISO 3166-1 alpha-3, lowercased. Read only by `PostalFormats.for`. */
  readonly a3: string;
  /**
   * Lowercased, deduplicated. The qualifier branch reads the single-word ones,
   * `us 90210`; a table with none simply has no qualified reading, which is what
   * `PostalFormat` builds its per-country matcher out of.
   */
  readonly aliases: readonly string[];
  /** GeoNames' postal-code regex, "" where the country has no postal system. */
  readonly postalRegex: string;
  /** Copied into a claim's `PlaceMeta` — a code borrows its country's facts. */
  readonly zone: string;
  readonly currency: string;
  readonly lat: number;
  readonly lon: number;
  readonly population: number;
}
