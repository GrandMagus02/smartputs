import { decimalRatios, defineKind } from "@smartput/core";
import { POWER_UNITS } from "./units";

export type { PowerUnit } from "./units";
export { POWER_UNITS } from "./units";

/**
 * Canonical watt. No `ops` block: a plain ratio kind already gets `in`, `+`,
 * `-`, number scaling and percent from `generateRatioOps`, and the one bridge
 * power takes part in — power x duration = energy — is declared by
 * `@smartput/energy`, the derived kind. Declaring it on both sides would be
 * two kinds claiming one signature, which `createEngine` rejects outright
 * (`KindConflictError`), so the derived kind owns it and this one stays plain.
 */
export const power = defineKind({
  id: "power",
  value: {
    mode: "ratio",
    canonical: POWER_UNITS.canonical,
    units: decimalRatios(POWER_UNITS),
  },
  // Physics, not language (ruling R3): the magnitude band people actually type
  // each unit in, inclusive at both ends, read only by completion's `scaleFit`.
  typical: {
    w: [1, 1000],
    kw: [1, 1000],
    mw: [1, 1000],
    gw: [0.1, 100],
    hp: [1, 1000],
  },
});
