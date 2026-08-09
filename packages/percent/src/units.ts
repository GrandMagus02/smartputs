import type { UnitTable } from "@smartput/shared";

export type PercentUnit = "%";

/**
 * One unit, ratio 0.01: canonical storage is the plain 0-1 ratio, so `"20%"`
 * is `0.2` canonically and needs no special case to behave like a number
 * (see `index.ts`). `formatPercent` emits `"20%"`, never `"20 percent"`.
 *
 * The alias map covers every spelling the hand-written lexicon used to list
 * (`%`, `percent`, `pct`) plus the English plurals the locale analyzer's
 * suffix stripper (`suffixes: ["s", "es"]`, see `@smartput/core`'s `en`
 * locale) used to fold onto them for free — this flat table does no
 * stripping, so `percents` and `pcts` are spelled out.
 */
export const PERCENT_UNITS: UnitTable<PercentUnit> = {
  canonical: "%",
  ratio: { "%": "0.01" },
  alias: {
    "%": "%",
    percent: "%",
    percents: "%",
    pct: "%",
    pcts: "%",
  },
};
