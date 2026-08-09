import { SmartputError } from "@smartput/core";

/**
 * A range whose end is not after its start.
 *
 * Endpoints resolve literally — there is no rolling forward to the next
 * occurrence. A rule that rescued "until 20:00" at 21:00 by moving to tomorrow
 * would have to rescue "until yesterday" too, and then no input is ever wrong.
 *
 * `time-range` never raises this: a clock has no ordering across midnight, so
 * "20:00 - 06:00" is a wrapping span rather than a mistake.
 *
 * Both endpoints go in the message because "tomorrow is after now" is the fact
 * the user needs; being told the range is backwards without being told which
 * end came out where leaves them re-deriving it.
 */
export class InvertedRangeError extends SmartputError {
  readonly start: string;
  readonly end: string;
  /**
   * `input` is passed through to `SmartputError` rather than redeclared as a
   * parameter property: the base class already owns that field, and shadowing
   * it here would leave `error.input` set by whichever assignment ran last.
   */
  constructor(input: string, start: string, end: string) {
    super(`Range ends before it starts: ${start} to ${end}`, input);
    this.name = "InvertedRangeError";
    this.start = start;
    this.end = end;
  }
}
