import { Decimal } from "../decimal";
import { DimensionMismatchError } from "../errors";
import { defineKind } from "../kind/define";
import { NUMBER_KIND } from "../kind/ratio-ops";
import type { OpSignature } from "../types";

// new Decimal(5).div(9), never 5 / 9: the latter is a JS float before Decimal
// sees it, and 212F then lands on 100.000000000000008 instead of 100.
const FIVE_NINTHS = new Decimal(5).div(9);

// `tempdelta` shares temperature's c/f/k aliases (that's what lets "20 C + 5 C"
// read its right side as a difference), so the solver always has a viable,
// scalable reading of "C" available via tempdelta. Refusing "20 C * 2",
// "2 * 20 C" and "20 C / 2" can no longer be expressed by simply not
// generating a signature — tempdelta's generated one would win instead, and
// the solver would never even consider the temperature reading. These
// signatures exist purely to refuse, carrying the real operands and the
// source expression so the resulting error is as informative as any other
// DimensionMismatchError in this codebase: do not delete them as dead code.
const refuse = (
  op: OpSignature["op"],
  left: OpSignature["left"],
  right: OpSignature["right"],
): OpSignature => ({
  op,
  left,
  right,
  result: "temperature",
  apply: (l, r, ctx): never => {
    throw new DimensionMismatchError(ctx.input ?? "", op, l.kind, r.kind);
  },
});

/** An absolute reading. Offsets apply; sums and products do not. */
export const temperature = defineKind({
  id: "temperature",
  value: {
    mode: "ratio",
    canonical: "c",
    affine: { deltaKind: "tempdelta" },
    units: {
      c: 1,
      f: { ratio: FIVE_NINTHS, offset: -32 },
      k: { ratio: 1, offset: -273.15 },
    },
  },
  lexicon: {
    c: { aliases: ["c", "celsius", "centigrade"], symbol: "°C" },
    f: { aliases: ["f", "fahrenheit"], symbol: "°F" },
    k: { aliases: ["k", "kelvin"], symbol: "K" },
  },
  ops: [
    {
      op: "+",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: "the second operand was read as a temperature difference",
      apply: (l, r) =>
        Object.freeze({
          kind: l.kind,
          canonical: l.canonical.plus(r.canonical),
          unit: l.unit,
        }),
    },
    {
      op: "-",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: "the second operand was read as a temperature difference",
      apply: (l, r) =>
        Object.freeze({
          kind: l.kind,
          canonical: l.canonical.minus(r.canonical),
          unit: l.unit,
        }),
    },
    // See the `refuse` comment above: absence can't forbid these because
    // tempdelta's generated signatures would silently win in their place.
    // `ratio-ops.ts` generates ordinary kinds' scaling in both operand orders
    // (`K * number` and `number * K`) but never `number / K`, so only these
    // three combinations need an explicit refusal here — "2 / 20 C" already
    // has no viable assignment anywhere and raises DimensionMismatchError
    // straight from the solver.
    refuse("*", "temperature", NUMBER_KIND),
    refuse("*", NUMBER_KIND, "temperature"),
    refuse("/", "temperature", NUMBER_KIND),
  ],
});

/**
 * A difference between readings. Same ratios as `temperature`, no offsets —
 * that difference is the whole point: 5F as a reading is -15C, as a difference
 * it is 2.78C.
 *
 * The prior sits well below `temperature` so a bare "5 C" reads as a reading.
 * It is low enough that "20 C + 5 C" prefers temperature+delta over
 * delta+delta, which the solver's same-kind context bonus would otherwise win.
 */
export const tempdelta = defineKind({
  id: "tempdelta",
  prior: -40,
  value: {
    mode: "ratio",
    canonical: "c",
    units: { c: 1, f: FIVE_NINTHS, k: 1 },
  },
  lexicon: {
    c: { aliases: ["c", "celsius", "centigrade"], symbol: "°C" },
    f: { aliases: ["f", "fahrenheit"], symbol: "°F" },
    k: { aliases: ["k", "kelvin"], symbol: "K" },
  },
});
