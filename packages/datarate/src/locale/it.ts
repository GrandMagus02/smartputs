import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Italian words for the datarate units.
 *
 * The bare `it` tag, matching the language in `@smartput/core/locale/it`: CLDR's
 * default content for Italian, which is Italy's — group ".", decimal ",".
 * Nothing in this table is regional; Italian technical vocabulary for computing
 * is the same in Milan, Lugano and Bolzano.
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `datarate` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table or the four bridge
 * signatures, and it is the seam `composeLocale` closes. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it — an Italian speaker types
 * "100 mbps" as readily as anyone — and the Italian spellings are appended to it.
 *
 * **The Italian plural of a loanword is the loanword.** This is the one fact
 * that shapes every line below and it is where Italian parts company with the
 * Spanish file next door. Spanish borrowed "megabit" *and* the -s that
 * pluralises it ("dos megabits"); Italian borrows the noun and leaves it
 * invariant — "un bit", "due bit", "cento megabit", exactly as it says "due
 * computer" and "tre film". The rule is not about computing: an Italian noun
 * that ends in a consonant has no native plural ending available to it, because
 * the native plural *substitutes* the final vowel rather than adding a
 * consonant. So there are no plural spellings to list here at all, and
 * `it.ts`'s `pluralFold` analyzer correctly offers nothing for these words —
 * they fall through to `identity()`, which is the invariant class that file
 * describes.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and which
 * Italian restates for a reason of its own. The written Italian rate is "megabit
 * al secondo": three words, and `parse/lex.ts` builds a unit word out of letters
 * plus trailing digits, so a space ends the token and the phrase can never lex
 * back as one unit. Italian is spared the sharper version of the Spanish
 * complaint — its preposition here is "al", not the `times` keyword "per" — but
 * a form that can be printed and never read is broken output in any language,
 * so the table stays absent rather than shrinking to a shape the lexer might
 * tolerate. Absent forms keep the renderer on the symbol, so an Italian datarate
 * prints "100Mbps", the same tight shape English prints "100mbps" and Ukrainian
 * "100Мбіт" through.
 *
 * **Symbols, and the slash that cannot be one.** The typographically correct
 * Italian symbols are "bit/s", "kbit/s", "Mbit/s" and so on — Italy writes this
 * family with the solidus, as `speed`'s "km/h" is written — and none of them can
 * be used here: "/" lexes as division, so "100Mbit/s" would reach the resolver
 * as `datarate ÷ duration`, a signature no kind declares and none should, since
 * dividing a rate by a time is not a rate. The escape `speed` has (making the
 * arithmetic true, "km/h" being a genuine length ÷ duration) is closed for this
 * kind because `datasize`'s canonical is the **byte** while this kind's
 * numerator is the bit, off by the factor of 8 that `index.ts` writes out
 * explicitly. `@smartput/energy/locale/uk` and the Spanish file here work
 * through the same argument at length.
 *
 * What Italian gets instead of the slash is the abbreviation an Italian ISP
 * prints on a contract: "Mbps" is on every fibre offer sold in Italy, it is one
 * letter run and therefore one token, and its casing is SI's — kilo lowercase,
 * mega and up capital — because that is how Italian writes prefixes. The alias
 * index folds case before lookup, so "Mbps" and the derived alias "mbps" are one
 * key and the symbol reads back as its own unit by construction.
 */
export default defineVocabulary({
  locale: "it",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "bit"],
      symbol: "bps",
    },
    kbps: {
      // Two prefix spellings, both current. "kilobit" is what an Italian
      // datasheet writes; "chilobit" is the fully Italianised form the same
      // prefix takes in "chilometro" and "chilogrammo", and it appears wherever
      // the register is less technical. Recognition is many-to-one (I6), so both
      // are read and neither is ever printed — the symbol is.
      aliases: [...alias("kbps"), "kbit", "kilobit", "chilobit"],
      symbol: "kbps",
    },
    mbps: {
      // "mega" alone is the colloquial Italian noun for a megabit per second —
      // "ho cento mega" is how a connection is described out loud — and it is
      // invariant like every other loanword here, so it is one alias and not
      // two.
      aliases: [...alias("mbps"), "mbit", "megabit", "mega"],
      symbol: "Mbps",
    },
    gbps: {
      aliases: [...alias("gbps"), "gbit", "gigabit", "giga"],
      symbol: "Gbps",
    },
    tbps: {
      // No colloquial clipping for this row. "tera" is not a noun anyone uses of
      // a line rate in Italian the way "mega" and "giga" are, and inventing one
      // would put a word in the index that no input contains.
      aliases: [...alias("tbps"), "tbit", "terabit"],
      symbol: "Tbps",
    },
  },
});
