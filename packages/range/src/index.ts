import type { Kind } from "@smartput/core";
import { index } from "./index-kind";
import { range } from "./range";

export { Range } from "./class";
export {
  createIndex,
  DEFAULT_INDEX_WEIGHT,
  INDEX_KIND,
  INDEX_UNIT,
  type IndexOptions,
  index,
} from "./index-kind";
export {
  ANCHORS,
  type Anchor,
  type Claim,
  type ClaimOptions,
  claimAt,
  type Origin,
  type ParseOptions,
  parseSlice,
  toPosition,
} from "./phrases";
export {
  createRange,
  DEFAULT_DASH_WEIGHT,
  DEFAULT_PHRASE_WEIGHT,
  type RangeOptions,
  range,
} from "./range";
export {
  assertOrdered,
  BackwardsRangeError,
  formatSlice,
  RANGE_KIND,
  RANGE_UNIT,
  type Resolved,
  resolveSlice,
  type Slice,
  sliceItems,
  unwrapSlice,
  wrapSlice,
  ZeroIndexError,
} from "./slice";

/**
 * Both kinds, because neither is useful without the other.
 *
 * `range`'s two signatures name `index` by string, and registry pass 4 does not
 * check that a named operand kind is registered — a `range` on its own is not an
 * error, it is a kind that silently claims written phrases and loses "4-5" to
 * subtraction. `index` on its own is worse: a reading of every bare integer with
 * nothing that consumes it. Spreading this array is what a consumer wants, the
 * way `BUILTIN_KINDS` is.
 */
export const RANGE_KINDS: Kind[] = [index, range];
