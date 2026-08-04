import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { NUMBER_KIND } from "../kind/ratio-ops";

/**
 * Canonical is the plain ratio, so "20%" is 0.2 and needs no special case to
 * behave like a number. The three behaviours spec §8 requires are op
 * signatures, not branches: `+|K|percent` and `-|K|percent` are generated for
 * every ratio kind, `of|percent|K` likewise, and a bare percentage is just
 * this kind's own value.
 *
 * generateRatioOps deliberately excludes "number" from that generation (Task
 * 1's test asserts `keys(number)` has no `+|number|percent`), because number
 * is the one ratio kind percent itself belongs to the generation loop for —
 * generating percent-vs-percent ops, not number-vs-percent ones. So
 * `50 + 20%`, `50 - 20%` and `20% of 50` have no generated signature and
 * percent must declare them itself. The arithmetic mirrors
 * generateRatioOps's generated `+|K|percent` / `-|K|percent` / `of|percent|K`
 * cases exactly (relative to the left operand for +/-, product for of) so
 * the two paths cannot drift.
 */
export const percent = defineKind({
  id: "percent",
  value: { mode: "ratio", canonical: "ratio", units: { "%": 0.01 } },
  lexicon: { "%": { aliases: ["%", "percent", "pct"], symbol: "%" } },
  ops: [
    {
      op: "of",
      left: "percent",
      right: NUMBER_KIND,
      result: NUMBER_KIND,
      apply: (l, r) =>
        Object.freeze({
          kind: NUMBER_KIND,
          canonical: r.canonical.times(l.canonical),
          unit: r.unit,
        }),
    },
    {
      op: "+",
      left: NUMBER_KIND,
      right: "percent",
      result: NUMBER_KIND,
      apply: (l, r) =>
        Object.freeze({
          kind: NUMBER_KIND,
          canonical: l.canonical.times(r.canonical.plus(1)),
          unit: l.unit,
        }),
    },
    {
      op: "-",
      left: NUMBER_KIND,
      right: "percent",
      result: NUMBER_KIND,
      apply: (l, r) =>
        Object.freeze({
          kind: NUMBER_KIND,
          canonical: l.canonical.times(new Decimal(1).minus(r.canonical)),
          unit: l.unit,
        }),
    },
  ],
});
