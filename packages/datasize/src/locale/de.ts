import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * German words for the datasize units.
 *
 * The bare `de` tag, matching the language in `@smartput/core/locale/de`: CLDR's
 * default content for German, which is Germany's. The shape is `en.ts`'s and
 * `uk.ts`'s, down to naming `datasize` by **id string** rather than importing
 * the kind — that is what lets this file be imported without linking the ratio
 * table, and it is the seam `composeLocale` closes.
 *
 * **`aliases` is the derived list and nothing else, and that is the finding
 * rather than an unfinished file.** German borrowed this whole family from
 * English without translating a syllable of it: Byte, Kilobyte, Megabyte,
 * Gigabyte, Terabyte, and IEC's Kibibyte, Mebibyte, Gibibyte, Tebibyte are the
 * German words, spelled exactly as `units.ts` already spells them. The alias
 * index folds case before lookup, so the capital every German noun carries costs
 * nothing here, and appending "kilobyte" to a list that already contains
 * "kilobyte" would be a second copy of `units.ts` maintained by hand. What this
 * file actually contributes is the other two columns: the capitalisation the
 * printer emits, and the symbol casing German writes.
 *
 * **Four keys, and three of them the same word.** `german.selectForm` answers
 * `` `${case}-${category}` `` over {nom, dat} × {one, other} — case from the
 * slot, because a conversion target is governed by "in"/"nach"/"zu" and German's
 * locative "in" takes the dative, and category from `Intl.PluralRules("de")`,
 * which declares exactly two. Reading the four off `b`, since every other unit
 * is the same noun with a prefix glued on:
 *
 * ```
 * nom-one    1        nominative singular   "1 Byte"
 * nom-other  0, 2, 5  after a numeral       "512 Byte"
 * dat-one    1        dative singular       "in 1 Byte"
 * dat-other  0, 2, 5  dative plural         "in Bytes"
 * ```
 *
 * The row worth stopping at is `nom-other`, and it is the mirror image of the
 * row Ukrainian's file stops at. Ukrainian's trap is that a category which looks
 * plural takes a *singular* word; German's is that a category which looks plural
 * takes the **uninflected** word. `Byte` is a neuter measure noun, and after a
 * numeral German holds those in the singular — "512 Byte", "100 Watt", "5
 * Meter" — so writing "Bytes" there would print a form no German measurement
 * uses. The plural surfaces one column over: "die Größe in Bytes" is the dative
 * plural, and it is the only row of the four that differs, exactly as `Meter`
 * differs only in `Metern`. A vocabulary that writes the same word four times
 * here is correct; the loanword's `-s` plural is what keeps that from being
 * vacuous.
 *
 * **Symbols are IEC's and SI's, which is where German parts company with
 * `en.ts`.** English ships the lowercase `kb`/`kib` its own alias table is keyed
 * by; German writes `B` for the byte (capital, because the lowercase `b` is the
 * bit and this kind is bytes throughout), lowercase `k` for kilo because SI
 * writes every sub-mega prefix small, capital for mega and up, and IEC's `Ki`,
 * `Mi`, `Gi`, `Ti` with the `i` intact. The decimal and binary families are
 * separate units and never two names for one — 1 kB is 1000 bytes, 1 KiB is
 * 1024 — so the `k`/`Ki` contrast is load-bearing and not decoration. Every one
 * of these folds onto a derived alias (`kB` → `kb`, `KiB` → `kib`), which is the
 * whole mechanism by which the printed symbol parses back.
 */
export default defineVocabulary({
  locale: "de",
  kind: "datasize",
  units: {
    b: {
      aliases: alias("b"),
      symbol: "B",
      forms: {
        "nom-one": "Byte",
        "nom-other": "Byte",
        "dat-one": "Byte",
        "dat-other": "Bytes",
      },
    },
    kb: {
      aliases: alias("kb"),
      symbol: "kB",
      forms: {
        "nom-one": "Kilobyte",
        "nom-other": "Kilobyte",
        "dat-one": "Kilobyte",
        "dat-other": "Kilobytes",
      },
    },
    mb: {
      aliases: alias("mb"),
      symbol: "MB",
      forms: {
        "nom-one": "Megabyte",
        "nom-other": "Megabyte",
        "dat-one": "Megabyte",
        "dat-other": "Megabytes",
      },
    },
    gb: {
      aliases: alias("gb"),
      symbol: "GB",
      forms: {
        "nom-one": "Gigabyte",
        "nom-other": "Gigabyte",
        "dat-one": "Gigabyte",
        "dat-other": "Gigabytes",
      },
    },
    tb: {
      aliases: alias("tb"),
      symbol: "TB",
      forms: {
        "nom-one": "Terabyte",
        "nom-other": "Terabyte",
        "dat-one": "Terabyte",
        "dat-other": "Terabytes",
      },
    },
    // The binary four. German writes the IEC names as readily as the decimal
    // ones — "Kibibyte" is what a German standards document says — and they
    // inflect identically, which is the point: nothing about the prefix changes
    // the noun it is glued to.
    kib: {
      aliases: alias("kib"),
      symbol: "KiB",
      forms: {
        "nom-one": "Kibibyte",
        "nom-other": "Kibibyte",
        "dat-one": "Kibibyte",
        "dat-other": "Kibibytes",
      },
    },
    mib: {
      aliases: alias("mib"),
      symbol: "MiB",
      forms: {
        "nom-one": "Mebibyte",
        "nom-other": "Mebibyte",
        "dat-one": "Mebibyte",
        "dat-other": "Mebibytes",
      },
    },
    gib: {
      aliases: alias("gib"),
      symbol: "GiB",
      forms: {
        "nom-one": "Gibibyte",
        "nom-other": "Gibibyte",
        "dat-one": "Gibibyte",
        "dat-other": "Gibibytes",
      },
    },
    tib: {
      aliases: alias("tib"),
      symbol: "TiB",
      forms: {
        "nom-one": "Tebibyte",
        "nom-other": "Tebibyte",
        "dat-one": "Tebibyte",
        "dat-other": "Tebibytes",
      },
    },
  },
});
