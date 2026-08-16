import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Spanish words for the datarate units.
 *
 * The bare `es` tag, matching the language in `@smartput/core/locale/es`: it is
 * CLDR's default content for Spanish, which is Spain's, and a regional variant
 * would be a `Language` with an id of its own rather than a flag on this table.
 * Nothing below is regional anyway — "megabit" is the same word from Madrid to
 * Monterrey, and the only spelling that varies at all is the one this file
 * refuses (see `hp` in `@smartput/power/locale/es` for the case where it does).
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `datarate`
 * by **id string** rather than importing the kind: that is what lets this file
 * be imported without linking the ratio table or the four bridge signatures,
 * and it is the seam `composeLocale` closes. `aliases` derives the Latin set
 * from `units.ts` rather than retyping it — a Spanish speaker types "100 mbps"
 * as readily as "100 megabits" — and the Spanish spellings are appended to it.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and the one
 * Spanish states most bluntly of the three languages here. The written Spanish
 * rate is "megabits por segundo": three words, and the middle one is already
 * this language's `times` keyword ("por"), so a `forms` table would not merely
 * be prose the lexer cannot reach — its own second token would be read as
 * multiplication. `parse/lex.ts` builds a unit word out of letters plus
 * trailing digits, so a space ends the token regardless. Absent forms keep the
 * renderer on the symbol, so a Spanish datarate prints "100Mbps" — the same
 * tight shape English prints "100mbps" and Ukrainian "100Мбіт" through.
 *
 * **Symbols, and the slash that cannot be one.** The typographically correct
 * Spanish symbols are "b/s", "kb/s", "Mb/s", "Gb/s" and "Tb/s", and none of
 * them can be used: "/" lexes as division, so "100Mb/s" would reach the
 * resolver as `datarate ÷ duration`, a signature no kind declares and none
 * should — dividing a rate by a time is not a rate. `energy` and `datarate`'s
 * Ukrainian file both work through the same argument at length; the escape
 * those two kinds sometimes have (making the arithmetic true, as "кВт·год"
 * does through `* | power | duration`) is closed here because `datasize`'s
 * canonical is the **byte** and this kind's numerator is the bit, off by the
 * factor of 8 that `index.ts` writes out explicitly.
 *
 * What Spanish gets instead of the slash is the one abbreviation it already
 * shares with English: "Mbps" is what a Spanish ISP prints on a bill and what a
 * Spanish speaker says aloud ("cien megas"), and it is a single letter run, so
 * it lexes as one token. The casing is SI's rather than English's flat
 * lowercase — kilo is lowercase "k", mega and up are capital — because that is
 * how Spanish writes prefixes and because the alias index folds case before
 * lookup, so "Mbps" and the derived alias "mbps" are one key and the symbol
 * reads back by construction.
 *
 * **Aliases.** The Spanish nouns are listed in both numbers rather than left to
 * the language's `suffixStripper`: the stripper is what a vocabulary falls back
 * *from*, not a substitute for one, and a form recovered only through its `-2`
 * penalty reads back by accident. They happen to be regular here ("megabit" →
 * "megabits", the -s plural after a consonant that Spanish has borrowed along
 * with the word itself, rather than the native "megabites" nobody writes), so
 * the two spellings cost one line each.
 */
export default defineVocabulary({
  locale: "es",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "bit", "bits"],
      symbol: "bps",
    },
    kbps: {
      aliases: [...alias("kbps"), "kbit", "kilobit", "kilobits"],
      symbol: "kbps",
    },
    mbps: {
      // "mega" alone is the colloquial Spanish noun for a megabit per second —
      // "tengo cien megas" is how the rate is spoken — and it is listed in both
      // numbers because recognition is many-to-one (I6) while generation stays
      // the single symbol below.
      aliases: [...alias("mbps"), "mbit", "megabit", "megabits", "mega", "megas"],
      symbol: "Mbps",
    },
    gbps: {
      aliases: [...alias("gbps"), "gbit", "gigabit", "gigabits", "giga", "gigas"],
      symbol: "Gbps",
    },
    tbps: {
      aliases: [...alias("tbps"), "tbit", "terabit", "terabits"],
      symbol: "Tbps",
    },
  },
});
