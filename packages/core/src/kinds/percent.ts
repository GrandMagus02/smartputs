import { Decimal } from "../decimal";
import { defineKind } from "../kind/define";
import { deriveValue, NUMBER_KIND } from "../kind/ratio-ops";

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
 * the two paths cannot drift. Both build their result with `deriveValue`,
 * which is what makes that claim true for `meta` as well as for the
 * arithmetic — these three used to hand-build a frozen Value and silently
 * drop it.
 */
export const percent = defineKind({
  id: "percent",
  // canonical must name one of this kind's own registered units (the
  // registry/facade layer treats it as the default unit — see
  // assertKindContract and Quantity.from's canonicalUnit); "%" is percent's
  // only unit, even though the internal Value.canonical storage is the plain
  // 0-1 ratio described above.
  value: { mode: "ratio", canonical: "%", units: { "%": 0.01 } },
  lexicon: { "%": { aliases: ["%", "percent", "pct"], symbol: "%" } },
  ops: [
    {
      op: "of",
      left: "percent",
      right: NUMBER_KIND,
      result: NUMBER_KIND,
      apply: (l, r) => deriveValue(r, r.canonical.times(l.canonical)),
    },
    {
      op: "+",
      left: NUMBER_KIND,
      right: "percent",
      result: NUMBER_KIND,
      apply: (l, r) => deriveValue(l, l.canonical.times(r.canonical.plus(1))),
    },
    {
      op: "-",
      left: NUMBER_KIND,
      right: "percent",
      result: NUMBER_KIND,
      apply: (l, r) =>
        deriveValue(l, l.canonical.times(new Decimal(1).minus(r.canonical))),
    },
  ],
});
