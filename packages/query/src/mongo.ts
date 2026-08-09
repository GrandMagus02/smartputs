import type { CompileCtx, Compiler } from "./compile";
import { UnsupportedQueryError } from "./errors";
import type { Aggregate, ColumnRef, Literal, Predicate, Projection, QueryIr } from "./ir";

export type MongoDocument = Record<string, unknown>;

/**
 * What a driver is handed.
 *
 * `pipeline` is always emitted and is the canonical answer: a grouped or joined
 * query has no `find` form at all. `find` is emitted beside it only when the
 * query is a plain filter, because that is the call a consumer actually wants
 * for the common case — `collection.find(filter)` is cheaper than an
 * aggregation and reads better in a log.
 */
export interface MongoQuery {
  readonly collection: string;
  readonly pipeline: readonly MongoDocument[];
  readonly find?: {
    readonly filter: MongoDocument;
    readonly projection?: MongoDocument;
    readonly sort?: MongoDocument;
    readonly limit?: number;
  };
}

export interface MongoCompilerOptions {
  /** Earth's mean radius in metres, for `$centerSphere`'s radian conversion. */
  readonly earthRadius?: number;
}

const DEFAULT_RADIUS = 6_371_000;

const OPS: Record<string, string> = {
  "=": "$eq",
  "!=": "$ne",
  "<": "$lt",
  "<=": "$lte",
  ">": "$gt",
  ">=": "$gte",
};

/**
 * The MongoDB dialect.
 *
 * There is nothing to parameterize here — a query is a document and a value is
 * a field of it, so ruling R6 holds by construction rather than by discipline.
 * What replaces it is a different rule with the same shape: a field *path*
 * never comes from input either, because the linker resolved every word to a
 * declared column before this class saw it.
 *
 * Joined tables arrive through `$lookup` and are addressed by the table's own
 * name, so `customers.country_code` in the IR is `customers.country_code` in
 * the pipeline. That is why `$unwind` follows every lookup: without it the
 * joined side is an array and every predicate on it silently means "any
 * element", which is a different query from the one that was asked.
 */
export class MongoCompiler implements Compiler<MongoQuery> {
  readonly dialect = "mongodb";
  private readonly radius: number;

  constructor(opts: MongoCompilerOptions = {}) {
    this.radius = opts.earthRadius ?? DEFAULT_RADIUS;
  }

  compile(ir: QueryIr, ctx: CompileCtx): MongoQuery {
    const pipeline: MongoDocument[] = [];
    for (const j of ir.joins) {
      pipeline.push({
        $lookup: {
          from: j.table,
          localField: this.path(j.from, ir.source),
          foreignField: j.to.column,
          as: j.table,
        },
      });
      pipeline.push({ $unwind: `$${j.table}` });
    }
    const point = ctx.schema.table(ir.source).geo?.point;
    const filter =
      ir.predicate === undefined ? {} : this.predicate(ir.predicate, ir.source, point);
    if (ir.predicate !== undefined) pipeline.push({ $match: filter });

    const grouped =
      ir.group.length > 0 || ir.projection.some((p) => p.type === "aggregate");
    if (grouped) pipeline.push(...this.group(ir, ctx));
    if (ir.having !== undefined) {
      pipeline.push({ $match: this.predicate(ir.having, ir.source, point, true) });
    }

    const sort = this.sort(ir);
    if (sort !== undefined) pipeline.push({ $sort: sort });
    if (ir.limit !== undefined) pipeline.push({ $limit: Math.trunc(ir.limit) });

    const projection = this.projection(ir);
    if (!grouped && projection !== undefined) pipeline.push({ $project: projection });

    const simple = ir.joins.length === 0 && !grouped && ir.having === undefined;
    return {
      collection: ir.source,
      pipeline,
      ...(simple
        ? {
            find: {
              filter,
              ...(projection === undefined ? {} : { projection }),
              ...(sort === undefined ? {} : { sort }),
              ...(ir.limit === undefined ? {} : { limit: Math.trunc(ir.limit) }),
            },
          }
        : {}),
    };
  }

  /**
   * A column as a field path. The source collection's own columns are bare;
   * everything else is qualified by the table `$lookup` brought it in as.
   */
  private path(ref: ColumnRef, source: string): string {
    return ref.table === source ? ref.column : `${ref.table}.${ref.column}`;
  }

  private aggregateExpr(a: Aggregate, source: string): MongoDocument {
    if (a.fn === "count") return { $sum: 1 };
    if (a.column === undefined) {
      throw new UnsupportedQueryError("", `${a.fn} of rows`, "name a column");
    }
    return { [`$${a.fn}`]: `$${this.path(a.column, source)}` };
  }

  /** The name an aggregate is stored under after `$group`. */
  private aggregateName(a: Aggregate): string {
    if (a.metric !== undefined) return a.metric;
    if (a.column === undefined) return "count";
    return `${a.fn}_${a.column.column}`;
  }

