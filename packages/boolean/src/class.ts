import { BOOLEAN_KIND, type Value } from "@smartput/core";
import { booleanValue, truthOf } from "./boolean";

/**
 * The comparison result as an object rather than a `Decimal` you have to know
 * how to read.
 *
 * Not built by `createValueClass`, which is `@smartput/shared`'s factory for
 * *ratio* kinds: everything it generates — `to()`, `plus()`, `times()`, a unit
 * parameter — is meaningless here, and a facade whose every inherited method
 * throws is worse than one written by hand. Six lines is the whole class.
 *
 * It exists because `r.value.canonical.isZero()` is the wrong thing to make a
 * caller write. `Bool.of(r.value).value` is the same fact with the encoding
 * spelled out once, here, instead of at every call site.
 */
export class Bool {
  private constructor(readonly value: boolean) {
    Object.freeze(this);
  }

  /**
   * Throws when the `Value` is not a boolean, because a caller reaching for
   * this one has already decided the expression was a comparison. The
   * non-throwing question is `truthOf`, which answers `null`.
   */
  static of(value: Value): Bool {
    const truth = truthOf(value);
    if (truth === null) {
      throw new TypeError(`Expected a ${BOOLEAN_KIND} value, got ${value.kind}`);
    }
    return new Bool(truth);
  }

  static from(value: boolean): Bool {
    return new Bool(value);
  }

  /** The `Value` this wraps, for handing back to the engine. */
  toValue(): Value {
    return booleanValue(this.value);
  }

  toString(): string {
    return this.value ? "true" : "false";
  }

  toJSON(): boolean {
    return this.value;
  }
}
