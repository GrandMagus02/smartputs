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

/** The expression parsed, but the requested operation does not apply to it. */
export class MathSolveError extends MathError {
  readonly variable: string;
  constructor(input: string, variable: string, detail: string) {
    super(`Cannot solve ${JSON.stringify(input)} for ${variable}: ${detail}`, input);
    this.name = "MathSolveError";
    this.variable = variable;
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
