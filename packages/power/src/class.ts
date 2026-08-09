import { createValueClass } from "@smartput/shared";
import { POWER_UNITS } from "./units";

export type { PowerUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Power = /*#__PURE__*/ createValueClass(POWER_UNITS, "power");
