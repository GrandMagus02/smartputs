import { createValueClass } from "@smartput/validate";
import { MEASURE_UNITS } from "./units";

export type { MeasureUnit } from "./units";

/**
 * The annotation is what lets an unused kind's class drop from a barrel.
 *
 * Note that a `Measure` instance has no dpi of its own: `px` resolves against
 * the empty context, so it is always `1/DEFAULT_DPI` here. A document that
 * renders at another dpi wants the free functions with an explicit `ctx`, or
 * the engine's `kindMeta`.
 */
export const Measure = /*#__PURE__*/ createValueClass(MEASURE_UNITS, "measure");
