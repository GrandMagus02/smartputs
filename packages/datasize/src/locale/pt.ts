import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Portuguese words for the datasize units.
 *
 * The bare `pt` tag, matching the language in `@smartput/core/locale/pt`: this
 * project's ruling is that `pt` means the Brazilian default, which is what the
 * platform resolves it to as well — group ".", decimal ",". A regional variant
 * is a `Language` with an id of its own, never a flag on a vocabulary; the one
 * word below that is more European than Brazilian is marked where it appears and
 * is read-only.
 *
 * Shaped exactly like `en.ts`, `es.ts` and `uk.ts` beside it, down to naming
 * `datasize` by **id string** rather than importing the kind: that is what lets
 * this file be imported without linking the ratio table, and it is the seam
 * `composeLocale` closes. `aliases` derives the Latin set from `units.ts` rather
 * than retyping it, so the micro path (`parseDatasize`) and the engine path
 * agree by construction.
 *
 * **The Portuguese words are the English words, and that is the finding rather
 * than a shortcut.** Portuguese borrowed this whole family — "byte", "kilobyte",
 * "megabyte", and the IEC set "kibibyte", "mebibyte", "gibibyte", "tebibyte" —
 * and pluralises every one of them with the borrowed -s ("dois megabytes"), not
 * with the -es a native consonant-final noun would take ("mar" → "mares"). So
 * every `forms` value below is already an alias `units.ts` declares, and this
 * file adds no plural spellings at all: rule 5 — a printed form must be a *read*
 * form, not one the suffix stripper happens to recover — is satisfied here
 * without a single new line.
 *
 * What Portuguese does add is two readings, both deliberately reading-only:
 *
 * - **`octeto`**, the calque a Portuguese standards translation writes where an
 *   English one writes "byte". It is European far more than Brazilian, and under
 *   a Brazilian-default `pt` it would be wrong to *print* — so it is an alias and
 *   never a `forms` value. Listed for the canonical unit only, in both numbers,
 *   because that is where it is actually written; nobody writes "quiloocteto".
 * - **`quilobyte`**, the half-Hispanicised spelling that follows Portuguese's own
 *   prefix ("quilograma", "quilômetro") into a borrowed word. It circulates, so
 *   it is read; "kilobyte" is what the symbol "kB" agrees with and what Brazilian
 *   technical prose actually prints, so that is what generation stays on. The
 *   larger prefixes have no such variant — "mega", "giga" and "tera" are
 *   spelled the same in both languages — so this is one line and not four.
 *
 * **Symbols are IEC's, cased properly, where `en.ts` leaves them flat.** "B" is
 * the byte and "b" the bit — a distinction this repo keeps across two packages
 * (`@smartput/datarate` owns the bits) and one Portuguese honours in print, so
 * "MB" and "MiB" are written as the standard writes them. Nothing is risked by
 * the capitals: `buildRegistry` folds case before indexing and
 * `assertLocaleContract` looks a printed surface up folded, so "MiB" and the
 * derived alias "mib" are one key and every symbol below reads back as its own
 * unit.
 *
 * **No gender axis, deliberately.** Every unit here is masculine ("o byte", "um
 * megabyte") and the whole family agrees, so a gender key would hold one value
 * for nine units. More to the point a `forms` key is the wrong seam for it:
 * gender surfaces on the *number* word, not on the noun, and `selectForm` is
 * told only a count and a slot. `portuguese.renderQuantity` is where the
 * agreement is applied, because it is the one call that sees the spelled numeral
 * and the noun together — and it needs nothing from this file, since a noun
 * ending in -e or -o is masculine by the rule it already carries. So `forms`
 * stays the two-row shape `portuguese.selectForm` promises.
 */
export default defineVocabulary({
  locale: "pt",
  kind: "datasize",
  units: {
    b: {
      aliases: [...alias("b"), "octeto", "octetos"],
      symbol: "B",
      forms: { one: "byte", other: "bytes" },
    },
    kb: {
      aliases: [...alias("kb"), "quilobyte", "quilobytes"],
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
    // decimal ones (`kb` is 1000 bytes, `kib` is 1024), and Portuguese keeps
    // them just as separate: "kibibyte" is not a synonym of "kilobyte" in any
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
