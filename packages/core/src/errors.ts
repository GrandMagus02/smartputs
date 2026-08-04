import type { KindId, ResultCandidate, Span } from "./types";

export class SmartputError extends Error {
  readonly input: string;
  readonly spans: Span[];

  constructor(message: string, input: string, spans: Span[] = []) {
    super(message);
    this.name = new.target.name;
    this.input = input;
    this.spans = spans;
  }
}

export class UnitParseError extends SmartputError {
  readonly kind: KindId | undefined;
  constructor(input: string, kind?: KindId) {
    super(`Cannot parse ${JSON.stringify(input)} as a quantity`, input);
    this.kind = kind;
  }
}

export class AmbiguityError extends SmartputError {
  readonly candidates: ResultCandidate[];
  constructor(input: string, candidates: ResultCandidate[], spans: Span[] = []) {
    const list = candidates.map((c) => `${c.kind}:${c.unit}`).join(", ");
    super(`${JSON.stringify(input)} is ambiguous between ${list}`, input, spans);
    this.candidates = candidates;
  }
}

export class NoCandidateError extends SmartputError {
  readonly token: string;
  readonly nearest: string[];
  constructor(input: string, token: string, nearest: string[], spans: Span[] = []) {
    const hint = nearest.length > 0 ? `. Did you mean: ${nearest.join(", ")}?` : "";
    super(`Unknown unit ${JSON.stringify(token)}${hint}`, input, spans);
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
    this.left = left;
    this.right = right;
    this.op = op;
  }
}

export class TooAmbiguousError extends SmartputError {
  readonly count: number;
  constructor(input: string, count: number, max: number) {
    super(`Too many interpretations (${count} > ${max})`, input);
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
    this.pack = pack;
    this.kind = kind;
    this.unit = unit;
  }
}

export class DivideByZeroError extends SmartputError {
  constructor(input: string) {
    super("Division by zero", input);
  }
}
