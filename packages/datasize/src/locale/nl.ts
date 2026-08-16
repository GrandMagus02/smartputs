import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Dutch words for the datasize units.
 *
 * The bare `nl` tag, matching the language in `@smartput/core/locale/nl`: CLDR's
 * default content for Dutch, which is the Netherlands'. The shape is `en.ts`'s
 * and `de.ts`'s, down to naming `datasize` by **id string** rather than
 * importing the kind — that is what lets this file be imported without linking
 * the ratio table, and it is the seam `composeLocale` closes.
 *
 * **`aliases` is the derived list and nothing else, and that is the finding
 * rather than an unfinished file.** Dutch borrowed this whole family from
 * English without translating a syllable of it: byte, kilobyte, megabyte,
 * gigabyte, terabyte, and IEC's kibibyte, mebibyte, gibibyte, tebibyte are the
 * Dutch words, spelled exactly as `units.ts` already spells them, plural `-s`
 * included. Appending "kilobyte" to a list that already contains "kilobyte"
 * would be a second copy of `units.ts` maintained by hand. What this file
 * contributes is the other two columns: the words the printer emits, and the
 * symbol casing Dutch writes.
 *
 * **Lowercase, which is where Dutch parts company with the German file next
 * door.** `de.ts` prints `Kilobyte` with a capital because German capitalises
 * every noun; Dutch capitalises none, so every form below is lowercase and the
 * word a reader types is the word this file prints back, byte for byte. The
 * capitals that remain are in the *symbols*, and they are SI and IEC prefix
 * symbols rather than noun capitals — which is why `kB` keeps its small `k`
 * while `MB` takes a capital.
 *
 * **Two keys, and both of them the same word.** `dutch.selectForm` answers the
 * bare CLDR plural category over a single axis: `slot` is read and discarded,
 * because modern Dutch has no case marking left on common nouns and a
 * conversion target is spelled exactly like a bare quantity. So the table is
 * English-shaped — `one` and `other` — and reading the two off `b`:
 *
 * ```
 * one    1        "1 byte"
 * other  0, 2, 5  "512 byte"
 * ```
 *
 * The `other` row is the one worth stopping at, and it is neither English's nor
 * Ukrainian's trap. **Dutch holds a unit of measure in the singular after a
 * numeral**: "tien meter", "vijf kilo", "drie jaar", and by the same rule "512
 * byte" and "20 gigabyte" — the rule the Taalunie states for maten en gewichten
 * and which the language's own doc comment calls out as the thing a `forms`
 * table here will run into. Writing "bytes" in that row would print a plural no
 * Dutch measurement uses. The loanword's `-s` plural is still *read*, because
 * recognition is many-to-one (I6) and it arrives free from `units.ts`; it is
 * simply never written.
 *
 * That makes both rows one word for all nine units, which is a claim worth
 * being suspicious of — a table where every key holds the same string can be a
 * table that stopped halfway. It is not one here, and `@smartput/duration`'s
 * Dutch file one package over is the control: *uur* is invariant in exactly this
 * way while *dag* and *week* are not, so Dutch's number axis is live and this
 * kind simply sits on the invariant side of it.
 *
 * **Symbols are IEC's and SI's**, which is where Dutch agrees with German and
 * parts company with `en.ts`: `B` for the byte (capital, because the lowercase
 * `b` is the bit and this kind is bytes throughout), lowercase `k` for kilo
 * because SI writes every sub-mega prefix small, capitals from mega up, and
 * IEC's `Ki`, `Mi`, `Gi`, `Ti` with the `i` intact. The decimal and binary
 * families are separate units and never two names for one — 1 kB is 1000 bytes,
 * 1 KiB is 1024 — so the `k`/`Ki` contrast is load-bearing rather than
 * decorative. Every one of these folds onto a derived alias (`kB` → `kb`, `KiB`
 * → `kib`), which is the mechanism by which the printed symbol parses back.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "datasize",
  units: {
    b: {
      aliases: alias("b"),
      symbol: "B",
      forms: { one: "byte", other: "byte" },
    },
    kb: {
      aliases: alias("kb"),
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
    // The binary four. Dutch writes the IEC names as readily as the decimal ones
    // — "kibibyte" is what a Dutch standards document says — and they behave
    // identically after a numeral, which is the point: nothing about the prefix
    // changes the noun it is glued to.
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
