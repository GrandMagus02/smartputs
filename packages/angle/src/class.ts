import { createValueClass } from "@smartput/validate";
import { ANGLE_UNITS } from "./units";

export type { AngleUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Angle = /*#__PURE__*/ createValueClass(ANGLE_UNITS, "angle");
