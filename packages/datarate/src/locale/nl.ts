import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Dutch words for the datarate units.
 *
 * The bare `nl` tag, matching the language in `@smartput/core/locale/nl`: CLDR's
 * default content for Dutch, which is the Netherlands'. Nothing below is
 * regional — "megabit" is the same word in Amsterdam and in Antwerp — and the
 * one thing that does differ between the two countries (Flemish prefers "bit per
 * seconde" spelled out where the Netherlands writes the abbreviation) is a
 * matter of register rather than of vocabulary.
 *
 * Shaped exactly like `en.ts`, `de.ts` and `uk.ts` beside it, down to naming
 * `datarate` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table or the four bridge
 * signatures, and `composeLocale` is where the two halves meet. `aliases`
 * derives the Latin set from `units.ts` rather than retyping it — a Dutch
 * speaker types "100 mbps" as readily as "100 megabit" — and the Dutch spellings
 * are appended to it.
 *
 * **Lowercase throughout, and that is the one German stress this language does
 * not share.** `de.ts` next door writes `Megabit` with a capital because German
 * capitalises every noun; Dutch capitalises none, so the word a reader types in
 * a search box and the word this file prints back are the same string in the
 * same case. The capitals that do appear below are in the *symbols* only, and
 * they are SI prefix symbols (`M` for mega, `G` for giga, `T` for tera) rather
 * than noun capitals — which is why `kbit` keeps its small `k`, exactly as SI
 * writes every prefix below mega small.
 *
 * **No `forms` on any unit**, the ruling `en.ts` records, and Dutch has no more
 * escape from it than German does. Dutch closes its compounds up as readily as
 * German — `kilowattuur` is one word, and `@smartput/energy/locale/nl` prints
 * exactly that — but there is no closed compound for a rate. What Dutch writes
 * is "megabit per seconde", three words, and `parse/lex.ts` builds a unit word
 * out of letters plus trailing digits, so a space ends the token however the
 * phrase is spelled. A `forms` table here would be two keys of prose no input
 * could reach. Absent forms keep the renderer on the symbol.
 *
 * **What the symbol may not be.** The typographically correct Dutch symbols are
 * "bit/s", "kbit/s", "Mbit/s", "Gbit/s" and "Tbit/s", and none of them can be
 * used: "/" lexes as division, so "100 Mbit/s" would reach the resolver as
 * `datarate ÷ duration` — a signature no kind declares and none should, since
 * dividing a rate by a time is not a rate. The escape `speed` has (making the
 * arithmetic true, as "km/u" does through `/ | length | duration`) is closed
 * here by a fact about `datasize`: its canonical is the **byte** and this kind's
 * numerator is the bit, off by the factor of 8 that `index.ts` writes out.
 *
 * So the "/s" is elided, exactly as `de.ts` and `uk.ts` elide it — "bit",
 * "kbit", "Mbit", "Gbit", "Tbit" — and the elision is one a Dutch speaker
 * already makes ("ik heb honderd megabit"). The loss is real and worth naming:
 * "100 Mbit" states a count of megabits where "100 Mbit/s" states a rate. What
 * it buys is that every string this vocabulary can print is a string it can
 * read.
 *
 * **Aliases.** The Dutch nouns are listed in both numbers. `bit` is a measure
 * noun after a numeral and therefore invariant — "honderd megabit", not
 * "megabits" — but "megabits" is written too, and recognition is many-to-one
 * (I6) while generation stays the single symbol above. The prefixed
 * abbreviations `kbit`/`Mbit`/… are listed in their own right rather than left
 * to the language's `compoundSplitter`: `bit` and `bits` are heads in `dutch`'s
 * own list, so the splitter offers `bit` out of `megabit` at its −3 penalty,
 * which is the *base* unit and off by a million. The exact alias at 0 is what
 * outranks it, and it has to exist to do so.
 *
 * **`mega` and `giga` are nouns here, and they take the apostrophe plural.** A
 * Dutch subscriber speaks of a line of "honderd mega", the numerator of the
 * abbreviation standing for the whole of it, the same elision German's "hundert
 * Mega" makes. Written in the plural these become `mega's` and `giga's`, because
 * Dutch writes the `-s` plural of a noun ending in a single vowel with an
 * apostrophe so that the vowel stays long — `foto's`, `euro's` — and that is the
 * very spelling `dutch`'s `suffixStripper` lists `'s` for. Listing them
 * explicitly rather than leaning on that stripper is rule 5: a form recovered
 * only through a −2 penalty is recovered by accident.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "datarate",
  units: {
    bps: {
      aliases: [...alias("bps"), "bit", "bits"],
      symbol: "bit",
    },
    kbps: {
      aliases: [...alias("kbps"), "kbit", "kbits", "kilobit", "kilobits"],
      symbol: "kbit",
    },
    mbps: {
      aliases: [
        ...alias("mbps"),
        "mbit",
        "mbits",
        "megabit",
        "megabits",
        "mega",
        "mega's",
      ],
      symbol: "Mbit",
    },
    gbps: {
      aliases: [
        ...alias("gbps"),
        "gbit",
        "gbits",
        "gigabit",
        "gigabits",
        "giga",
        "giga's",
      ],
      symbol: "Gbit",
    },
    tbps: {
      aliases: [...alias("tbps"), "tbit", "tbits", "terabit", "terabits"],
      symbol: "Tbit",
    },
  },
});
