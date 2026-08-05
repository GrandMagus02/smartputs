import type { KindId, ResultCandidate, Span } from "./types";

export class SmartputError extends Error {
  readonly input: string;
  readonly spans: Span[];

  constructor(message: string, input: string, spans: Span[] = []) {
    super(message);
    // Literal, never `new.target.name`: a minifier renames the class, and
    // `error.name` is a string consumers display and branch on.
    this.name = "SmartputError";
    this.input = input;
    this.spans = spans;
  }
}

export class UnitParseError extends SmartputError {
  readonly kind: KindId | undefined;
  constructor(input: string, kind?: KindId) {
    super(`Cannot parse ${JSON.stringify(input)} as a quantity`, input);
    this.name = "UnitParseError";
    this.kind = kind;
  }
}

export class AmbiguityError extends SmartputError {
  readonly candidates: ResultCandidate[];
  constructor(input: string, candidates: ResultCandidate[], spans: Span[] = []) {
    const list = candidates.map((c) => `${c.kind}:${c.unit}`).join(", ");
    super(`${JSON.stringify(input)} is ambiguous between ${list}`, input, spans);
    this.name = "AmbiguityError";
    this.candidates = candidates;
  }
}

export class NoCandidateError extends SmartputError {
  readonly token: string;
  readonly nearest: string[];
  constructor(input: string, token: string, nearest: string[], spans: Span[] = []) {
    const hint = nearest.length > 0 ? `. Did you mean: ${nearest.join(", ")}?` : "";
    super(`Unknown unit ${JSON.stringify(token)}${hint}`, input, spans);
    this.name = "NoCandidateError";
    this.token = token;
    this.nearest = nearest;
  }
}

export class DimensionMismatchError extends SmartputError {
  readonly left: KindId;
  readonly right: KindId;
  readonly op: string;
  constructor(input: string, op: string, left: KindId, right: KindId) {
    super(`Cannot apply ${op} to ${left} and ${right}`, input);
    this.name = "DimensionMismatchError";
    this.left = left;
    this.right = right;
    this.op = op;
  }
}

export class TooAmbiguousError extends SmartputError {
  readonly count: number;
  constructor(input: string, count: number, max: number) {
    super(`Too many interpretations (${count} > ${max})`, input);
    this.name = "TooAmbiguousError";
    this.count = count;
  }
}

/**
 * These last two are configuration errors rather than input errors, but they
 * still extend SmartputError: the facade throws KindConflictError at runtime
 * (an affine kind whose delta kind has no facade), so a consumer's
 * `instanceof SmartputError` guard has to catch them. There is no source
 * expression to report, so `input` carries the offending id instead.
 */
export class KindConflictError extends SmartputError {
  readonly kind: KindId;
  constructor(id: string, detail: string) {
    super(`Kind ${JSON.stringify(id)} conflicts: ${detail}`, id);
    this.name = "KindConflictError";
    this.kind = id;
  }
}

export class UnknownKindError extends SmartputError {
  readonly pack: string;
  readonly kind: KindId;
  readonly unit: string | undefined;
  constructor(pack: string, kind: KindId, unit?: string) {
    const where = unit === undefined ? "" : `, unit ${JSON.stringify(unit)}`;
    super(
      `Locale pack ${JSON.stringify(pack)} contributes to unregistered kind ${JSON.stringify(kind)}${where}`,
      pack,
    );
    this.name = "UnknownKindError";
    this.pack = pack;
    this.kind = kind;
    this.unit = unit;
  }
}

export class DivideByZeroError extends SmartputError {
  constructor(input: string) {
    super("Division by zero", input);
    this.name = "DivideByZeroError";
  }
}

/**
 * A rate provider could not produce a usable snapshot: the request failed, or
 * the payload carried no date or no quotes. Like the two configuration errors
 * above, it still extends SmartputError — `instanceof SmartputError` is the
 * discriminator this codebase's own engine branches on, so an error that does
 * not extend it is invisible to every consumer that follows the convention.
 * There is no source expression, so `input` carries the provider id.
 */
export class RateProviderError extends SmartputError {
  readonly provider: string;
  constructor(provider: string, detail: string) {
    super(`Rate provider ${JSON.stringify(provider)} failed: ${detail}`, provider);
    this.name = "RateProviderError";
    this.provider = provider;
  }
}

/** Rates were asked for before any snapshot had been fetched. */
export class RatesNotReadyError extends SmartputError {
  constructor(detail: string) {
    super(`No rates available: ${detail}`, "");
    this.name = "RatesNotReadyError";
  }
}

export class MissingRateError extends SmartputError {
  readonly from: string;
  readonly to: string;
  readonly asOf: string;
  constructor(input: string, from: string, to: string, asOf: string) {
    super(`No rate for ${from}->${to} in the snapshot as of ${asOf}`, input);
    this.name = "MissingRateError";
    this.from = from;
    this.to = to;
    this.asOf = asOf;
  }
}
