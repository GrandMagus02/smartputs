import { createValueClass } from "@smartput/validate";
import { SPEED_UNITS } from "./units";

export type { SpeedUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Speed = /*#__PURE__*/ createValueClass(SPEED_UNITS, "speed");
