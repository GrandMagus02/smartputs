/**
 * GeoNames' feature taxonomy, and the small vocabulary this package exposes in
 * its place.
 *
 * GeoNames sorts every one of its twelve million toponyms into nine **feature
 * classes** and some 660 **feature codes**. The classes are single letters and
 * the codes are three-letter refinements of them — `H` is hydrography and `STM`
 * is a stream, `A` is administrative and `PCLI` is an independent country. A
 * query wants to say "rivers" and a UI wants to render "River"; neither wants to
 * know that the letter is `H`.
 *
 * So `GeoKind` is the vocabulary and this module is the only place the letters
 * appear. Two directions are needed and both are here: a query names kinds and
 * they become the `featureClass` parameters GeoNames takes, and a row arrives
 * carrying `fcl`/`fcode` and has to be labelled back. Neither is guessable from
 * the other — `postal` is a kind with no class at all, because postal codes live
 * in a different index (see `GeoNames.postal`), and `country` and `admin` share
 * the class `A` and are told apart only by the code.
 *
 * The rejected alternative was to pass GeoNames' letters through untranslated.
 * It reads as an abstraction leak, but the real objection is that it makes the
 * interface un-implementable by a second provider: Photon and Nominatim answer
 * in OSM's `class`/`type` pairs, and a consumer who wrote `featureClass: "H"`
 * against this package would have written GeoNames into their call site.
 */

/**
 * What a caller can ask for and what a hit is labelled with.
 *
 * Eleven values, one per GeoNames class plus the two splits the classes do not
 * make: `country`/`admin` out of `A`, and `postal`, which is its own index
 * rather than a class.
 */
export type GeoKind =
  /** A sovereign state or dependent territory. GeoNames class A, codes PCL*. */
  | "country"
  /** A state, oblast, prefecture, county, municipality. Class A, codes ADM*. */
  | "admin"
  /** A city, town, village or hamlet. Class P. */
  | "city"
  /** A postal code. No feature class — a separate GeoNames index. */
  | "postal"
  /** Rivers, streams, lakes, seas, bays, glaciers. Class H. */
  | "water"
  /** Mountains, hills, ridges, capes, islands, valleys. Class T. */
  | "terrain"
  /** Parks, reserves, regions, zones, military bases. Class L. */
  | "area"
  /** Roads, railroads, tunnels, bridges. Class R. */
  | "road"
  /** Buildings, farms, churches, airports, mines. Class S. */
  | "spot"
  /** Seamounts, trenches, ridges below the waterline. Class U. */
  | "undersea"
  /** Forests, heaths, groves, vineyards. Class V. */
  | "vegetation";

/** Every `GeoKind`, in the order this file documents them. */
export const GEO_KINDS: readonly GeoKind[] = [
  "country",
  "admin",
  "city",
  "postal",
  "water",
  "terrain",
  "area",
  "road",
  "spot",
  "undersea",
  "vegetation",
];

/**
 * The one-letter classes, as GeoNames writes them.
 *
 * `A` appears twice on purpose: it is the class both `country` and `admin` ask
 * for, and the code is what separates them afterwards. A query for either
 * therefore fetches both and `kindOf` sorts the answers — GeoNames has no
 * parameter that says "countries but not their provinces", and asking for
 * `featureCode=PCLI` five times over would spend five times the credits to
 * express one filter this package can apply for free on the way back.
 */
const CLASS_OF: Readonly<Record<GeoKind, string | null>> = {
  country: "A",
  admin: "A",
  city: "P",
  // Not a class. `postal` is routed to `postalCodeLookupJSON` instead, because a
  // code is not a toponym and `searchJSON` with `q=44657` finds nothing at all.
  postal: null,
  water: "H",
  terrain: "T",
  area: "L",
  road: "R",
  spot: "S",
  undersea: "U",
  vegetation: "V",
};

/**
 * The class-A codes that name a country rather than a division.
 *
 * GeoNames' own list, in full rather than by prefix match: `PCL` is a political
 * entity, `PCLD` a dependent one, `PCLF` a freely associated state, `PCLI` an
 * independent one, `PCLIX` a section of one, `PCLS` a semi-independent one, and
 * `TERR` a territory. A `startsWith("PCL")` test was the shorter spelling and it
 * silently swallows `PCLH`, a *historical* political entity — the USSR, Yugoslavia
 * — which is a country that does not exist and must not be offered as one.
 */
const COUNTRY_CODES: ReadonlySet<string> = new Set([
  "PCL",
  "PCLD",
  "PCLF",
  "PCLI",
  "PCLIX",
  "PCLS",
  "TERR",
]);

/** Class letter to kind, for the classes that map to exactly one. */
const KIND_OF_CLASS: Readonly<Record<string, GeoKind>> = {
  P: "city",
  H: "water",
  T: "terrain",
  L: "area",
  R: "road",
  S: "spot",
  U: "undersea",
  V: "vegetation",
};

/**
 * The `featureClass` values a set of kinds implies, deduplicated.
 *
 * Empty means "every class", which is also what GeoNames does with no
 * `featureClass` parameter at all — so a caller who names only `postal`, or who
 * names no kinds, gets the unfiltered search rather than a search for nothing.
 * The distinction that matters is made by the caller, not here: `Geo.search`
 * routes a `postal`-only query to the postal index and never asks this.
 */
export function featureClasses(kinds: readonly GeoKind[] | undefined): string[] {
  if (kinds === undefined || kinds.length === 0) return [];
  const out: string[] = [];
  for (const kind of kinds) {
    const cls = CLASS_OF[kind];
    if (cls !== null && !out.includes(cls)) out.push(cls);
  }
  return out;
}

/** True when the kind list asks for postal codes — the separate index. */
export function wantsPostal(kinds: readonly GeoKind[] | undefined): boolean {
  return kinds === undefined || kinds.length === 0 || kinds.includes("postal");
}

/** True when the kind list asks for anything the toponym search can answer. */
export function wantsToponyms(kinds: readonly GeoKind[] | undefined): boolean {
  return kinds === undefined || kinds.length === 0 || kinds.some((k) => k !== "postal");
}

/**
 * Label a row by the class and code it arrived with.
 *
 * Falls back to `spot` — GeoNames' own catch-all class, "spot, building, farm" —
 * rather than to a nullable return or a twelfth `"unknown"` kind. A row that
 * reached this function is a real toponym with a real name; refusing to label it
 * would drop it from a result set it belongs in, and a new class letter (there
 * have been none in twenty years) is better rendered as a generic place than
 * discarded.
 */
export function kindOf(featureClass: string, featureCode: string): GeoKind {
  if (featureClass === "A") return COUNTRY_CODES.has(featureCode) ? "country" : "admin";
  return KIND_OF_CLASS[featureClass] ?? "spot";
}
