import type { QueryIr } from "./ir";
import type { Schema } from "./schema";

/**
 * Everything a compiler may read besides the IR.
 *
 * The schema is here because a compiler needs what the IR deliberately does not
 * carry — which columns a table has, so `SELECT *` can be spelled out; what a
 * column is called in the store, when that differs from its name. The input is
 * here so an error thrown during emit reports the sentence the user typed
 * rather than a fragment of IR nobody wrote.
 */
export interface CompileCtx {
  readonly schema: Schema;
  readonly input: string;
}

/**
 * Ruling R3's seam. A dialect is a class implementing this and nothing else.
 *
 * Generic in its output because the two dialects that ship return genuinely
 * different things — SQL returns text and a parameter array, Mongo returns a
 * pipeline of documents — and forcing both into a common envelope would mean
 * every consumer unwrapped a union to get at the thing they asked for.
 *
 * A third dialect needs no change here and no change upstream: everything about
 * reading the sentence, resolving the columns, converting the units and
 * refusing the ambiguities has already happened by the time `compile` is
 * called.
 */
export interface Compiler<T> {
  readonly dialect: string;
  compile(ir: QueryIr, ctx: CompileCtx): T;
}
