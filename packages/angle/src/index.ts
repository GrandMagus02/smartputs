import { Decimal, defineKind } from "@smartput/core";

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
    rad: {
      aliases: ["rad", "radian"],
      symbol: "rad",
      display: { one: "radian", other: "radians" },
      // A full circle is 2pi, and nobody writes an angle in radians much past
      // one revolution.
      typical: [0.1, 7],
    },
    deg: {
      aliases: ["deg", "degree"],
      symbol: "deg",
      display: { one: "degree", other: "degrees" },
      typical: [1, 360],
    },
    grad: {
      aliases: ["grad", "gradian", "gon"],
      symbol: "grad",
      display: { one: "gradian", other: "gradians" },
      typical: [1, 400],
    },
    turn: {
      aliases: ["turn", "rev", "revolution"],
      symbol: "turn",
      display: { one: "turn", other: "turns" },
      typical: [0.1, 10],
    },
  },
});
