import { createValueClass } from "@smartput/validate";
import { NUMBER_UNITS } from "./units";

export type { NumberUnit } from "./units";

// Shadows the global `Number` identifier within this module only — the
// naming scheme every other kind follows (`Angle`, `Mass`, ...) names the
// class after the capitalized kind id, and "number" capitalizes to exactly
// the one JS builtin's name. Nothing in this file needs the builtin; the
// module-scope const does not touch or redeclare the actual global.
//
// `defaultUnit: "one"` is baked in for the same reason `validate.ts` bakes it
// into every free wrapper: spec §7.1 says a bare "30" is *the* input this kind
// exists for. Without it `Number.parse("30")` threw `missing-unit` while
// `parseNumber("30")` succeeded — the same string, two answers.
// biome-ignore lint/suspicious/noShadowRestrictedNames: intentional, see above
export const Number = /*#__PURE__*/ createValueClass(NUMBER_UNITS, "number", {
  defaults: { defaultUnit: "one" },
});
