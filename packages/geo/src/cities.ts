/**
 * `@smartput/geo/cities` — the T1 tier, spec §3.
 *
 * A separate entry point so that the cost of cities is paid by naming them. The
 * main entry point exports a factory precisely so this module can be the only
 * thing in the package that mentions `data/cities.ts`:
 *
 *     import { definePlace } from "@smartput/geo";
 *     import { CITIES, ADMIN1 } from "@smartput/geo/cities";
 *     const kind = definePlace({ cities: CITIES, admin1: ADMIN1 });
 *
 * Data and no code. Exporting a ready-made `cityPlace` Kind from here would be
 * the shorter usage, but it would also decide `admin1` for the caller and give
 * the package two kinds with the same id that a bundler must keep apart — and
 * the choice of which tables to load is exactly what the factory exists to hand
 * back to the consumer.
 */
export { ADMIN1 } from "./data/admin1";
export { CITIES } from "./data/cities";
export type { Admin1Row, CityRow } from "./types";
// `RESERVED_WORDS` is deliberately not re-exported. It is the generator's
// refusal list, already applied to every alias in CITIES, and a consumer who
// could see it would have no operation to perform with it — publishing it here
// would only invite a second, drifting filter at match time.
