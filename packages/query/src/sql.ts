import type { CompileCtx, Compiler } from "./compile";
import { UnsupportedQueryError } from "./errors";
import type { Aggregate, ColumnRef, Literal, Predicate, Projection, QueryIr } from "./ir";

/** What a driver is handed: text with placeholders, and the values in order. */
export interface SqlQuery {
  readonly text: string;
  readonly params: readonly SqlParam[];
}

export type SqlParam = string | number | boolean | null | Date;

export interface SqlCompilerOptions {
  /**
   * `numbered` writes `$1`, `$2` (PostgreSQL); `question` writes `?` (MySQL,
   * SQLite). Both bind positionally and neither interpolates, which is ruling
   * R6 — the difference is spelling, not safety.
   */
  readonly placeholder?: "numbered" | "question";
  /** The identifier quote. `"` for standard SQL and PostgreSQL, `` ` `` for MySQL. */
  readonly quote?: string;
  /** Earth's mean radius in metres, for the distance predicate. */
  readonly earthRadius?: number;
}

const DEFAULT_RADIUS = 6_371_000;

/**
 * The SQL dialect.
 *
 * Every value leaves through `bind`, which appends to the parameter array and
 * returns a placeholder. There is no other path from a `Literal` into the text,
 * and that is the property ruling R6 exists to guarantee: a query built from a
 * sentence a stranger typed cannot carry a fragment of that sentence into the
 * statement, because no code here can put one there.
 *
 * Identifiers are the mirror image. They never come from input at all — the
 * linker has already turned every word into a `ColumnRef` naming something the
 * schema declared — so quoting them is about dialect spelling, not about
 * safety.
 */
export class SqlCompiler implements Compiler<SqlQuery> {
  readonly dialect = "sql";
  private readonly style: "numbered" | "question";
  private readonly q: string;
  private readonly radius: number;

  constructor(opts: SqlCompilerOptions = {}) {
    this.style = opts.placeholder ?? "numbered";
    this.q = opts.quote ?? '"';
    this.radius = opts.earthRadius ?? DEFAULT_RADIUS;
  }

  /**
   * `ctx` is unused by this dialect: SQL spells `SELECT *` itself, so it never
   * needs the schema to enumerate a table's columns. It stays in the signature
   * because `Compiler` promises it, and a dialect that does need it — one
   * emitting explicit column lists, or quoting by declared type — gets it
   * without the interface moving.
   */
  compile(ir: QueryIr, _ctx: CompileCtx): SqlQuery {
    const params: SqlParam[] = [];
    const bind = (literal: Literal): string => {
      params.push(literal.value);
      return this.style === "numbered" ? `$${params.length}` : "?";
    };

    const select =
      ir.projection.length === 0
        ? `${this.id(ir.source)}.*`
        : ir.projection.map((p) => this.projection(p)).join(", ");

    const parts: string[] = [
      `SELECT ${ir.distinct ? "DISTINCT " : ""}${select}`,
      `FROM ${this.id(ir.source)}`,
    ];
    for (const j of ir.joins) {
      parts.push(`JOIN ${this.id(j.table)} ON ${this.ref(j.from)} = ${this.ref(j.to)}`);
    }
    if (ir.predicate !== undefined) {
      parts.push(`WHERE ${this.predicate(ir.predicate, bind)}`);
    }
    if (ir.group.length > 0) {
      parts.push(`GROUP BY ${ir.group.map((g) => this.ref(g)).join(", ")}`);
    }
    if (ir.having !== undefined) {
      parts.push(`HAVING ${this.predicate(ir.having, bind)}`);
    }
    if (ir.order.length > 0) {
      const terms = ir.order.map(
        (o) => `${this.expr(o.term)} ${o.direction === "desc" ? "DESC" : "ASC"}`,
      );
      parts.push(`ORDER BY ${terms.join(", ")}`);
    }
    if (ir.limit !== undefined) {
      // The limit is a literal integer the parser produced, never a fragment of
      // input, so it is written rather than bound — several engines refuse a
      // placeholder here, and there is nothing to protect against.
      parts.push(`LIMIT ${Math.trunc(ir.limit)}`);
    }
    return { text: parts.join(" "), params };
  }

