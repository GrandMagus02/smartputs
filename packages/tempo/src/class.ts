import { createValueClass } from "@smartput/shared";
import { TEMPO_UNITS } from "./units";

export type { TempoUnit } from "./units";

/** The annotation is what lets an unused kind's class drop from a barrel. */
export const Tempo = /*#__PURE__*/ createValueClass(TEMPO_UNITS, "tempo");
