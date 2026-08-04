import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { deriveValue } from "../kind/ratio-ops";

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
  // Only the two genuine signatures live here. The refusals that keep
  // `tempdelta` from silently capturing "20 C * 2", "20 C + 20%" and friends
  // are generated in ratio-ops.ts from the very op set an ordinary kind would
  // get, so they cannot drift out of sync with that generation and the next
  // affine kind (M4's datetime) inherits them for free.
  ops: [
    {
      op: "+",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: "the second operand was read as a temperature difference",
      apply: (l, r) => deriveValue(l, l.canonical.plus(r.canonical)),
    },
    {
      op: "-",
      left: "temperature",
      right: "tempdelta",
      result: "temperature",
      assumption: "the second operand was read as a temperature difference",
      apply: (l, r) => deriveValue(l, l.canonical.minus(r.canonical)),
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
