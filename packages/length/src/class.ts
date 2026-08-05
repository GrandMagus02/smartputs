import { createValueClass } from "@smartput/validate";
import { LENGTH_UNITS } from "./units";

export type { LengthUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Length = /*#__PURE__*/ createValueClass(LENGTH_UNITS, "length");
