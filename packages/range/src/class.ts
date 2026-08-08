import type { Value } from "@smartput/core";
import { type Origin, type ParseOptions, parseSlice } from "./phrases";
import {
  formatSlice,
  type Resolved,
  resolveSlice,
  type Slice,
  sliceItems,
  unwrapSlice,
  wrapSlice,
} from "./slice";

/**
 * A selection of positions, as an object rather than as a pair of loose ints.
 *
 * The engine path answers with a `Value` and needs no class at all; this is for
 * the far more common call, where a launcher has a string a person typed and a
 * list to apply it to, and standing up an engine to get two integers would be
 * absurd. `Range.parse` reaches the same grammar the kind's matcher does — one
 * parser, two doors — with one deliberate difference: the bare "4-5" is a
 * selection here, because there is no subtraction for it to compete with
 * outside the solver.
 *
 * Immutable. `start` and `end` are the **stored** positions: zero-based,
 * inclusive, negative counting back from the end. Nothing here knows how long
 * the list is until `resolve` or `slice` is handed one.
 */
export class Range {
  readonly start: number;
  readonly end: number;

  constructor(start: number, end: number) {
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new TypeError(`Range positions must be integers, got ${start}, ${end}`);
    }
    this.start = start;
    this.end = end;
    Object.freeze(this);
  }

  /**
   * `"first three"`, `"from 6 to 9"`, `"4-5"`, `"(1;5]"` — or null.
   *
   * Null rather than a throw for a string that is not a selection at all,
   * because "is this a range?" is a question a launcher asks of every keystroke
   * and an exception is a poor way to answer no. A string that *is* a selection
   * and is wrong — "9 to 6", "from 0 to 5" — still throws, because there the
   * user meant a range and did not get one.
   */
  static parse(text: string, opts?: ParseOptions): Range | null {
    const slice = parseSlice(text, opts);
    return slice === null ? null : new Range(slice.start, slice.end);
  }

  /** The selection a `range` Value carries. Throws if the Value is not one. */
  static from(value: Value): Range {
    const { start, end } = unwrapSlice(value);
    return new Range(start, end);
  }

  /** The first `count` items, counted from the front. */
  static first(count = 1): Range {
    return new Range(0, count - 1);
  }

  /** The last `count` items, counted from the back. */
  static last(count = 1): Range {
    return new Range(-count, -1);
  }

  /** Every item, at any length. */
  static all(): Range {
    return new Range(0, -1);
  }

  /**
   * The absolute, clamped bounds against a list of `length` items.
   *
   * Clamped rather than checked: "first ten" over three items is the answer
   * "all three", not a mistake, and a launcher that threw there would fail on
   * every short result set.
   */
  resolve(length: number): Resolved {
    return resolveSlice(this, length);
  }

  /** The selected items, in list order. Empty when the selection misses. */
  slice<T>(items: readonly T[]): T[] {
    return sliceItems(items, this);
  }

  /** The selected positions, in list order. */
  indices(length: number): number[] {
    const { start, count } = this.resolve(length);
    return Array.from({ length: count }, (_, i) => start + i);
  }

  /**
   * How many items this selects, or null when that depends on the list.
   *
   * A selection whose ends disagree on sign — `[0, -1]`, "everything" — has no
   * count until a length is supplied, and returning a plausible-looking integer
   * there would be worse than returning nothing.
   */
  get count(): number | null {
    if (this.start < 0 !== this.end < 0) return null;
    return Math.max(0, this.end - this.start + 1);
  }

  /** True when either end counts back from the end of the list. */
  get fromEnd(): boolean {
    return this.start < 0 || this.end < 0;
  }

  equals(other: Range): boolean {
    return this.start === other.start && this.end === other.end;
  }

  /** The `Value` the engine would have produced for this selection. */
  toValue(): Value {
    return wrapSlice(this);
  }

  /** `[0, 2]` — the notation this package documents itself in. */
  toString(): string {
    return formatSlice(this);
  }

  toJSON(): Slice {
    return { start: this.start, end: this.end };
  }
}

export type { Origin, ParseOptions, Resolved, Slice };
