import type { RatioTable } from "./aliases";
import { Decimal } from "./decimal";

// `RatioTable` is declared in `./aliases.ts` now — see the header there for why
// it and `aliasesFor` had to leave this module — and re-exported from here so
// that `@smartput/kind/from-table` and `@smartput/core/kind/from-table` keep
// naming everything they always named. The type is the shared vocabulary of
// both halves; only the runtime split.
export type { RatioTable } from "./aliases";

/**
 * The engine-side view of a `UnitTable`. `units.ts` is the single source of a
 * kind's ratios and English aliases; this widens the decimal strings to
 * `Decimal` so the descriptor keeps every digit. (Inverting the flat alias map
 * into the per-unit arrays a vocabulary wants used to be this comment's second
 * half, and is `aliasesFor` in `./aliases.ts` — the two halves parted company
 * because only this one needs `Decimal`.)
 *
 * A dynamic ratio has no constant form, so `decimalRatios` refuses it by name
 * rather than coercing a function to NaN. `measure` keeps declaring its own
 * `px` closure in the descriptor and spreads the rest of the table around it.
 */
export function decimalRatios<U extends string>(
  table: RatioTable<U>,
): Record<U, Decimal> {
  const out = {} as Record<U, Decimal>;
  for (const [unit, ratio] of Object.entries(table.ratio) as Array<
    [U, RatioTable<U>["ratio"][U]]
  >) {
    if (typeof ratio === "function") {
      throw new Error(
        `decimalRatios: unit "${unit}" has a dynamic ratio and no constant form. Declare it directly on the kind.`,
      );
    }
    out[unit] = new Decimal(ratio);
  }
  return out;
}
