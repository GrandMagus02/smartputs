import { createValueClass } from "@smartput/shared";
import { DURATION_UNITS } from "./units";

export type { DurationUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Duration = /*#__PURE__*/ createValueClass(DURATION_UNITS, "duration");
