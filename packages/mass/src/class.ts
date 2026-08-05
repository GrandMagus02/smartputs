import { createValueClass } from "@smartput/validate";
import { MASS_UNITS } from "./units";

export type { MassUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Mass = /*#__PURE__*/ createValueClass(MASS_UNITS, "mass");
