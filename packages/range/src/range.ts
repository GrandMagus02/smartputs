import { defineKind, type Kind, type LiteralMatcher, type Value } from "@smartput/core";
import { INDEX_KIND } from "./index-kind";
import {
  type Anchor,
  type ClaimOptions,
  claimAt,
  type Origin,
  toPosition,
} from "./phrases";
import { assertOrdered, formatSlice, RANGE_KIND, RANGE_UNIT, wrapSlice } from "./slice";

/**
 * Paid back by each of the two signatures, and the number the package turns on.
 *
 * "4-5" arrives with both operands carrying a `number` reading at core's
 * `NUMBER_FALLBACK_WEIGHT` (-0.5) and an `index` reading at
 * `DEFAULT_INDEX_WEIGHT` (-20), so the two paths score:
 *
 * ```
 * - | number | number -> number    -0.5 + -0.5                    =  -1
 * - | index  | index  -> range      -20 +  -20 + 30 + 20          =  10
 * ```
 *
 * The +30 is `contextBonus`, and — unlike in `@smartput/time-range`'s identical
 * contest — it does **not** cancel: core withholds it from operands that agree
 * on `number`, so only the range path collects it. That asymmetry is why the
 * reading penalty is -20 rather than -5; the arithmetic is set out in full
 * beside it in `index-kind.ts`.
 *
 * 20 wins by 11 and stays under `TYPO_PENALTY` (15), so a selection can never
 * overturn a corrected reading.
 *
 * The cost is stated plainly because it is real: an engine with these kinds
 * registered reads "4 - 5" as a selection too, not only the tight "4-5". Core's
 * token stream carries no adjacency, so no weight can tell the two spellings
 * apart, and `dashWeight: 0` is the setting for someone who wants their
 * subtraction back.
 */
export const DEFAULT_DASH_WEIGHT = 20;

/**
 * Charged to every phrase claim, and zero by default because nothing competes.
 *
 * "first three", "[1,5]" and "from 6 to 9" are multi-token claims, which the
 * fold takes destructively — there is no surviving sibling for a weight to beat.
 * The dial exists for an embedder who adds a `phrases` entry that *does* collide
 * with a reading of their own.
 */
export const DEFAULT_PHRASE_WEIGHT = 0;

export interface RangeOptions {
  /**
   * Weight on `- | index | index` and `in | index | index`. 0 hands "4-5" back
   * to subtraction and leaves every other form exactly as it was — including
   * "6 to 9", which needs no refund because nothing competes for it: there is
   * no `in | number | number`, so the selection is the only reading either way.
   */
  dashWeight?: number;
  /** Weight on every phrase claim. */
  phraseWeight?: number;
  /**
   * Where a written position 1 lands. `1` — the default — counts items the way
   * a person does. `0` takes written positions as indices already.
   */
  origin?: Origin;
  /** Replaces the default `first` / `last` / `top` / `bottom` table. */
  phrases?: Readonly<Record<string, Anchor>>;
}

/**
 * Every selection an op signature produces goes through here, so the ordering
 * check is unskippable. `input` is threaded in only to name the expression in
 * the error: `BackwardsRangeError` reports what the user typed, not what the
 * ops saw.
 */
function build(input: string, from: Value, to: Value, origin: Origin): Value {
  const slice = {
    start: toPosition(from.canonical.toNumber(), origin, input),
    end: toPosition(to.canonical.toNumber(), origin, input),
  };
  assertOrdered(input, slice);
  return wrapSlice(slice);
}

/**
 * The written forms, which have no two-operand shape for a signature to receive:
 * "first three" names a selection without naming either of its ends, and
 * "[1,5]" names both but wraps them in brackets the parser would read as
 * grouping.
 *
 * Claiming a multi-token run is safe for all three grammars in a way it is not
 * for the bare dash. Nothing under a phrase is worth keeping — "first" and
 * "three" have no joint reading the fold would be destroying — and an interval's
 * brackets have no meaning here other than the one this matcher gives them.
 * That is exactly why the dash form is an op signature instead; see
 * `DEFAULT_DASH_WEIGHT`.
 */
const sliceLiteral = (opts: RangeOptions, weight: number): LiteralMatcher => {
  // Built once rather than per call, and spread rather than assigned so that an
  // option the caller omitted stays omitted — `exactOptionalPropertyTypes` is on
  // repo-wide, and `{ origin: undefined }` is not the same thing as `{}`.
  const claimOpts: ClaimOptions = {
    ...(opts.origin === undefined ? {} : { origin: opts.origin }),
    ...(opts.phrases === undefined ? {} : { phrases: opts.phrases }),
    dash: false,
  };
  return (input, offset) => {
    const claim = claimAt(input, offset, claimOpts);
    if (claim === null) return null;
    const value = wrapSlice(claim.slice);
    return {
      kind: RANGE_KIND,
      unit: RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: claim.length,
      weight,
    };
  };
};

/**
 * A selection of positions in a list — "first three", "from 6 to 9", "4-5",
 * "(1;5]".
 *
 * Opaque, because a selection is not a scalar: its canonical is the start
 * position purely so that ordering and comparison work without the engine
 * knowing what a selection is, which is the same trick every range kind in the
 * repo plays.
 *
 * Register `index` alongside it. Both signatures name that kind, and a signature
 * whose operand kind is not registered is silently unreachable rather than an
 * error — see `RANGE_KINDS`.
 */
export function createRange(opts: RangeOptions = {}): Kind {
  const origin = opts.origin ?? 1;
  const weight = opts.dashWeight ?? DEFAULT_DASH_WEIGHT;
  const span = {
    left: INDEX_KIND,
    right: INDEX_KIND,
    result: RANGE_KIND,
    weight,
    apply: (l: Value, r: Value, ctx: { input?: string }) =>
      build(ctx.input ?? "", l, r, origin),
  };
  return defineKind({
    id: RANGE_KIND,
    value: { mode: "opaque", units: [RANGE_UNIT] },
    literals: [sliceLiteral(opts, opts.phraseWeight ?? DEFAULT_PHRASE_WEIGHT)],
    ops: [
      // The same operation written two ways. `to` and `as` are surface words
      // core's `keywordFor` folds onto `in`, so "6 to 9" arrives as a convert
      // node and "4-5" as a binary one. Only the binary one is contested — the
      // `in` signature carries the same weight for symmetry, and would win at
      // any value.
      { op: "-", ...span },
      { op: "in", ...span },
    ],
    format: (value) =>
      formatSlice({
        start: Number(value.meta?.start ?? 0),
        end: Number(value.meta?.end ?? 0),
      }),
  });
}

/** The kind as a consumer normally wants it: positions counted from one. */
export const range: Kind = createRange();
