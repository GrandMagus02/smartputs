import type { ErrCode } from "./types";

/**
 * Thrown by class methods. Free functions return `Err` instead — two algebras,
 * each idiomatic for its caller.
 *
 * Deliberately not a subclass of core's `SmartputError`: importing core here
 * would pull `decimal.js` into a 600-byte budget. Same `name`/`code`/`input`
 * shape, no dependency. Do not "fix" this by importing core.
 */
export class ValidationError extends Error {
  readonly code: ErrCode;
  readonly input: string;

  constructor(code: ErrCode, input: string) {
    super(`${code}: ${JSON.stringify(input)}`);
    // A literal, never `new.target.name`: a minifier renames the class.
    this.name = "ValidationError";
    this.code = code;
    this.input = input;
  }
}
