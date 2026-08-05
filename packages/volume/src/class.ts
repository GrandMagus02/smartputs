import { createValueClass } from "@smartput/validate";
import { VOLUME_UNITS } from "./units";

export type { VolumeUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Volume = /*#__PURE__*/ createValueClass(VOLUME_UNITS, "volume");
