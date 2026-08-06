import { Decimal } from "../decimal";

/**
 * The shape these helpers read off a `@smartput/shared` `UnitTable`, spelled
 * structurally rather than imported.
 *
 * Spec §4 says core must not depend on `@smartput/shared`, and §13 says core
 * ships one runtime dependency. `import type` compiles away, but it survives
 * into the emitted `.d.ts` — and a published `.d.ts` naming a package that is
 * not in core's manifest is that dependency in everything but the install line.
 * Every real `UnitTable` satisfies this, so `decimalRatios(ANGLE_UNITS)` still
 * typechecks at every call site; the dependency runs kind -> core and
 * kind -> validate, never core -> validate.
 */
export interface RatioTable<U extends string> {
  readonly canonical: U;
  readonly ratio: Readonly<
    Record<U, string | ((ctx: { readonly dpi?: number }) => number)>
  >;
  /** Lowercase alias -> unit key, flat, exactly as the micro parser reads it. */
  readonly alias: Readonly<Record<string, U>>;
}

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

/** Every alias pointing at `unit`, in the table's declaration order. */
export function aliasesFor<U extends string>(table: RatioTable<U>, unit: U): string[] {
  return Object.entries(table.alias)
    .filter(([, target]) => target === unit)
    .map(([alias]) => alias);
}
