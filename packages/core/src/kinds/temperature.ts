import { Decimal } from "../decimal";
import { DimensionMismatchError } from "../errors";
import { defineKind } from "../kind/define";
import { NUMBER_KIND } from "../kind/ratio-ops";

// new Decimal(5).div(9), never 5 / 9: the latter is a JS float before Decimal
// sees it, and 212F then lands on 100.000000000000008 instead of 100.
const FIVE_NINTHS = new Decimal(5).div(9);

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
    // `tempdelta` shares temperature's c/f/k aliases (that's what lets "20 C + 5 C"
    // read its right side as a difference), so the solver always has a viable,
    // scalable reading of "C" available via tempdelta. Refusing "20 C * 2" can no
    // longer be expressed by simply not generating a `*` signature — tempdelta's
    // generated one would win instead. These two signatures exist purely to
    // refuse: do not delete them as unused/dead code.
    {
      op: "*",
      left: "temperature",
      right: NUMBER_KIND,
      result: "temperature",
      apply: (l, r): never => {
        throw new DimensionMismatchError("", "*", l.kind, r.kind);
      },
    },
    {
      op: "/",
      left: "temperature",
      right: NUMBER_KIND,
      result: "temperature",
      apply: (l, r): never => {
        throw new DimensionMismatchError("", "/", l.kind, r.kind);
      },
    },
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
