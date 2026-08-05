import { createValueClass } from "@smartput/validate";
import { AREA_UNITS } from "./units";

export type { AreaUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Area = /*#__PURE__*/ createValueClass(AREA_UNITS, "area");
