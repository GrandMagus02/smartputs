import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";

// A literal rather than a computed arctangent: decimal.js's trigonometric
// precision depends on its own config, and this value must not drift with it.
// 30 significant digits, well past the configured 28.
const PI = new Decimal("3.14159265358979323846264338328");

export const angle = defineKind({
  id: "angle",
  value: {
    mode: "ratio",
    canonical: "rad",
    units: {
      rad: 1,
      deg: PI.div(180),
      grad: PI.div(200),
      turn: PI.times(2),
    },
  },
  lexicon: {
    rad: { aliases: ["rad", "radian"], symbol: "rad" },
    deg: { aliases: ["deg", "degree"], symbol: "deg" },
    grad: { aliases: ["grad", "gradian", "gon"], symbol: "grad" },
    turn: { aliases: ["turn", "rev", "revolution"], symbol: "turn" },
  },
});
