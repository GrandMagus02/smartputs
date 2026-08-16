import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Turkish words for the datarate units.
 *
 * The bare `tr` tag, matching the language in `@smartput/core/locale/tr`. There
 * is nothing regional to choose between here — "megabit" is the same word in
 * Istanbul and in Nicosia — and the one thing that does vary by locale, the
 * decimal comma and the full-stop group separator, is a property of the
 * `Language` and read from CLDR rather than written down in this table.
 *
 * Shaped exactly like `en.ts`, `uk.ts` and `de.ts` beside it, down to naming
 * `datarate` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table or the four bridge
 * signatures, and it is the seam `composeLocale` closes. `aliases` derives the
 * Latin set from `units.ts` rather than retyping it — a Turkish speaker types
 * "100 mbps" as readily as "100 megabit" — and the Turkish spellings are
 * appended to it. `symbol` is explicit on every unit (ruling R8).
 *
 * **No `forms` on any unit, and Turkish reaches that conclusion by a different
 * road than the languages beside it.** For German and Ukrainian the obstacle was
 * grammatical bulk — four keys, eight keys — filled with prose no input could
 * reach. Turkish has no such bulk: `turkish.selectForm` returns the single key
 * `"other"` for every count and every slot, because a counted noun here is bare
 * ("1 megabit", "5 megabit", "1,5 megabit", never "5 megabitler"), so a table
 * would cost exactly one row per unit and cost nothing to maintain.
 *
 * It is still absent, because the row would be a *second* spelling of the
 * elision the symbol already carries. The full Turkish name of this quantity is
 * "saniyede megabit" or "megabit/saniye" — two tokens either way, and
 * `parse/lex.ts` builds a unit word out of letters plus trailing digits, so a
 * space or a slash ends the token regardless. The single word "megabit" is not
 * the name; it is the same per-second elision a Turkish speaker already makes
 * out loud ("internetim yüz megabit"), which is precisely what "Mbit" below
 * abbreviates. Two spellings of one elision, one of which the printer would have
 * to choose between at random, is worse than the one a spec sheet writes.
 *
 * **What the symbol may not be.** "Mbit/s" and "Mbps" are both written in
 * Turkish and the first of the two is unusable: "/" lexes as division, so
 * "100 Mbit/s" would reach the resolver as `datarate ÷ duration` — a signature
 * no kind declares and none should, since dividing a rate by a time is not a
 * rate. The escape `energy` sometimes has (making the arithmetic true, the way
 * "kWh" computes through `* | power | duration`) is closed here by a fact about
 * `datasize`: its canonical is the **byte** where this kind's numerator is the
 * bit, off by the factor of 8 that `index.ts` writes out explicitly. So the
 * "/s" is elided exactly as `uk.ts` and `de.ts` elide it, and the loss is real
 * and worth naming — "100 Mbit" states a count of megabits where "100 Mbit/s"
 * states a rate. What it buys is that every string this vocabulary can print is
 * a string it can read.
 *
 * Prefix casing is SI's, which is also TSE's: kilo lowercase, mega and up
 * capital. The alias index folds case before lookup, so "Mbit" and the listed
 * "mbit" are one key and the symbol reads back by construction.
 *
 * **The dotted and dotless i, which this kind meets in its very stem.** Every
 * word below contains an `i`, so an all-caps "MBIT" is the case Turkish breaks:
 * `"MBIT".toLocaleLowerCase("tr")` is `"mbıt"` with a dotless ı, which matches
 * no key in any alias index. `turkish`'s `caseFolds` analyzer is what rescues
 * it — its penalised ASCII pass maps every i-shaped letter onto plain `i` and
 * offers "mbit" at weight −1 — and `tr.test.ts` beside this file pins the
 * reading rather than leaving the paragraph to be taken on trust.
 *
 * **Case endings are left to the language, deliberately.** Turkish glues its
 * cases on with vowel harmony — "megabite çevir" takes `-e` after the front
 * vowel of "bit" where "kilograma" takes `-a` — and `turkish`'s suffix stripper
 * enumerates every harmonic variant precisely so a vocabulary does not have to.
 * Its `minStem: 3` clears every stem here with room to spare (the shortest is
 * "bit", and "bite" strips back to it), so listing the inflected cells the way
 * the Ukrainian file does would add rows that the −2 fallback already reaches
 * and that no printer will ever emit.
 *
 * **"mega" is not claimed, by either of the two kinds that could.** "yüz mega"
 * is real spoken Turkish for a hundred-megabit line, and it is equally real for
 * a file of a hundred megabytes; the alias index is one flat map with no kind in
 * its key, so a bare "mega" can belong to at most one of `datarate` and
 * `datasize`. German could take it here because German elides the prefix only
 * for a connection speed. Turkish elides it for both, so neither package claims
 * it and `@smartput/datasize/locale/tr.ts` records the same ruling from its
 * side.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "datarate",
  units: {
    bps: { aliases: [...alias("bps"), "bit"], symbol: "bit" },
    kbps: { aliases: [...alias("kbps"), "kbit", "kilobit"], symbol: "kbit" },
    mbps: { aliases: [...alias("mbps"), "mbit", "megabit"], symbol: "Mbit" },
    gbps: { aliases: [...alias("gbps"), "gbit", "gigabit"], symbol: "Gbit" },
    tbps: { aliases: [...alias("tbps"), "tbit", "terabit"], symbol: "Tbit" },
  },
});
