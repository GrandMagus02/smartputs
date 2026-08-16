import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Italian words for the datasize units.
 *
 * The bare `it` tag, matching the language in `@smartput/core/locale/it`: CLDR's
 * default content for Italian, which is Italy's — group ".", decimal ",". A
 * regional variant would be a `Language` with an id of its own rather than a
 * flag on this table, and nothing here is regional anyway.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `datasize`
 * by **id string** rather than importing the kind: that is what lets this file be
 * imported without linking the ratio table, and it is the seam `composeLocale`
 * closes. `aliases` derives the Latin set from `units.ts` rather than retyping
 * it, so the micro path (`parseDatasize`) and the engine path agree by
 * construction.
 *
 * **The Italian words are the English words, and the Italian plural of them is
 * also the English singular.** Italian borrowed this whole family — "byte",
 * "kilobyte", "megabyte", and the IEC set "kibibyte", "mebibyte", "gibibyte",
 * "tebibyte" — and, unlike Spanish, borrowed no plural with them: a consonant-
 * final loanword is invariant in Italian, because the native plural
 * *substitutes* a final vowel and there is none here to substitute. So it is
 * "un megabyte", "due megabyte", "cento megabyte", never "megabytes". That is
 * why both `forms` rows below hold the same string — the same shape `en.ts`
 * needed for "horsepower" and for exactly the same reason: an absent `other`
 * would fall back to the symbol, so "2 megabyte" would print "2MB" while "1
 * megabyte" printed "1 megabyte", one value formatted two ways.
 *
 * Keeping `forms` at all (rather than dropping them and printing only symbols,
 * which is what `datarate` next door does) is the decision this file makes on
 * its own. It costs nothing to read back — every string in it is already an
 * alias `units.ts` declares — and it buys the space between number and word,
 * since `defaultRenderQuantity` sets a symbol tight and spaces a word. "5
 * megabyte" is what an Italian writes in a sentence; "5MB" is what the same
 * Italian writes in a table, and the symbol is still there for `symbols: true`.
 *
 * **`ottetto` is the one native word here**, and it is real rather than
 * decorative: it is the Italian calque an EU or CEI translation uses where an
 * English standards document writes "byte", and being a native masculine noun in
 * -o it *does* inflect — "due ottetti" — so both spellings are listed. It is
 * listed for the canonical unit only, because that is the only place it is
 * written; "chiloottetto" is not a word anyone has typed. Only the borrowed
 * "byte" is ever printed, because that is what an Italian actually says.
 *
 * **Symbols are IEC's, cased properly, where `en.ts` leaves them flat.** "B" is
 * the byte and "b" the bit — a distinction this repo keeps across two packages
 * (`@smartput/datarate` owns the bits) and one Italian honours in print, so "MB"
 * and "MiB" are written as the standard writes them. Nothing is risked by the
 * capitals: `buildRegistry` folds case before indexing and `assertLocaleContract`
 * looks a printed surface up folded, so "MiB" and the derived alias "mib" are one
 * key and every symbol below reads back as its own unit.
 *
 * **No gender axis, and nothing to hang one on.** Every noun here is masculine
 * ("il byte", "un megabyte", "l'ottetto"), so a gender key would hold one value
 * for nine units — but the decisive point is that `italian.selectForm` returns
 * `"one"` or `"other"` and nothing else, and a key it cannot produce is a key
 * `assertLocaleContract` will never index. Gender surfaces on the *number* word
 * in Italian ("un byte" against "una caloria"), and `italianSpeller` is handed a
 * magnitude and nothing else; it emits the apocopated masculine "un" in front of
 * a scale noun and says so in its own comment. An axis whose one consumer cannot
 * read it only costs every other translator a column.
 */
export default defineVocabulary({
  locale: "it",
  kind: "datasize",
  units: {
    b: {
      aliases: [...alias("b"), "ottetto", "ottetti"],
      symbol: "B",
      forms: { one: "byte", other: "byte" },
    },
    kb: {
      // "kilobyte" arrives from `units.ts`; "chilobyte" is the same prefix given
      // its fully Italian spelling, the one "chilometro" and "chilogrammo" use.
      // Both are read, the borrowed one is printed — that is what an Italian
      // keyboard produces and what an Italian shop window shows.
      aliases: [...alias("kb"), "chilobyte"],
      symbol: "kB",
      forms: { one: "kilobyte", other: "kilobyte" },
    },
    mb: {
      aliases: alias("mb"),
      symbol: "MB",
      forms: { one: "megabyte", other: "megabyte" },
    },
    gb: {
      aliases: alias("gb"),
      symbol: "GB",
      forms: { one: "gigabyte", other: "gigabyte" },
    },
    tb: {
      aliases: alias("tb"),
      symbol: "TB",
      forms: { one: "terabyte", other: "terabyte" },
    },
    // The binary four. They are separate units rather than second names for the
    // decimal ones (`kb` is 1000 bytes, `kib` is 1024), and Italian keeps them
    // just as separate: "kibibyte" is not a synonym of "kilobyte" in any
    // register, so the two must never fold together here either. Italian takes
    // the IEC names unchanged and leaves them invariant like the rest.
    kib: {
      aliases: alias("kib"),
      symbol: "KiB",
      forms: { one: "kibibyte", other: "kibibyte" },
    },
    mib: {
      aliases: alias("mib"),
      symbol: "MiB",
      forms: { one: "mebibyte", other: "mebibyte" },
    },
    gib: {
      aliases: alias("gib"),
      symbol: "GiB",
      forms: { one: "gibibyte", other: "gibibyte" },
    },
    tib: {
      aliases: alias("tib"),
      symbol: "TiB",
      forms: { one: "tebibyte", other: "tebibyte" },
    },
  },
});
