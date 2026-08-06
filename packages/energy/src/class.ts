import { createValueClass } from "@smartput/shared";
import { ENERGY_UNITS } from "./units";

export type { EnergyUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Energy = /*#__PURE__*/ createValueClass(ENERGY_UNITS, "energy");
