import { SmartputError } from "@smartput/core";

/**
 * Every error this package throws extends core's SmartputError. `instanceof
 * SmartputError` is the discriminator the rest of the repo branches on, so an
 * error that does not extend it is invisible to consumers that follow the
 * convention — including the docs playground, which renders anything else as an
 * unhandled crash rather than as feedback about the expression.
 */
export class MathError extends SmartputError {
  constructor(message: string, input: string) {
    super(message, input);
    this.name = "MathError";
  }
}

/** The LaTeX could not be read as an expression. `detail` holds the reasons. */
export class MathParseError extends MathError {
  readonly detail: string[];
  constructor(input: string, detail: string[]) {
    super(`Cannot parse ${JSON.stringify(input)} as math: ${detail.join("; ")}`, input);
    this.name = "MathParseError";
    this.detail = detail;
  }
}

/**
 * A spoken expression could not be read. Separate from MathParseError because
 * the two fail at different distances from the user: MathParseError is about
 * notation that a compute engine rejected, this one is about a word a person
 * said, and `word` is the part of the sentence a UI can underline.
 */
export class WordParseError extends MathError {
  /** The word the reading stopped at, or null when the sentence ran out. */
  readonly word: string | null;
  constructor(input: string, detail: string, word: string | null = null) {
    super(`Cannot read ${JSON.stringify(input)} as math: ${detail}`, input);
    this.name = "WordParseError";
    this.word = word;
  }
}

/** The expression parsed, but the requested operation does not apply to it. */
export class MathSolveError extends MathError {
  readonly variable: string;
  constructor(input: string, variable: string, detail: string) {
    super(`Cannot solve ${JSON.stringify(input)} for ${variable}: ${detail}`, input);
    this.name = "MathSolveError";
    this.variable = variable;
  }
}

/** A matrix operation was asked for on something that is not a matrix. */
export class NotAMatrixError extends MathError {
  constructor(input: string) {
    super(`${JSON.stringify(input)} is not a matrix`, input);
    this.name = "NotAMatrixError";
  }
}

/** A symbol was left without a value where a number was required. */
export class UnboundSymbolError extends MathError {
  readonly symbols: string[];
  constructor(input: string, symbols: string[]) {
    super(
      `${JSON.stringify(input)} still contains unbound ${
        symbols.length === 1 ? "symbol" : "symbols"
      } ${symbols.join(", ")}`,
      input,
    );
    this.name = "UnboundSymbolError";
    this.symbols = symbols;
  }
}
