import { PostalFormats } from "@smartput/zip";
import { COUNTRIES } from "./data/countries";

/**
 * `@smartput/zip`'s lookup, bound to the shipped table.
 *
 * ```ts
 * POSTAL_FORMATS.for("GB")?.normalize("sw1a1aa"); // "SW1A 1AA"
 * POSTAL_FORMATS.for("AQ");                       // null — no postal system
 * ```
 *
 * The zip package ships no gazetteer on purpose — the place kind names its
 * literal matcher, so the dependency cannot run the other way — which leaves
 * "the format of GB" a question only a package holding a table can answer. This
 * module is one line and exists to be that package.
 *
 * A module constant rather than a lazy getter: the index is 504 map entries over
 * rows already in memory, and the matcher behind each format is still built on
 * first use.
 */
export const POSTAL_FORMATS: PostalFormats = new PostalFormats(COUNTRIES);
