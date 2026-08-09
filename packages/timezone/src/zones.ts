/**
 * One time zone, in the shape a kind registers a unit in: the words people type
 * for it, and the symbol a formatter prints.
 */
export interface ZoneDef {
  aliases: string[];
  symbol: string;
}

/**
 * The named time zones this package ships, with the words people type for them.
 *
 * Aliases are single words: `@smartput/core`'s alias index is keyed by one
 * segmented word, so "new york" cannot be one — "nyc" can. A caller who needs
 * more composes another `Vocabulary` for the `datetime` kind, or registers an
 * `extendsKind` patch; nothing here is a closed list.
 */
export const ZONES: Record<string, ZoneDef> = {
  UTC: { aliases: ["utc", "gmt", "z", "zulu"], symbol: "UTC" },
  "America/New_York": { aliases: ["nyc", "est", "edt"], symbol: "ET" },
  "America/Chicago": { aliases: ["cst", "cdt", "chicago"], symbol: "CT" },
  "America/Denver": { aliases: ["mst", "mdt", "denver"], symbol: "MT" },
  "America/Los_Angeles": { aliases: ["pst", "pdt", "la"], symbol: "PT" },
  "America/Sao_Paulo": { aliases: ["brt"], symbol: "BRT" },
  "Europe/London": { aliases: ["london", "bst"], symbol: "London" },
  "Europe/Paris": { aliases: ["paris", "cet", "cest"], symbol: "CET" },
  "Europe/Berlin": { aliases: ["berlin"], symbol: "Berlin" },
  "Europe/Kyiv": { aliases: ["kyiv", "kiev", "eet"], symbol: "Kyiv" },
  "Europe/Moscow": { aliases: ["moscow", "msk"], symbol: "MSK" },
  "Asia/Dubai": { aliases: ["dubai", "gst"], symbol: "Dubai" },
  "Asia/Kolkata": { aliases: ["kolkata", "delhi", "mumbai"], symbol: "IST" },
  "Asia/Shanghai": { aliases: ["shanghai", "beijing"], symbol: "CST" },
  "Asia/Tokyo": { aliases: ["tokyo", "jst", "japan"], symbol: "JST" },
  "Asia/Singapore": { aliases: ["singapore", "sgt"], symbol: "SGT" },
  "Australia/Sydney": { aliases: ["sydney", "aest", "aedt"], symbol: "Sydney" },
  "Pacific/Auckland": { aliases: ["auckland", "nzst"], symbol: "NZ" },
};
