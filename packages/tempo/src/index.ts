import type { EvalCtx, Value } from "@smartput/kind";
import {
  Decimal,
  DivideByZeroError,
  decimalRatios,
  defineKind,
  deriveValue,
} from "@smartput/kind";
import { TEMPO_UNITS } from "./units";

export type { TempoUnit } from "./units";
export { TEMPO_UNITS } from "./units";

/**
 * Seconds per minute — the whole of the bridge below. It is not a unit
 * conversion: both canonicals (bpm here, the second in `duration`) are already
 * fixed, so 60 is what turns one into the other's reciprocal and nothing else.
 */
const SECONDS_PER_MINUTE = new Decimal(60);

/**
 * Both directions of the bridge below, because they are one reading taken from
 * opposite sides: the period of a tempo and the tempo of a period are the same
 * 60/x once each operand is in its own canonical.
 *
 * `deriveValue(r, …)` and not a frozen object literal, and `r` and not `l`: the
 * generated `in | id | id` in core's `ratio-ops.ts` is
 * `deriveValue(r, l.canonical)`, so the result kind, the result unit and the
 * `meta` all come from the target side while only the arithmetic comes from the
 * left. Hand-building the Value is what dropped `meta` in `speed`; here it
 * would drop the target unit too, and every conversion would land in bpm.
 *
 * Zero is refused rather than answered. decimal.js returns Infinity for x/0, so
 * the untouched version formatted "0 bpm in ms" as "Infinity milliseconds" —
 * while `120 bpm / 0` already raises `DivideByZeroError`, because
 * `eval/evaluate.ts` guards binary `/` and does not guard `in`. One division by
 * zero reported two ways depending on which syntax was reached for is the
 * inconsistency worth spending an import on.
 */
const reciprocal = (l: Value, r: Value, ctx: EvalCtx): Value => {
  if (l.canonical.isZero()) throw new DivideByZeroError(ctx.input ?? "");
  return deriveValue(r, SECONDS_PER_MINUTE.div(l.canonical));
};

/** Canonical beats per minute. The reciprocal of a duration, not a scaling of one. */
export const tempo = defineKind({
  id: "tempo",
  value: {
    mode: "ratio",
    canonical: TEMPO_UNITS.canonical,
    units: decimalRatios(TEMPO_UNITS),
  },
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  // It stayed on the kind when the words left for `./locale/en` because a
  // dance-floor tempo is 40–220 beats a minute in every language.
  typical: {
    bpm: [40, 220],
    hz: [0.5, 20],
  },
  ops: [
    // The bridge to `duration` is reciprocal — 120 bpm is a half-second beat,
    // 60 bpm is a whole one — and `value.units` can only express a ratio, so
    // there is no unit row that makes this a conversion. `in` is the seam that
    // fits: `evaluate`'s `convert` case hands `apply` a stand-in right operand
    // carrying the target *unit* and no magnitude, which is exactly what a
    // reciprocal needs — somewhere to land, not something to scale by.
    // `@smartput/distance` uses the same shape for `in | place | place`.
    //
    // Naming `duration` costs no dependency: registry pass 4 keys the op table
    // without checking that `left` and `right` are registered, so with
    // `@smartput/duration` absent these entries are unreachable rather than a
    // build error. Both are declared here rather than one on each side because
    // that same pass refuses a second claimant of a key, and `duration` has no
    // reason to know this kind exists.
    { op: "in", left: "tempo", right: "duration", result: "duration", apply: reciprocal },
    { op: "in", left: "duration", right: "tempo", result: "tempo", apply: reciprocal },
  ],
});
