/**
 * `@smartput/query` — a database query out of a sentence, with no model in the
 * loop.
 *
 * The two compilers are deliberately absent from this barrel. They live at
 * `@smartput/query/sql` and `@smartput/query/mongo` so that a consumer links
 * the dialect they speak and not the one they do not — the same reason
 * `@smartput/datetime` keeps its holiday tables behind a subpath.
 */
export type { CompileCtx, Compiler } from "./compile";
export {
  AmbiguousJoinError,
  AmbiguousQueryError,
  QueryParseError,
  SchemaError,
  UnknownColumnError,
  UnsupportedQueryError,
} from "./errors";
export type {
  Aggregate,
  AggregateFn,
  Between,
  ColumnRef,
  CompareOp,
  JoinStep,
  Literal,
  Near,
  Operand,
  OrderTerm,
  Phrase,
  Predicate,
  Projection,
  QueryIr,
} from "./ir";
// The structural readers, public because a custom compiler emitting its own
// distance or interval predicate needs the same two questions answered and
// should not re-derive the answers from `meta` by hand.
export { bindingOf, geoOf, OperandReader, type Reading, rangeOf } from "./link";
// Exported so a consumer can drive the clause grammar without a `QueryEngine`
// — the same reason core exports `Tokenizer` and `Parser` beside `createEngine`.
export { lex, QueryParser, type QueryParserOptions } from "./parse";
export { QueryEngine, type QueryEngineOptions } from "./query";
export {
  type ColumnDef,
  defineSchema,
  type GeoDef,
  type JoinEdge,
  type LexEntry,
  type MetricDef,
  type QuerySchemaDef,
  Schema,
  type TableDef,
} from "./schema";
export { MAX_PHRASE_WORDS, type QueryVocabulary, queryEn } from "./vocabulary";
