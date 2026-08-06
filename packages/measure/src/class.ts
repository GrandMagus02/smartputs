import type { Input, ValueClass, ValueInstance } from "@smartput/shared";
import { createValueClass } from "@smartput/shared";
import { MEASURE_UNITS, type MeasureUnit } from "./units";

export type { MeasureUnit } from "./units";

type Operand = Input<MeasureUnit> | ValueInstance<MeasureUnit>;

/**
 * A `Measure` instance, narrowed to say that `withDpi` is present. `measure` is
 * the one kind with a dynamic ratio — `px` is `1/dpi` — so it is the one kind
 * the factory gives the method to, and the one whose instances carry a `ctx`
 * worth reading.
 *
 * The overrides only restate return types the base declares more loosely; they
 * add no behaviour. Their point is that `.as("mm").withDpi(300)` typechecks, so
 * a dpi survives a chain rather than being lost at the first conversion.
 */
export interface MeasureInstance extends ValueInstance<MeasureUnit> {
  withDpi(dpi: number): MeasureInstance;
  as(unit: MeasureUnit): MeasureInstance;
  add(other: Operand): MeasureInstance;
  sub(other: Operand): MeasureInstance;
  scale(factor: number): MeasureInstance;
  negate(): MeasureInstance;
}

/**
 * The annotation is what lets an unused kind's class drop from a barrel.
 *
 * `dpi` is per instance: `new Measure(10, "px", { dpi: 144 })`, or
 * `Measure.parse("10px", { ctx: { dpi: 144 } })`, or `.withDpi(144)` on one you
 * already have. It rides along through `as`, `add` and friends, so every
 * conversion off that instance resolves `px` against the same document. An
 * instance created without one is `DEFAULT_DPI`, which is what a `px` means
 * when nobody has said otherwise.
 */
export const Measure = /*#__PURE__*/ createValueClass(
  MEASURE_UNITS,
  "measure",
) as ValueClass<MeasureUnit, MeasureInstance>;
