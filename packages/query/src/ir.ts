import type { Decimal, KindId } from "@smartput/core";

/**
 * The dialect-free intermediate representation, and ruling R3's whole subject.
 *
 * Nothing here names SQL, Mongo or any other backend. A `Compiler` reads this
 * plus the `Schema` and produces whatever its database speaks, which is what
 * makes a third dialect a file rather than a fork: the parser, the linker, the
 * unit conversion and the ambiguity rules are all upstream of this type and are
 * shared by every compiler that will ever exist.
 *
 * It is deliberately not a relational algebra. There are no set operations, no
 * subqueries and no correlated references, because ruling R7 refuses the
 * constructs that would need them — and a representation able to express a
 * construct the parser refuses is an invitation to reach for it later.
 */

/**
 * A run of the input, carried with its offsets.
 *
 * It lives here rather than in the parser because the operand reader is handed
 * these and the errors report them, so all three modules would otherwise import
 * a type from whichever of them happened to declare it first.
 */
export interface Phrase {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** A column, always qualified: a linker that returned bare names would push the
 * table lookup into every compiler. */
export interface ColumnRef {
  readonly table: string;
  readonly column: string;
}

export type AggregateFn = "count" | "sum" | "avg" | "min" | "max";

export interface Aggregate {
  readonly fn: AggregateFn;
  /** Absent only for `count`, which counts rows rather than values. */
  readonly column?: ColumnRef;
  /** The table `count` counts rows of. Present exactly when `column` is absent. */
  readonly table?: string;
  /** The declared metric this came from, when it came from one. Compilers use
   * it as the emitted alias, so `sum of total` and `revenue` are the same
   * aggregate under different names. */
  readonly metric?: string;
}

export type Projection =
  | { readonly type: "column"; readonly column: ColumnRef }
  | { readonly type: "aggregate"; readonly aggregate: Aggregate };

/**
 * A value bound as a parameter, never interpolated (ruling R6).
 *
 * `value` is what a driver binds and is deliberately a JS primitive or a
 * `Date`: a driver knows those, and a `Decimal` reaches most of them as
 * `[object Object]`. `decimal` carries the exact figure beside it for a caller
 * that wants the precision back — money is stored in minor units precisely so
 * the binding is an integer, and this is the seam where that is checkable.
 */
export interface Literal {
  readonly value: string | number | boolean | null | Date;
  /** The exact figure, when the value is numeric. */
  readonly decimal?: Decimal;
  /** The kind the engine read the source fragment as. */
  readonly kind?: KindId;
  /** The column's storage unit this was converted into — ruling R4. */
  readonly unit?: string;
  /** The substring of the input that produced it. */
  readonly source: string;
}

export type Operand =
  | { readonly type: "literal"; readonly literal: Literal }
  | { readonly type: "column"; readonly column: ColumnRef };

export type CompareOp =
  | "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "contains"
  | "startsWith"
  | "endsWith";

/**
 * A half-open interval, and the one place this package restates a rule it
 * inherited: the range packages store their end exclusive, so a `last week`
 * operand arriving as a range has an end that is the first instant *after* the
 * week. `upperExclusive` carries that to the compiler rather than letting each
 * compiler guess, because a compiler that emitted `<=` would silently include
 * the first row of the next week and no test of the SQL alone would show it.
 */
export interface Between {
  readonly type: "between";
  readonly target: Projection;
  readonly low: Operand;
  readonly high: Operand;
  readonly upperExclusive: boolean;
}

/**
 * A great-circle radius predicate. The centre travels as plain degrees and the
 * radius as metres, so a compiler needs no geography — `SqlCompiler` emits the
 * haversine expression and `MongoCompiler` emits `$centerSphere`, and neither
 * has to know what a kilometre is because ruling R4 already converted it.
 */
export interface Near {
  readonly type: "near";
  readonly lat: ColumnRef;
  readonly lon: ColumnRef;
  readonly centreLat: number;
  readonly centreLon: number;
  readonly radiusMetres: number;
  readonly source: string;
}

export type Predicate =
  | {
      readonly type: "compare";
      readonly target: Projection;
      readonly op: CompareOp;
      readonly operand: Operand;
    }
  | Between
  | {
      readonly type: "in";
      readonly target: Projection;
      readonly values: readonly Operand[];
    }
  | { readonly type: "null"; readonly target: Projection; readonly negated: boolean }
  | Near
  | { readonly type: "and"; readonly terms: readonly Predicate[] }
  | { readonly type: "or"; readonly terms: readonly Predicate[] }
  | { readonly type: "not"; readonly term: Predicate };

export interface OrderTerm {
  readonly term: Projection;
  readonly direction: "asc" | "desc";
}

/**
 * One hop of a resolved join path. `from` is the column on the table already in
 * scope and `to` is the column on the table being brought in, so a compiler
 * emits hops in order without re-deriving direction from the schema's edges —
 * which are undirected, because `orders.customer_id = customers.id` is the same
 * fact read from either end.
 */
export interface JoinStep {
  readonly from: ColumnRef;
  readonly to: ColumnRef;
  readonly table: string;
}

export interface QueryIr {
  readonly source: string;
  readonly joins: readonly JoinStep[];
  /** Empty means every column of `source`. */
  readonly projection: readonly Projection[];
  readonly predicate?: Predicate;
  /**
   * Predicates over aggregates, separated from `predicate` by the linker rather
   * than by each compiler. Both SQL and Mongo need the split — `HAVING` and a
   * post-`$group` `$match` — so making it once upstream is the difference
   * between one rule and one rule per dialect.
   */
  readonly having?: Predicate;
  readonly group: readonly ColumnRef[];
  readonly order: readonly OrderTerm[];
  readonly limit?: number;
  readonly distinct: boolean;
}
