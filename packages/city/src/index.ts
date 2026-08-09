/**
 * `@smartput/city` — the T1 tier, spec §3.
 *
 * A package of its own so that the cost of cities is paid by naming them.
 * `@smartput/country` exports a factory precisely so this package can be the
 * only thing that mentions `data/cities.ts`:
 *
 *     import { definePlace } from "@smartput/country";
 *     import { ADMIN1, CITIES } from "@smartput/city";
 *     const kind = definePlace({ cities: CITIES, admin1: ADMIN1 });
 *
 * Data and no code. Exporting a ready-made `cityPlace` Kind from here would be
 * the shorter usage, but it would also decide `admin1` for the caller, give the
 * two packages a kind with the same id that a bundler must keep apart, and turn
 * the type-only edge `@smartput/country` has on this package into a real one —
 * and the choice of which tables to load is exactly what the factory exists to
 * hand back to the consumer.
 *
 * The row types are also reachable at `@smartput/city/types`, which is the
 * subpath `@smartput/country` imports: a signature naming `CityRow` must not
 * drag six thousand cities into a graph that only wanted countries.
 */
export { ADMIN1 } from "./data/admin1";
export { CITIES } from "./data/cities";
export type { Admin1Row, CityRow } from "./types";
// `RESERVED_WORDS` lives in `@smartput/country`, beside the matcher that reads
// it, and is deliberately not re-exported here. It is the generator's refusal
// list, already applied to every alias in CITIES, and a consumer who could see
// it would have no operation to perform with it — publishing it beside the data
// would only invite a second, drifting filter at match time.
