import { createValueClass } from "@smartput/validate";
import { NUMBER_UNITS } from "./units";

export type { NumberUnit } from "./units";

// Shadows the global `Number` identifier within this module only — the
// naming scheme every other kind follows (`Angle`, `Mass`, ...) names the
// class after the capitalized kind id, and "number" capitalizes to exactly
// the one JS builtin's name. Nothing in this file needs the builtin; the
// module-scope const does not touch or redeclare the actual global.
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentional, see above
export const Number = /*#__PURE__*/ createValueClass(NUMBER_UNITS, "number");
