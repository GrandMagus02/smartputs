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

// The two registration errors are raised from buildRegistry(), before any input
// exists, so `input` is "". They still extend SmartputError: engine.ts branches
// on `instanceof SmartputError` to separate "this input has no interpretation"
// from "a bug in the pipeline", and an error outside the hierarchy would be
// rethrown as a crash the moment registration stops being boot-only.
export class KindConflictError extends SmartputError {
  constructor(id: string, detail: string) {
    super(`Kind ${JSON.stringify(id)} conflicts: ${detail}`, "");
    this.name = "KindConflictError";
  }
}

export class UnknownKindError extends SmartputError {
  readonly pack: string;
  readonly kind: KindId;
  constructor(pack: string, kind: KindId) {
    super(
      `Locale pack ${JSON.stringify(pack)} contributes to unregistered kind ${JSON.stringify(kind)}`,
      "",
    );
    this.name = "UnknownKindError";
    this.pack = pack;
    this.kind = kind;
  }
}

export class DivideByZeroError extends SmartputError {
  constructor(input: string) {
    super("Division by zero", input);
    this.name = "DivideByZeroError";
  }
}
