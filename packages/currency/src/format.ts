import { Decimal } from "@smartput/core";
import { minorUnitsOf, symbolOf } from "./currencies";

/**
 * How an amount is written in a currency: the minor-unit scale, the symbol, and
 * where the sign goes. All three are facts about the currency and none of them
 * is a fact about a rate, which is why they live here and not beside the kind
 * that needs a snapshot to exist.
 *
 * `@smartput/rate`'s `money` format hook is this function plus one line — the
 * guard-digit trim, which stays there because it is repairing round-trip noise
 * from having gone through a rate twice, and a currency that was never
 * converted has none.
 *
 * This is the one module in the package that reaches `Decimal`, and core's
 * `decimal.ts` configures precision as a module-load side effect — so a bundler
 * cannot shake it out of anything that names it. That is why the two table
 * lookups it uses live in `currencies.ts` and why `./validate` re-exports those
 * and not this: a field that only validates should not link 35 KB of arbitrary
 * precision to find out that "30 usd" is thirty dollars.
 */

/** What renders the digits once the amount has been rounded to its scale. */
export type NumberFormatter = (
  amount: Decimal,
  opts: { precision: number; minFractionDigits: number },
) => string;

/**
 * Plain digits at the requested scale — no grouping and a `.` separator.
 *
 * The default only because a caller with no engine has to get *something*
 * readable. Grouping and the decimal symbol are the locale's, the engine's
 * `formatNumber` is where they live, and `@smartput/rate` passes that in rather
 * than falling back to this.
 */
const plainDigits: NumberFormatter = (amount, opts) =>
  amount.toFixed(opts.minFractionDigits);

export interface FormatAmountOptions {
  /** Default `ROUND_HALF_EVEN`, the same default the engine applies. */
  readonly rounding?: Decimal.Rounding;
  /** Default `plainDigits`. The engine passes its locale-aware formatter. */
  readonly formatNumber?: NumberFormatter;
}

/**
 * `-$10.00`, `¥1200`, `€0.05`.
 *
 * Rounded to the currency's minor unit first, so the mode decides the cent
 * rather than a digit nobody will see. Two steps and not one: `toFixed` applies
 * the mode at the minor-unit scale, but a `Decimal` has no notion of a trailing
 * zero — `new Decimal("30.00")` is 30 again — so `minFractionDigits` on the way
 * out is what restores the `.00`, using the formatter's own decimal symbol
 * rather than a hand-rolled one.
 *
 * The sign sits outside the symbol: every locale convention writes `-$10.00`
 * and none writes `$-10.00`. `isZero` guards the case where rounding a small
 * negative to the minor unit lands on zero, since `-$0.00` would be worse than
 * what it replaces.
 */
export function formatAmount(
  amount: Decimal,
  code: string,
  opts: FormatAmountOptions = {},
): string {
  const minorUnits = minorUnitsOf(code);
  const rounding = opts.rounding ?? Decimal.ROUND_HALF_EVEN;
  const rounded = new Decimal(amount.toFixed(minorUnits, rounding));
  const sign = rounded.isNegative() && !rounded.isZero() ? "-" : "";
  const digits = (opts.formatNumber ?? plainDigits)(rounded.abs(), {
    precision: 34,
    minFractionDigits: minorUnits,
  });
  return `${sign}${symbolOf(code)}${digits}`;
}
