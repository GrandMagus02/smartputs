import { SmartputError } from "@smartput/core";

/**
 * Every error here extends core's `SmartputError` for the reason core's own
 * `suggest()` documents: a caller distinguishes "this input has no reading"
 * from "the pipeline has a bug" by class, and a query error that were a plain
 * `Error` would be indistinguishable from a `TypeError` thrown out of a
 * consumer's compiler.
 */

/**
 * The schema itself is wrong — a metric naming a column that does not exist, a
 * join edge naming a missing table, two tables claiming one alias.
 *
 * Thrown from the `Schema` constructor and never from a parse, which is the
 * distinction worth keeping: this describes the caller's wiring, exactly as
 * core's `KindConflictError` and `UnknownKindError` do, and it is the one error
 * here that no user input can provoke.
 */
export class SchemaError extends SmartputError {
  constructor(detail: string) {
    super(`Invalid query schema: ${detail}`, "");
    this.name = "SchemaError";
  }
}

/** The clause grammar could not read the input at all. */
export class QueryParseError extends SmartputError {
  constructor(input: string, detail: string, spans?: { start: number; end: number }[]) {
    super(`Cannot read as a query: ${detail}`, input, spans ?? []);
    this.name = "QueryParseError";
  }
}

/**
 * A word that has to name a column, table or metric names none of them.
 *
 * `nearest` carries what the alias index almost matched, which is what turns
 * the message into something a form field can render as "did you mean". It is
 * computed by the linker through core's `nearestWord`, so the repo has one
 * answer to "how near is this" rather than two.
 */
export class UnknownColumnError extends SmartputError {
  readonly word: string;
  readonly nearest: readonly string[];
  constructor(input: string, word: string, nearest: readonly string[]) {
    const hint = nearest.length > 0 ? ` Did you mean ${nearest.join(", ")}?` : "";
    super(`No column, table or metric named "${word}".${hint}`, input);
    this.name = "UnknownColumnError";
    this.word = word;
    this.nearest = nearest;
  }
}

/**
 * Two readings of the input scored the same, and neither is the answer.
 *
 * This is the query layer's `AmbiguityError`, and it exists for the same
 * reason: `orders in march` is a genuine tie between two years, and guessing is
 * the one thing the caller cannot recover from. `QueryEngine.suggest()` returns
 * the readings instead of throwing, exactly as core's `suggest()` does.
 */
export class AmbiguousQueryError extends SmartputError {
  readonly readings: readonly string[];
  constructor(input: string, detail: string, readings: readonly string[]) {
    super(`${detail}: ${readings.join(" | ")}`, input);
    this.name = "AmbiguousQueryError";
    this.readings = readings;
  }
}

/**
 * Ruling R5. Two join paths of the same length between the same pair of tables,
 * or none at all.
 *
 * A shortest-path tiebreak was the alternative and is the defect this class
 * exists to prevent: a schema with `orders.billing_address_id` and
 * `orders.shipping_address_id` has two one-hop paths from `orders` to
 * `addresses`, and picking either silently answers a different question than
 * the one asked. The paths travel on the error so a UI can ask.
 */
export class AmbiguousJoinError extends SmartputError {
  readonly from: string;
  readonly to: string;
  readonly paths: readonly string[];
  constructor(input: string, from: string, to: string, paths: readonly string[]) {
    const detail =
      paths.length === 0
        ? `No declared join path from "${from}" to "${to}".`
        : `Several join paths from "${from}" to "${to}": ${paths.join(" | ")}. Name the one you mean in the schema.`;
    super(detail, input);
    this.name = "AmbiguousJoinError";
    this.from = from;
    this.to = to;
    this.paths = paths;
  }
}

/**
 * Ruling R7. The input was read, and names something this package refuses to
 * express.
 *
 * `construct` is stable and machine-readable — a host branches on it to decide
 * whether to hand the same string to a language model — while the message is
 * free to be reworded. That branch is the entire reason the refusal is a
 * distinct class rather than a parse failure: "I did not understand" and "I
 * understood and will not answer" call for different fallbacks.
 */
export class UnsupportedQueryError extends SmartputError {
  readonly construct: string;
  constructor(input: string, construct: string, detail: string) {
    super(`${construct} is not supported: ${detail}`, input);
    this.name = "UnsupportedQueryError";
    this.construct = construct;
  }
}
