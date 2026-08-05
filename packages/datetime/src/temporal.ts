import { Temporal } from "temporal-polyfill";

/**
 * The one import site of `temporal-polyfill` in this package.
 *
 * Everything else imports Temporal from here, so swapping the polyfill for the
 * native global once runtimes ship it is a one-line change rather than a sweep.
 */
export { Temporal };

/**
 * The fixed clock every test in this repo uses (spec §10), as epoch
 * milliseconds — the unit `EngineOptions.now` speaks.
 */
export const TEST_NOW = 1_768_478_400_000;
export const TEST_ZONE = "UTC";
