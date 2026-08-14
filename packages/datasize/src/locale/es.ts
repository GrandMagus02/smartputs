import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Spanish words for the datasize units.
 *
 * The bare `es` tag, matching the language in `@smartput/core/locale/es`: CLDR's
 * default content for Spanish, which is Spain's, with the group separator "."
 * and the decimal ",". A regional variant is a `Language` with an id of its own,
 * never a flag on a vocabulary — and nothing in this table is regional anyway.
 *
 * Shaped exactly like `en.ts` and `uk.ts` beside it, down to naming `datasize`
 * by **id string** rather than importing the kind: that is what lets this file
 * be imported without linking the ratio table, and it is the seam
 * `composeLocale` closes. `aliases` derives the Latin set from `units.ts` rather
 * than retyping it, so the micro path (`parseDatasize`) and the engine path
 * agree by construction.
 *
 * **The Spanish words are the English words, and that is the finding rather
 * than a shortcut.** Spanish borrowed this entire family whole — "byte",
 * "kilobyte", "megabyte", and the IEC set "kibibyte", "mebibyte", "gibibyte",
 * "tebibyte" — and pluralises each of them with the borrowed -s ("dos
 * megabytes"), never with a native ending. So every `forms` value below is
 * already an alias `units.ts` declares, and the file adds no plural spellings at
 * all: rule 5 (a printed form must be a *read* form, not one the suffix
 * stripper happens to recover) is satisfied here without a single new line.
 * What Spanish does add is `octeto` — the RAE's own calque, the word a Spanish
 * standards document uses where an English one writes "byte". It is listed for
 * the canonical unit only, in both numbers, because that is where it is
 * actually written; nobody says "kiloocteto" outside a translation of a French
 * datasheet.
 *
 * **Symbols are IEC's, cased properly, where `en.ts` leaves them flat.** "B" is
 * the byte and "b" the bit — a distinction this repo keeps across two packages
 * (`@smartput/datarate` owns the bits) and one Spanish honours in print, so
 * "MB" and "MiB" are written as the standard writes them. Nothing is risked by
 * the capitals: `buildRegistry` folds case before indexing and
 * `assertLocaleContract` looks a symbol up folded, so "MiB" and the derived
 * alias "mib" are one key and every symbol below reads back as its own unit.
 *
 * **No gender axis, deliberately.** Every unit here is masculine ("el byte",
 * "un megabyte") and the whole family agrees, so a gender key would hold one
 * value for nine units. More to the point it would have nothing to agree
 * *with*: gender surfaces on the *number* word, not on the noun, and
 * `spellSpanish` is handed a magnitude and nothing else — it emits the
 * apocopated masculine "un" for every unit in the repo and says so in its own
 * doc comment. An axis whose one consumer cannot read it is an axis that only
 * costs every other translator a column, so `forms` stays the two-row English
 * shape `spanish.selectForm` promises.
 */
export default defineVocabulary({
  locale: "es",
  kind: "datasize",
  units: {
    b: {
      aliases: [...alias("b"), "octeto", "octetos"],
      symbol: "B",
      forms: { one: "byte", other: "bytes" },
    },
    kb: {
      aliases: alias("kb"),
      symbol: "kB",
      forms: { one: "kilobyte", other: "kilobytes" },
    },
    mb: {
      aliases: alias("mb"),
      symbol: "MB",
      forms: { one: "megabyte", other: "megabytes" },
    },
    gb: {
      aliases: alias("gb"),
      symbol: "GB",
      forms: { one: "gigabyte", other: "gigabytes" },
    },
    tb: {
      aliases: alias("tb"),
      symbol: "TB",
      forms: { one: "terabyte", other: "terabytes" },
    },
    // The binary four. They are separate units rather than second names for the
    // decimal ones (`kb` is 1000 bytes, `kib` is 1024), and Spanish keeps them
    // just as separate: "kibibyte" is not a synonym of "kilobyte" in any
    // register, so the two must never fold together here either.
    kib: {
      aliases: alias("kib"),
      symbol: "KiB",
      forms: { one: "kibibyte", other: "kibibytes" },
    },
    mib: {
      aliases: alias("mib"),
      symbol: "MiB",
      forms: { one: "mebibyte", other: "mebibytes" },
    },
    gib: {
      aliases: alias("gib"),
      symbol: "GiB",
      forms: { one: "gibibyte", other: "gibibytes" },
    },
    tib: {
      aliases: alias("tib"),
      symbol: "TiB",
      forms: { one: "tebibyte", other: "tebibytes" },
    },
  },
});
