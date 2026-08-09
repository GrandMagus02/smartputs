import { Decimal, SmartputError, type Value } from "@smartput/core";

export const RANGE_KIND = "range";

/**
 * The kind's one unit, and a label rather than a scale — the same reading
 * `date-range`'s `span` gets. A selection is not a point on a ratio line: it is
 * two positions, and neither of them is a quantity of anything.
 *
 * It ships no vocabulary, for the reason every other opaque range unit gives:
 * an alias here would be a second kind for the solver to weigh every time
 * someone writes "3 slices". Hyphenated rather than the bare "slice" it used to
 * be because ruling R2 indexes a unit under its own id when no language has
 * spoken for its kind — see `@smartput/date`'s `DATE_UNIT` for the argument in
 * full.
 */
export const RANGE_UNIT = "range-slice";

/**
 * Two positions into a list nobody here has seen.
 *
 * **Zero-based and inclusive at both ends**, which is the one sentence that
 * makes every other rule in this package follow: "first three" is `[0, 2]`, not
 * `[0, 3]`. A half-open end would read better against `Array.prototype.slice`
 * and worse against everything a person says — "from 6 to 9" means item nine is
 * in, and a stored 9 that displays as 9 and excludes item 9 is a trap the
 * caller falls into once per codebase.
 *
 * A **negative** position counts back from the end, `-1` being the last item —
 * the indexing rule from `Array.prototype.at`, and the only way to say "the last
 * three" without knowing how long the list is. That is the whole reason the two
 * ends are stored unresolved rather than as absolute offsets: the phrase is
 * parsed once, at a moment when the list may not exist yet, and `resolve` is
 * what needs the length.
 *
 * The two ends may mix signs. `{ start: 0, end: -1 }` is "everything", and it
 * is not orderable until a length is supplied — see `assertOrdered`.
 */
export interface Slice {
  start: number;
  end: number;
}

/** A `Slice` measured against a real list. Absolute, zero-based, inclusive. */
export interface Resolved {
  start: number;
  end: number;
  /** Items selected. Zero when the slice falls entirely outside the list. */
  count: number;
}

/**
 * A range whose end is before its start — "9 to 6", `[5, 2]`.
 *
 * Only raised when both ends share a sign, because that is the only case where
 * the comparison is decidable without a list: `{ start: 0, end: -1 }` is
 * "everything" and `{ start: -1, end: 0 }` is empty for every length, and
 * telling them apart is `resolve`'s job, not this one's. An undecidable pair is
 * therefore *not* an error here; it resolves to `count: 0` later, which is a
 * fact about the list rather than about the phrase.
 *
 * Both ends go in the message for the reason `range-core`'s `InvertedRangeError`
 * gives: being told the range is backwards without being told which end came
 * out where leaves the user re-deriving it.
 */
export class BackwardsRangeError extends SmartputError {
  readonly start: number;
  readonly end: number;
  constructor(input: string, start: number, end: number) {
    super(`Range ends before it starts: ${start} to ${end}`, input);
    this.name = "BackwardsRangeError";
    this.start = start;
    this.end = end;
  }
}

/**
 * Position 0 in a phrase whose positions are counted from 1.
 *
 * "from 0 to 5" is not a range starting at the first item; under `origin: 1` it
 * would translate to a stored `-1`, which means the *last* item, and a phrase
 * that quietly selects the opposite end of the list is worse than a phrase that
 * fails. An embedder who wants zero to mean the first item says so with
 * `createRange({ origin: 0 })`, and then this error cannot fire at all.
 */
export class ZeroIndexError extends SmartputError {
  constructor(input: string) {
    super("There is no position 0: positions are counted from 1", input);
    this.name = "ZeroIndexError";
  }
}

/** Throws unless the two ends are in order, when that is decidable at all. */
export function assertOrdered(input: string, slice: Slice): void {
  const sameSign = slice.start < 0 === slice.end < 0;
  if (sameSign && slice.end < slice.start) {
    throw new BackwardsRangeError(input, slice.start, slice.end);
  }
}

/**
 * `canonical` is the **start**, so ordering and comparison work without the
 * engine knowing what a selection is — the trick every range kind in the repo
 * plays, and `datetime` before them.
 *
 * The ends ride on `meta` as plain numbers rather than as a `Slice` object,
 * because a `Result` has to survive `JSON.stringify` for `@smartput/http` and
 * core's `deepFreeze` walks whatever it is handed. Positions are small integers,
 * so unlike an epoch-nanosecond count there is nothing here a `number` loses.
 */
export function wrapSlice(slice: Slice): Value {
  return Object.freeze({
    kind: RANGE_KIND,
    unit: RANGE_UNIT,
    canonical: new Decimal(slice.start),
    meta: Object.freeze({ start: slice.start, end: slice.end }),
  });
}

/**
 * The two keys every selection stores, checked rather than asserted.
 *
 * A `Value` reaching this formatter is not necessarily a selection — the engine
 * hands formatters whatever won — so this is a real guard, and it reports the
 * kind because that is what identifies the mistake.
 */
export function unwrapSlice(value: Value): Slice {
  const { start, end } = (value.meta ?? {}) as Partial<Slice>;
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new TypeError(`range value is missing start/end: ${value.kind}`);
  }
  return { start: start as number, end: end as number };
}

/**
 * The two positions against a list of `length` items: absolute, zero-based,
 * inclusive, and clamped into the list.
 *
 * Clamping rather than throwing is deliberate. "first ten" over a list of three
 * is not a mistake a user made — it is the answer "all three of them", and a
 * launcher that threw there would fail on every short result set. Out of range
 * in the other direction ("from 20 to 30" over three items) clamps to an empty
 * selection, reported as `count: 0` with the bounds left where they landed.
 */
export function resolveSlice(slice: Slice, length: number): Resolved {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError(`length must be a non-negative integer, got ${length}`);
  }
  const absolute = (position: number) => (position < 0 ? length + position : position);
  const start = Math.max(0, Math.min(absolute(slice.start), length));
  const end = Math.min(length - 1, Math.max(absolute(slice.end), -1));
  return { start, end, count: Math.max(0, end - start + 1) };
}

/** The selected items, in list order. Empty when the selection misses. */
export function sliceItems<T>(items: readonly T[], slice: Slice): T[] {
  const { start, count } = resolveSlice(slice, items.length);
  return count === 0 ? [] : items.slice(start, start + count);
}

/**
 * `[0, 2]` — the notation this package's own documentation uses, and the one
 * the request that specified it was written in.
 *
 * Built by hand rather than through `formatNumber`, for the reason every range
 * formatter in the repo gives: the golden corpus asserts formatted output
 * verbatim, and a locale's grouping separator has no business inside a pair of
 * array indices.
 */
export function formatSlice(slice: Slice): string {
  return `[${slice.start}, ${slice.end}]`;
}
