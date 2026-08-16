import {
  Decimal,
  decimalRatios,
  defineKind,
  deriveValue,
  NUMBER_KIND,
} from "@smartput/kind";
import { PERCENT_UNITS } from "./units";

export type { PercentUnit } from "./units";
export { PERCENT_UNITS } from "./units";

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
  value: {
    mode: "ratio",
    canonical: PERCENT_UNITS.canonical,
    units: decimalRatios(PERCENT_UNITS),
  },
  // Magnitude band, not language (spec §4): the range people type a percentage
  // in, read only by completion's `scaleFit`. The words that used to sit beside
  // it live in `./locale/en`.
  typical: { "%": [1, 100] },
  ops: [
    {
      op: "of",
      left: "percent",
      right: NUMBER_KIND,
      result: NUMBER_KIND,
      apply: (l, r) => deriveValue(r, r.canonical.times(l.canonical)),
    },
    // `off` is here for exactly the reason `of` above it is: generateRatioOps
    // emits it for every ratio kind except `number`, and the arithmetic is
    // copied from the generated case rather than shared, so the two cannot
    // drift apart in what they do to `meta`.
    {
      op: "off",
      left: "percent",
      right: NUMBER_KIND,
      result: NUMBER_KIND,
      apply: (l, r) =>
        deriveValue(r, r.canonical.times(new Decimal(1).minus(l.canonical))),
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
    // Conversion between a number and a percentage, which generateRatioOps
    // does not reach for the same reason as the three above: it emits `in`
    // only for a kind against itself, so number owns `in|number|number` and
    // percent `in|percent|percent`, and neither of these two keys is claimed
    // by anyone. Because canonical storage on both sides is the same plain
    // 0-1 ratio, there is no arithmetic to do — 0.1 stays 0.1 and only the
    // kind changes, which is what makes "5 / 50 in %" answer 10%.
    //
    // `deriveValue`'s source is the RIGHT operand in both directions: the
    // right is the conversion target, so its kind, unit and meta are what the
    // result must carry. Sourcing from the left would hand back a value
    // labelled with the kind being converted away from.
    {
      op: "in",
      left: NUMBER_KIND,
      right: "percent",
      result: "percent",
      apply: (l, r) => deriveValue(r, l.canonical),
    },
    // The reverse direction has no surface spelling today — number's only
    // unit word is "one", which foldNumerals eats as the numeral before the
    // resolver sees it — but the signature is what makes the pair total, and
    // it costs one entry rather than a rule about which way conversions run.
    {
      op: "in",
      left: "percent",
      right: NUMBER_KIND,
      result: NUMBER_KIND,
      apply: (l, r) => deriveValue(r, l.canonical),
    },
  ],
});