  private group(ir: QueryIr, _ctx: CompileCtx): MongoDocument[] {
    const id: MongoDocument | null =
      ir.group.length === 0
        ? null
        : Object.fromEntries(
            ir.group.map((g) => [g.column, `$${this.path(g, ir.source)}`]),
          );
    const stage: MongoDocument = { _id: id };
    for (const p of ir.projection) {
      if (p.type !== "aggregate") continue;
      stage[this.aggregateName(p.aggregate)] = this.aggregateExpr(p.aggregate, ir.source);
    }
    for (const o of ir.order) {
      if (o.term.type !== "aggregate") continue;
      const name = this.aggregateName(o.term.aggregate);
      if (!(name in stage)) stage[name] = this.aggregateExpr(o.term.aggregate, ir.source);
    }
    if (ir.having !== undefined) {
      for (const a of aggregatesOf(ir.having)) {
        const name = this.aggregateName(a);
        if (!(name in stage)) stage[name] = this.aggregateExpr(a, ir.source);
      }
    }
    const stages: MongoDocument[] = [{ $group: stage }];
    // `_id` is a document after a group, and a consumer wants the grouped
    // columns back at the top level under the names they typed.
    if (id !== null) {
      const fields: MongoDocument = { _id: 0 };
      for (const g of ir.group) fields[g.column] = `$_id.${g.column}`;
      for (const key of Object.keys(stage)) if (key !== "_id") fields[key] = 1;
      stages.push({ $project: fields });
    }
    return stages;
  }

  private sort(ir: QueryIr): MongoDocument | undefined {
    if (ir.order.length === 0) return undefined;
    const out: MongoDocument = {};
    for (const o of ir.order) {
      const key =
        o.term.type === "column"
          ? this.path(o.term.column, ir.source)
          : this.aggregateName(o.term.aggregate);
      out[key] = o.direction === "desc" ? -1 : 1;
    }
    return out;
  }

  private projection(ir: QueryIr): MongoDocument | undefined {
    if (ir.projection.length === 0) return undefined;
    const out: MongoDocument = {};
    for (const p of ir.projection) {
      if (p.type === "column") out[this.path(p.column, ir.source)] = 1;
      else out[this.aggregateName(p.aggregate)] = 1;
    }
    return out;
  }

  /**
   * `grouped` says the predicate runs after `$group`, where an aggregate is an
   * ordinary field under the name the group stage gave it — which is the whole
   * difference between a `HAVING` and a `WHERE` in this dialect.
   */
  private predicate(
    p: Predicate,
    source: string,
    point: string | undefined,
    grouped = false,
  ): MongoDocument {
    switch (p.type) {
      case "and": {
        const terms = p.terms.map((t) => this.predicate(t, source, point, grouped));
        return terms.length === 1 ? (terms[0] as MongoDocument) : { $and: terms };
      }
      case "or":
        return { $or: p.terms.map((t) => this.predicate(t, source, point, grouped)) };
      case "not":
        return { $nor: [this.predicate(p.term, source, point, grouped)] };
      case "null":
        return {
          [this.field(p.target, source, grouped)]: p.negated ? { $ne: null } : null,
        };
      case "between": {
        const upper = p.upperExclusive ? "$lt" : "$lte";
        return {
          [this.field(p.target, source, grouped)]: {
            $gte: value(p.low),
            [upper]: value(p.high),
          },
        };
      }
      case "in":
        return {
          [this.field(p.target, source, grouped)]: { $in: p.values.map((v) => value(v)) },
        };
      case "near": {
        // Two scalar columns cannot be handed to `$geoWithin`: a document store
        // keeps a point as one field, and a schema that means to be queried by
        // distance says which field that is. Refusing when it did not is ruling
        // R7 — a hand-rolled haversine in `$expr` would be slower than a
        // collection scan and would silently ignore any 2dsphere index.
        if (point === undefined) {
          throw new UnsupportedQueryError(
            "",
            "a distance filter without a point field",
            "declare `geo.point` on the table so $geoWithin has a field to read",
          );
        }
        // `$centerSphere` takes its radius in radians, which is the one unit
        // conversion no compiler can avoid: it is a property of the operator,
        // not of the schema, so ruling R4 does not reach it.
        return {
          [point]: {
            $geoWithin: {
              $centerSphere: [[p.centreLon, p.centreLat], p.radiusMetres / this.radius],
            },
          },
        };
      }
      default: {
        const field = this.field(p.target, source, grouped);
        const literal = p.operand.type === "literal" ? p.operand.literal : undefined;
        if (p.op === "contains" || p.op === "startsWith" || p.op === "endsWith") {
          if (literal === undefined) {
            throw new UnsupportedQueryError(
              "",
              "a text pattern against a column",
              "compare to a value",
            );
          }
          const text = escapeRegex(String(literal.value));
          const pattern =
            p.op === "contains" ? text : p.op === "startsWith" ? `^${text}` : `${text}$`;
          return { [field]: { $regex: pattern, $options: "i" } };
        }
        if (p.operand.type === "column") {
          return {
            $expr: {
              [OPS[p.op] as string]: [
                `$${field}`,
                `$${this.path(p.operand.column, source)}`,
              ],
            },
          };
        }
        return { [field]: { [OPS[p.op] as string]: value(p.operand) } };
      }
    }
  }

  private field(target: Projection, source: string, grouped: boolean): string {
    if (target.type === "column") return this.path(target.column, source);
    if (!grouped) {
      throw new UnsupportedQueryError(
        "",
        "an aggregate in a filter",
        "it belongs after grouping",
      );
    }
    return this.aggregateName(target.aggregate);
  }
}

const value = (o: { type: "literal"; literal: Literal } | { type: "column" }): unknown =>
  o.type === "literal" ? o.literal.value : undefined;

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function aggregatesOf(p: Predicate): Aggregate[] {
  switch (p.type) {
    case "compare":
    case "between":
    case "in":
    case "null":
      return p.target.type === "aggregate" ? [p.target.aggregate] : [];
    case "and":
    case "or":
      return p.terms.flatMap(aggregatesOf);
    case "not":
      return aggregatesOf(p.term);
    default:
      return [];
  }
}
