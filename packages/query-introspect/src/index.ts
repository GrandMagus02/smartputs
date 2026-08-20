/**
 * `@smartput/query-introspect` — a `@smartput/query` schema out of a live
 * database, as a file somebody owns.
 *
 * Codegen and not runtime introspection, which is the whole design. A
 * catalogue proves names, keys, foreign keys, enumerated values and the two
 * temporal kinds; it cannot prove that `total_cents` is money, in what
 * currency, or what a team calls the sum of it. A layer that inferred those at
 * query time would answer a sentence with rows that were silently wrong by a
 * factor of a hundred — ruling R7's exact failure, and the reason
 * `refusal.test.ts` says "a query that returns rows looks like it worked". A
 * generated file puts every one of those guesses in front of a person, as a
 * `TODO`, before it can ever run.
 *
 * `@smartput/query` does not import this package and gains nothing from it. The
 * arrow runs one way: this writes a file, that reads the object the file makes.
 * Even `--check`, which has to read a committed `Schema` back, does it
 * structurally rather than by importing the class.
 */

export {
  type ColumnAnnotation,
  columnAnnotation,
  type TableAnnotation,
  tableAnnotation,
} from "./annotation";
export type {
  Catalog,
  CatalogColumn,
  CatalogForeignKey,
  CatalogReader,
  CatalogTable,
  ProvenType,
} from "./catalog";
export {
  type Drift,
  DriftCheck,
  type DriftKind,
  loadSchemaFile,
  type SchemaShape,
} from "./drift";
export {
  type Binding,
  type EmitOptions,
  provenBinding,
  provenKind,
  SchemaEmitter,
  type Skip,
  skipped,
} from "./emit";
export {
  AnnotationError,
  IntrospectionError,
  SchemaFileError,
  UsageError,
} from "./errors";
export { geoHint, type Hint, hintFor } from "./hints";
