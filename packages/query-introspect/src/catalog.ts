/**
 * A database catalogue, in the only terms the emitter needs.
 *
 * Deliberately free of any dialect's vocabulary: no `int8`, no `attnum`, no
 * `information_schema` row shape. A reader for a second dialect is then one
 * file that produces this and nothing else — the structure the brief asked for
 * — and every decision about what a fact *means* stays in one place instead of
 * being made once per dialect.
 *
 * The narrowing lives in `ProvenType`. A reader answers the only question the
 * emitter may ask about a type, which is how a literal binds against the
 * column, and answers `"unknown"` when the dialect's type has no answer. That
 * is what keeps `emit.ts` from ever seeing a type name it could be tempted to
 * pattern-match a `kind` out of.
 */

/**
 * What a column's declared type proves, and nothing more.
 *
 * `"datetime"` and `"date"` are the two entries that name a smartput kind, and
 * they are here rather than in a table of guesses because a `timestamptz`
 * column *is* an instant — the catalogue says so, and no naming convention was
 * consulted to find that out. Every other kind in the repo (money, mass,
 * percent, place) is invisible to a catalogue: `numeric` is a number, and which
 * quantity that number counts is not written down anywhere the database keeps.
 *
 * `"unknown"` is a real answer, not a failure. `json`, `inet`, `interval` and
 * an array all reach it, and the emitter's response is a column with no `as`
 * and a TODO naming the type, which is exactly what is true about them.
 */
export type ProvenType =
  | "number"
  | "string"
  | "boolean"
  | "datetime"
  | "date"
  | "unknown";

export interface CatalogColumn {
  readonly name: string;
  /** The dialect's own type name, for TODO comments and drift messages. */
  readonly sqlType: string;
  readonly type: ProvenType;
  /**
   * The column's enumerated values, when the catalogue proves them: an enum
   * type's labels in declaration order, or the literals of a single-column
   * `CHECK (col IN (...))`. Absent otherwise — never a sample of the data.
   */
  readonly values?: readonly string[];
  /** The column comment verbatim, annotations included. See `annotation.ts`. */
  readonly comment?: string;
}

export interface CatalogTable {
  readonly name: string;
  /**
   * The primary key columns in key order. Empty for a table that has none,
   * which the emitter treats as a table it cannot describe — see `emit.ts`.
   */
  readonly primaryKey: readonly string[];
  readonly columns: readonly CatalogColumn[];
  readonly comment?: string;
}

/**
 * One foreign key, with both sides as ordered column lists.
 *
 * Composite rather than single because a composite foreign key is a real thing
 * a database has, and collapsing it to its first column here would hide the
 * fact from the emitter, which needs to know in order to refuse to write a join
 * edge for it.
 */
export interface CatalogForeignKey {
  readonly name: string;
  readonly from: { readonly table: string; readonly columns: readonly string[] };
  readonly to: { readonly table: string; readonly columns: readonly string[] };
}

export interface Catalog {
  /** `"postgres"`. Printed in the generated header so a reader knows the source. */
  readonly dialect: string;
  readonly tables: readonly CatalogTable[];
  readonly foreignKeys: readonly CatalogForeignKey[];
}

/** A catalogue reader. One implementation per dialect; Postgres is the first. */
export interface CatalogReader {
  read(): Promise<Catalog>;
}
