import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Indonesian words for the datasize units.
 *
 * The bare `id` tag, matching the language in `@smartput/core/locale/id`. Same
 * shape as `en.ts`, `nl.ts` and `de.ts` beside it, down to naming `datasize` by
 * **id string** rather than importing the kind — that is what lets this file be
 * imported without linking the ratio table, and `composeLocale` is the seam
 * where the two halves meet.
 *
 * **One row per unit, and that is the whole `forms` column.**
 * `indonesian.selectForm` returns the constant `"other"` for every count and
 * every slot, because nothing in the language agrees with anything else in it:
 * there is no grammatical plural (plurality is reduplication — *buku-buku* — and
 * reduplication does not survive a numeral, so "20 gigabyte" and "1 gigabyte"
 * hold the same noun), no gender, no case for a preposition to govern. So where
 * `de.ts` writes four keys and `nl.ts` two, this writes one. That is not a table
 * that stopped halfway; it is the floor the three-type split was built to be
 * able to reach, and it is visible here only because the grammar and the words
 * live in different objects — an Indonesian `Vocabulary` is exactly as large as
 * anybody else's, and the saving is entirely on the `Language` side.
 *
 * **`aliases` is the derived list plus one word, and the near-emptiness is the
 * finding.** Indonesian borrowed this family whole and unadapted, exactly as
 * Dutch did: *byte*, *kilobyte*, *megabyte*, *gigabyte*, *terabyte* and IEC's
 * *kibibyte* … *tebibyte* are what an Indonesian spec sheet, a phone's storage
 * screen and a data-quota advertisement all print, and `units.ts` already spells
 * every one of them. Appending "megabyte" to a list containing "megabyte" would
 * be a hand-maintained second copy of the alias map.
 *
 * **The one word added is `bita`, and it is deliberately added at exactly one
 * unit.** KBBI lists *bita* as the Indonesian noun for the byte, so it is a word
 * this vocabulary can honestly claim and a reader may honestly type. The
 * prefixed derivations — *kilobita*, *megabita*, *gigabita* — are a different
 * matter: they are not in the dictionary and circulate mainly in one
 * encyclopedia's house style, so claiming five of them would be claiming words
 * on the strength of a single source, which is the same mistake as inventing a
 * symbol (R8) wearing different clothes. Rule 5 settles the asymmetry cleanly:
 * *bita* is read and never printed, because the printed form must be the word
 * people actually write, and for every one of these nine units that word is the
 * borrowed one.
 *
 * **Symbols are IEC's and SI's**, which is where Indonesian agrees with Dutch
 * and German and parts company with `en.ts`: `B` for the byte — capital, because
 * lowercase `b` is the *bit* and this kind is bytes throughout, a distinction
 * `@smartput/datarate` depends on — a small `k` for kilo because SI writes every
 * sub-mega prefix small, capitals from mega up, and IEC's `Ki`, `Mi`, `Gi`, `Ti`
 * with the `i` intact. The decimal and binary families are separate units and
 * never two names for one (1 kB is 1000 bytes, 1 KiB is 1024), so the `k`/`Ki`
 * contrast is load-bearing rather than decorative. Each folds onto a derived
 * alias (`kB` → `kb`, `KiB` → `kib`), which is the mechanism by which a
 * `symbols: true` print parses back.
 *
 * Nothing here needs a `renderQuantity`: every unit carries its one `forms` row,
 * so `formatValue` takes the word branch, which already spaces — "20 gigabyte",
 * not "20gigabyte". That is the case `@smartput/core/locale/id` reasons from
 * when it declines the field; `@smartput/datarate` and `@smartput/speed` are the
 * kinds where the reasoning runs out.
 */
export default defineVocabulary({
  locale: "id",
  kind: "datasize",
  units: {
    b: {
      aliases: [...alias("b"), "bita"],
      symbol: "B",
      forms: { other: "byte" },
    },
    kb: {
      aliases: alias("kb"),
      symbol: "kB",
      forms: { other: "kilobyte" },
    },
    mb: {
      aliases: alias("mb"),
      symbol: "MB",
      forms: { other: "megabyte" },
    },
    gb: {
      aliases: alias("gb"),
      symbol: "GB",
      forms: { other: "gigabyte" },
    },
    tb: {
      aliases: alias("tb"),
      symbol: "TB",
      forms: { other: "terabyte" },
    },
    // The binary four. Indonesian writes the IEC names as unadapted as the
    // decimal ones — an Indonesian standards translation says "kibibyte" — and
    // they behave identically after a numeral, which is the point of a language
    // with no agreement: nothing about the prefix can change the noun it is
    // glued to, because nothing changes the noun at all.
    kib: {
      aliases: alias("kib"),
      symbol: "KiB",
      forms: { other: "kibibyte" },
    },
    mib: {
      aliases: alias("mib"),
      symbol: "MiB",
      forms: { other: "mebibyte" },
    },
    gib: {
      aliases: alias("gib"),
      symbol: "GiB",
      forms: { other: "gibibyte" },
    },
    tib: {
      aliases: alias("tib"),
      symbol: "TiB",
      forms: { other: "tebibyte" },
    },
  },
});
