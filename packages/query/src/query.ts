import { type Engine, SmartputError } from "@smartput/core";
import type { CompileCtx, Compiler } from "./compile";
import { SchemaError } from "./errors";
import type { QueryIr } from "./ir";
import { OperandReader } from "./link";
import { QueryParser } from "./parse";
import { type QuerySchemaDef, Schema } from "./schema";
import type { QueryVocabulary } from "./vocabulary";

export interface QueryEngineOptions {
  /** A schema literal or an already-built `Schema`. */
  readonly schema: Schema | QuerySchemaDef;
  /**
   * The engine every value fragment is read through. The consumer builds it,
   * because the kinds it registers decide what a filter can say: an engine
   * without `@smartput/rate` cannot read `€500`, and one without the range
   * kinds cannot read `last quarter`. This package registers nothing and knows
   * about no kind by name except through the schema's `kind` fields.
   */
  readonly engine: Engine;
  readonly vocabulary?: QueryVocabulary;
}

/**
 * The public door.
 *
 * A class rather than a function for the reason every stage in core is one: it
 * holds the two things that are expensive to build — the schema's indexes and
 * the operand reader's unit calibrations — and a per-call function would
 * rebuild both on every keystroke.
 *
 * It compiles nothing on its own. `compile` takes the dialect as an argument
 * (ruling R3), which is also what keeps `@smartput/query` free of both
 * compilers: a consumer who only speaks SQL imports `@smartput/query/sql` and
 * never links the Mongo emitter.
 */
export class QueryEngine {
  readonly schema: Schema;
  private readonly parser: QueryParser;

  constructor(opts: QueryEngineOptions) {
    this.schema = opts.schema instanceof Schema ? opts.schema : new Schema(opts.schema);
    const reader = new OperandReader({ engine: opts.engine, schema: this.schema });
    this.parser = new QueryParser({
      schema: this.schema,
      reader,
      ...(opts.vocabulary === undefined ? {} : { vocabulary: opts.vocabulary }),
    });
  }

  /** The dialect-free reading of the input. Throws exactly as core's `evaluate` does. */
  parse(input: string): QueryIr {
    return this.parser.run(input);
  }

  compile<T>(input: string, compiler: Compiler<T>): T {
    const ir = this.parse(input);
    const ctx: CompileCtx = { schema: this.schema, input };
    return compiler.compile(ir, ctx);
  }

  /** Compile an IR that was produced earlier — the same call without the parse. */
  emit<T>(ir: QueryIr, compiler: Compiler<T>, input = ""): T {
    return compiler.compile(ir, { schema: this.schema, input });
  }

  /**
   * The reading, or nothing.
   *
   * The contract is core's, down to which errors survive: a `SchemaError`
   * describes the caller's wiring rather than the caller's input and is
   * re-thrown, exactly as core re-throws `KindConflictError` out of `suggest`.
   * An `AmbiguousQueryError` is re-thrown too, and that is not a compromise —
   * its readings are on the error, so swallowing it would discard the only
   * thing a caller could act on.
   */
  suggest(input: string): QueryIr[] {
    try {
      return [this.parse(input)];
    } catch (e) {
      if (e instanceof SchemaError) throw e;
      if (e instanceof SmartputError && e.name === "AmbiguousQueryError") throw e;
      if (e instanceof SmartputError) return [];
      throw e;
    }
  }
}
