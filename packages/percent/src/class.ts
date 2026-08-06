import { createValueClass } from "@smartput/shared";
import { PERCENT_UNITS } from "./units";

export type { PercentUnit } from "./units";

export const Percent = /*#__PURE__*/ createValueClass(PERCENT_UNITS, "percent");
