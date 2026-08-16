import type { UnitWords } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { DATETIME_KIND } from "../value";

/**
 * The spelled-out English names for a handful of zones, beyond the
 * abbreviations `@smartput/timezone` ships.
 *
 * These were a `LocalePack` until the vocabulary split: a second channel that
 * existed to prove a translation could arrive from outside the kind. It does
 * not need proving any more — the whole file is that channel now, and
 * `@smartput/datetime/locale/uk` is what P3 adds beside it, naming the same
 * zone ids with Cyrillic words and nothing else changing.
 */
const SPELLED_OUT: Record<string, readonly string[]> = {
  UTC: ["universal"],
  "America/New_York": ["manhattan", "brooklyn"],
  "America/Los_Angeles": ["hollywood"],
  "Europe/London": ["england", "britain"],
  "Europe/Paris": ["france"],
  "Europe/Berlin": ["germany"],
  "Europe/Kyiv": ["ukraine"],
  "Asia/Tokyo": ["japan"],
  "Asia/Shanghai": ["china"],
  "Asia/Kolkata": ["india"],
  "Australia/Sydney": ["australia"],
  "Pacific/Auckland": ["nz"],
};

const units: Record<string, UnitWords> = {};
for (const [zone, def] of Object.entries({ ...ZONES, ...OFFSET_ZONES })) {
  units[zone] = {
    // The zone table's own words first, the spelled-out ones after, deduped —
    // `japan` is in both lists, and an alias indexed twice is still one alias.
    aliases: [...new Set([...def.aliases, ...(SPELLED_OUT[zone] ?? [])])],
    symbol: def.symbol,
  };
}

/**
 * English words for the datetime kind's units, which are IANA zone ids.
 *
 * The kind next door names no language at all: after ruling R1 its `units` is
 * a bare array of zone ids, and every word anyone types to reach one of them
 * lives here. That is the same split every ratio kind got — the difference is
 * only that a zone's "unit id" is already a proper noun, so the id and the
 * word look alike.
 *
 * Named by **id string** rather than by importing the kind, so a translation
 * ships from someone who is not the kind's author, and `locale/uk` links
 * neither chrono nor the zone matcher.
 *
 * An offset zone (`+03:00`) carries a symbol and no aliases, deliberately:
 * "gmt+3" lexes as three tokens, so no alias lookup could ever reach it, and
 * `parseOffsetZone` is its only door.
 */
export default defineVocabulary({ locale: "en", kind: DATETIME_KIND, units });
