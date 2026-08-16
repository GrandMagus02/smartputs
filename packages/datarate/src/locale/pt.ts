import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Portuguese words for the datarate units.
 *
 * The bare `pt` tag, matching the language in `@smartput/core/locale/pt`: this
 * project's ruling is that `pt` means the Brazilian default, which is also what
 * the platform does (`Intl.NumberFormat("pt")` groups with "." and marks the
 * decimal with ","). Nothing below is regional — "megabit" is the same word in
 * São Paulo and in Lisbon — and the one line that *is* Brazilian is marked where
 * it appears ("megas", the way a Brazilian says the speed of their connection).
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `datarate` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table or the four bridge
 * signatures, and it is the seam `composeLocale` closes. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it — a Portuguese speaker types
 * "100 mbps" as readily as "100 megabits" — and the Portuguese spellings are
 * appended to it.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and which
 * Portuguese restates for the same two reasons Spanish does. The written
 * Portuguese rate is "megabits por segundo": three words, and `parse/lex.ts`
 * builds a unit word out of letters plus trailing digits, so a space ends the
 * token whatever else is true. Worse, the middle word is already this language's
 * `times` keyword — `@smartput/core/locale/pt` lists "por" under `times`, and
 * says at length why it had to — so a `forms` table here would not merely be
 * prose the lexer cannot reach: its own second token would be read as
 * multiplication. Absent forms keep the renderer on the symbol, so a Portuguese
 * datarate prints "100Mbps", the same tight shape English prints "100mbps" and
 * Ukrainian "100Мбіт" through.
 *
 * **Symbols, and the slash that cannot be one.** The typographically correct
 * Portuguese symbols are "b/s", "kb/s", "Mb/s", "Gb/s" and "Tb/s", and none of
 * them can be used: "/" lexes as division, so "100Mb/s" would reach the resolver
 * as `datarate ÷ duration`, a signature no kind declares and none should —
 * dividing a rate by a time is not a rate. The escape that `speed` and `energy`
 * sometimes have (making the arithmetic *true*, as "km/h" does through
 * `length ÷ duration`) is closed here because `datasize`'s canonical is the
 * **byte** while this kind's numerator is the bit, off by the factor of 8 that
 * `index.ts` writes out explicitly. `uk.ts` works through the same argument at
 * length.
 *
 * What Portuguese gets instead of the slash is the abbreviation a Brazilian ISP
 * already prints on its bills: "Mbps" — one letter run, so one token. The casing
 * is SI's rather than English's flat lowercase (kilo lowercase, mega and up
 * capital), because that is how Portuguese writes prefixes and because the alias
 * index folds case before lookup, so "Mbps" and the derived alias "mbps" are one
 * key and every symbol reads back by construction.
 *
 * **Aliases.** The Portuguese nouns are listed in both numbers rather than left
 * to the language's `suffixStripper`: the stripper is what a vocabulary falls
 * back *from*, not a substitute for one, and a form recovered only through its
 * `-2` penalty reads back by accident. They are regular here — "megabit" →
 * "megabits", the borrowed -s that Portuguese takes on a borrowed consonant-final
 * noun rather than the native -es it would take on a native one ("mar" →
 * "mares") — so the two spellings cost one line each, and neither ever meets the
 * rewriting classes `pluralReplacer` exists for.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "bit", "bits"],
      symbol: "bps",
    },
    kbps: {
      aliases: [...alias("kbps"), "kbit", "quilobit", "quilobits", "kilobit", "kilobits"],
      symbol: "kbps",
    },
    mbps: {
      // "mega" alone is the colloquial Brazilian noun for a megabit per second —
      // "minha internet é de cem megas" is how the rate is spoken, and it is the
      // number an ISP advertises — so it is listed in both numbers. Recognition
      // is many-to-one (I6); generation stays the single symbol below.
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
