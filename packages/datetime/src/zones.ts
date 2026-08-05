/**
 * The time zones this package registers as `datetime` units, with the words
 * people type for them.
 *
 * Aliases are single words: the alias index is keyed by one segmented word, so
 * "new york" cannot be one — "nyc" can. A caller who needs more registers a
 * `LocalePack` (spec §4.6) or an `extendsKind` patch; nothing here is a closed
 * list.
 */
export const ZONES: Record<string, { aliases: string[]; symbol: string }> = {
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
