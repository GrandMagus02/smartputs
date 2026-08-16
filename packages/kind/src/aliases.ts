// The half of the unit-table view that needs no arithmetic: the shape a table
// has, and the one helper that reads words out of it.
//
// This lived in `./from-table.ts` beside `decimalRatios` until 2026-08-16,
// because both were written the same afternoon and both take a `RatioTable`.
// Sharing a module was never more than that coincidence, and it had a price
// nobody had measured: `decimalRatios` widens ratio strings to `Decimal`, so
// the module imports decimal.js, so *every* file that named `aliasesFor`
// linked a 33 KB arithmetic engine. Every locale file in every kind package
// names `aliasesFor` — that is what a locale file is for, turning a table's
// aliases into a language's words — which made ~320 published entries carry
// decimal.js to say that "kilometre" means `km`. Splitting the module is the
// whole fix; the two functions never called each other.
//
// Keep it that way. Nothing in this file may import anything that reaches
// `./decimal`, or the 33 KB comes straight back and `length/locale/en` in
// `scripts/check-size.ts` is the row that will say so.

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

/** Every alias pointing at `unit`, in the table's declaration order. */
export function aliasesFor<U extends string>(table: RatioTable<U>, unit: U): string[] {
  return Object.entries(table.alias)
    .filter(([, target]) => target === unit)
    .map(([alias]) => alias);
}
