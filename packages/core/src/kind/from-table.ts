import type { UnitTable } from "@smartput/validate";
import { Decimal } from "../decimal";

/**
 * The engine-side view of a `UnitTable`. `units.ts` is the single source of a
 * kind's ratios and English aliases; this widens the decimal strings to
 * `Decimal` so the descriptor keeps every digit, and inverts the flat alias map
 * into the per-unit arrays a lexicon wants.
 *
 * A dynamic ratio has no constant form, so `decimalRatios` refuses it by name
 * rather than coercing a function to NaN. `measure` keeps declaring its own
 * `px` closure in the descriptor and spreads the rest of the table around it.
 */
export function decimalRatios<U extends string>(table: UnitTable<U>): Record<U, Decimal> {
  const out = {} as Record<U, Decimal>;
  for (const [unit, ratio] of Object.entries(table.ratio) as Array<
    [U, UnitTable<U>["ratio"][U]]
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

/** Every alias pointing at `unit`, in the table's declaration order. */
export function aliasesFor<U extends string>(table: UnitTable<U>, unit: U): string[] {
  return Object.entries(table.alias)
    .filter(([, target]) => target === unit)
    .map(([alias]) => alias);
}
