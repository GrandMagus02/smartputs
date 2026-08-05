import { defineLocalePack, type Lexicon } from "@smartput/core";
import { DATETIME_KIND } from "../value";

/**
 * English words for the registered zones, beyond the abbreviations the kind
 * itself ships.
 *
 * Vocabulary lives with the kind that defines it (spec §4.6), and a pack rather
 * than a bigger `ZONES` table because that is the seam third parties extend:
 * `smartput-locale-uk-zones` contributes through this same channel, and using
 * it here is what proves the channel works.
 */
const datetimeLexicon: Lexicon = {
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

export default defineLocalePack({
  locale: "en",
  contributes: { [DATETIME_KIND]: datetimeLexicon },
});
