import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Turkish words for the datasize units.
 *
 * The bare `tr` tag, matching the language in `@smartput/core/locale/tr`. The
 * shape is `en.ts`'s: the same `kind` named by **id string** rather than
 * imported, so `@smartput/datasize/locale/tr` links no ratio table; `aliases`
 * derived from `units.ts` rather than retyped, so the micro path
 * (`parseDatasize`) and the engine path agree by construction; and an explicit
 * `symbol` on every unit (ruling R8). `composeLocale` is where the two halves
 * meet.
 *
 * **One form key, where English has two — and the row is full rather than
 * absent.** `turkish.selectForm` returns the constant `"other"` for every count
 * and every slot, because Turkish does not agree a noun with the number in front
 * of it: "1 bayt", "5 bayt", "1,5 bayt", and "5 baytlar" is not a plural but a
 * mistake. So a `forms` table here is one row per unit, and that is the finished
 * answer rather than half of an English one — a table translated from `en.ts`
 * needs no key renamed, it needs its `"one"` row deleted.
 *
 * This kind is the one where Turkish can actually fill that row, which is why it
 * looks different from `@smartput/datarate/locale/tr.ts` next door. A data
 * *rate* is a compound in every language ("saniyede megabit"), so its only
 * printable label is the elided symbol. A data *size* is one word: "bayt" is the
 * TDK-sanctioned Turkish spelling of the borrowed *byte*, it takes the SI and
 * IEC prefixes as a closed compound the way English does, and every one of the
 * nine names below is a single letter run that `parse/lex.ts` reads back as one
 * token. So the words are declared and the renderer prints them —
 * "512 megabayt", spaced, because `defaultRenderQuantity` spaces a word.
 *
 * **Symbols are the Latin ones, and that is Turkish rather than a shortcut.** A
 * Turkish product page writes "1,5 GB" and "512 MB" exactly as an English one
 * does; TSE adopts the SI symbols unchanged, and there is no Turkish
 * abbreviation of "bayt" to prefer over "B" — ruling R8 forbids inventing one.
 * The IEC binary prefixes keep their `i` — KiB, MiB, GiB, TiB — because the
 * decimal and binary families are separate units and never two names for one
 * (1 kB is 1000 bayt, 1 KiB is 1024), and the symbol is where that distinction
 * stays visible. The kilo prefix is lowercase `k` and the kibi prefix uppercase
 * `K`, which is SI's rule and IEC's respectively and not a typo either way.
 *
 * **The dotted and dotless i, which the binary prefixes walk straight into.**
 * `"KIB"`, typed in caps, folds to `"kıb"` under Turkish rules — `I` and `i` are
 * separate letters here, so `toLocaleLowerCase("tr")` produces a dotless ı that
 * matches no key in any alias index. Nothing in this file may compensate for
 * that, and nothing does: `turkish`'s `caseFolds` analyzer offers the ASCII
 * reading ("kib") at weight −1 alongside the Turkish one at 0, and the symbols
 * below are written in the mixed case a Turkish reader actually types, where the
 * only capital is a prefix letter and the `i` is already dotted. `tr.test.ts`
 * pins the all-caps reading.
 *
 * **Case endings are left to the language.** Turkish glues them on with vowel
 * harmony — "bayta çevir" but "gigabayta çevir", "baytta" but "megabaytta" —
 * and `turkish`'s suffix stripper enumerates every harmonic variant precisely so
 * a vocabulary does not have to. Its `minStem: 3` clears "bayt" and every prefixed
 * compound of it with room to spare, so the inflected cells the Ukrainian file
 * writes out would be rows the −2 fallback already reaches and that no printer
 * will ever emit. What is listed here is what is *printed* here, which is the
 * rule that matters: a form the printer emits must be an alias at full weight,
 * never a form the stripper happens to recover.
 *
 * **"mega" is not claimed, and neither is "giga".** "yüz mega" is real spoken
 * Turkish for a file of a hundred megabytes, and equally real for a
 * hundred-megabit connection; the alias index is one flat map with no kind in its
 * key, so a bare prefix can belong to at most one of `datasize` and `datarate`.
 * German claims it in `datarate` because German elides the prefix only for a
 * connection speed. Turkish elides it for both, so neither package claims it and
 * `@smartput/datarate/locale/tr.ts` records the same ruling from its side.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "datasize",
  units: {
    b: {
      aliases: [...alias("b"), "bayt"],
      symbol: "B",
      forms: { other: "bayt" },
    },
    kb: {
      aliases: [...alias("kb"), "kilobayt"],
      symbol: "kB",
      forms: { other: "kilobayt" },
    },
    mb: {
      aliases: [...alias("mb"), "megabayt"],
      symbol: "MB",
      forms: { other: "megabayt" },
    },
    gb: {
      aliases: [...alias("gb"), "gigabayt"],
      symbol: "GB",
      forms: { other: "gigabayt" },
    },
    tb: {
      aliases: [...alias("tb"), "terabayt"],
      symbol: "TB",
      forms: { other: "terabayt" },
    },
    // The IEC four. Turkish borrows the prefixes whole rather than translating
    // them — there is no Turkish morpheme for *kibi* — so the names are the
    // international ones with the same "bayt" head glued on, and they decline
    // like any other Turkish noun ("2 kibibayttan").
    kib: {
      aliases: [...alias("kib"), "kibibayt"],
      symbol: "KiB",
      forms: { other: "kibibayt" },
    },
    mib: {
      aliases: [...alias("mib"), "mebibayt"],
      symbol: "MiB",
      forms: { other: "mebibayt" },
    },
    gib: {
      aliases: [...alias("gib"), "gibibayt"],
      symbol: "GiB",
      forms: { other: "gibibayt" },
    },
    tib: {
      aliases: [...alias("tib"), "tebibayt"],
      symbol: "TiB",
      forms: { other: "tebibayt" },
    },
  },
});
