import { createValueClass } from "@smartput/shared";
import { DATARATE_UNITS } from "./units";

export type { DatarateUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Datarate = /*#__PURE__*/ createValueClass(DATARATE_UNITS, "datarate");