  private id(name: string): string {
    return `${this.q}${name.replaceAll(this.q, this.q + this.q)}${this.q}`;
  }

  private ref(ref: ColumnRef): string {
    return `${this.id(ref.table)}.${this.id(ref.column)}`;
  }

  private aggregate(a: Aggregate): string {
    if (a.fn === "count") {
      return a.column === undefined ? "COUNT(*)" : `COUNT(${this.ref(a.column)})`;
    }
    if (a.column === undefined) {
      throw new UnsupportedQueryError("", `${a.fn} of rows`, "name a column");
    }
    return `${a.fn.toUpperCase()}(${this.ref(a.column)})`;
  }

  private expr(p: Projection): string {
    return p.type === "column" ? this.ref(p.column) : this.aggregate(p.aggregate);
  }

  private projection(p: Projection): string {
    if (p.type === "column") return this.ref(p.column);
    const alias = p.aggregate.metric;
    const text = this.aggregate(p.aggregate);
    return alias === undefined ? text : `${text} AS ${this.id(alias)}`;
  }

  private predicate(p: Predicate, bind: (l: Literal) => string): string {
    switch (p.type) {
      case "and":
        return p.terms.map((t) => this.predicate(t, bind)).join(" AND ");
      case "or":
        return `(${p.terms.map((t) => this.predicate(t, bind)).join(" OR ")})`;
      case "not":
        return `NOT (${this.predicate(p.term, bind)})`;
      case "null":
        return `${this.expr(p.target)} IS ${p.negated ? "NOT " : ""}NULL`;
      case "between": {
        const target = this.expr(p.target);
        const upper = p.upperExclusive ? "<" : "<=";
        return `${target} >= ${this.operand(p.low, bind)} AND ${target} ${upper} ${this.operand(p.high, bind)}`;
      }
      case "in": {
        const values = p.values.map((v) => this.operand(v, bind));
        return `${this.expr(p.target)} IN (${values.join(", ")})`;
      }
      case "near": {
        // Haversine, spelled with the four functions every SQL engine has. A
        // PostGIS build would rather have `ST_DWithin`, and gets it by passing
        // a compiler of its own — which is the point of ruling R3.
        const lat = this.ref(p.lat);
        const lon = this.ref(p.lon);
        const cLat = bind({ value: p.centreLat, source: p.source });
        const cLat2 = bind({ value: p.centreLat, source: p.source });
        const cLon = bind({ value: p.centreLon, source: p.source });
        const r = bind({ value: p.radiusMetres, source: p.source });
        return (
          `${this.radius} * 2 * ASIN(SQRT(` +
          `POWER(SIN(RADIANS(${lat} - ${cLat}) / 2), 2) + ` +
          `COS(RADIANS(${cLat2})) * COS(RADIANS(${lat})) * ` +
          `POWER(SIN(RADIANS(${lon} - ${cLon}) / 2), 2)` +
          `)) <= ${r}`
        );
      }
      default: {
        const target = this.expr(p.target);
        if (p.op === "contains" || p.op === "startsWith" || p.op === "endsWith") {
          const literal = asLiteral(p.operand);
          const text = String(literal.value);
          const pattern =
            p.op === "contains"
              ? `%${text}%`
              : p.op === "startsWith"
                ? `${text}%`
                : `%${text}`;
          // The wildcards are added to the *value*, never to the text, so the
          // pattern is still a bound parameter.
          return `${target} LIKE ${bind({ ...literal, value: pattern })}`;
        }
        return `${target} ${p.op} ${this.operand(p.operand, bind)}`;
      }
    }
  }

  private operand(
    o: { type: "literal"; literal: Literal } | { type: "column"; column: ColumnRef },
    bind: (l: Literal) => string,
  ): string {
    return o.type === "column" ? this.ref(o.column) : bind(o.literal);
  }
}

function asLiteral(o: {
  type: "literal" | "column";
  literal?: Literal;
  column?: ColumnRef;
}): Literal {
  if (o.literal === undefined) {
    throw new UnsupportedQueryError(
      "",
      "a text pattern against a column",
      "compare to a value",
    );
  }
  return o.literal;
}
