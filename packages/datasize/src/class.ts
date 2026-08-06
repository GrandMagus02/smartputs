import { createValueClass } from "@smartput/shared";
import { DATASIZE_UNITS } from "./units";

export type { DatasizeUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Datasize = /*#__PURE__*/ createValueClass(DATASIZE_UNITS, "datasize");
