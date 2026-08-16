import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DATASIZE_UNITS, type DatasizeUnit } from "../units";

const alias = (unit: DatasizeUnit) => aliasesFor(DATASIZE_UNITS, unit);

/**
 * Chinese words for the datasize units.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions. The shape is `en.ts`'s: the same `kind` named by **id
 * string** rather than imported, so `@smartput/datasize/locale/zh` links no ratio
 * table, `aliases` derived from `units.ts` rather than retyped, and an explicit
 * `symbol` on every unit (ruling R8). `composeLocale` is where the two halves
 * meet.
 *
 * **One form key, where English has two.** `chinese.selectForm` returns the
 * constant `"other"` for every count and every slot, because Chinese marks number
 * nowhere on a noun — 一字节 and 五字节 differ in the numeral and nowhere else —
 * and CLDR agrees (`Intl.PluralRules("zh")` declares the single category
 * `other`). A one-row `forms` table is the correct answer for this language and
 * never a stub: a table translated from `en.ts` needs no key renamed, it needs
 * its `"one"` row deleted.
 *
 * **And yet no unit here declares even that one row, which is a measurement
 * rather than a shrug.** Chinese is unspaced, so `chinese.segment` hands every
 * letter run to `Intl.Segmenter`, and ICU's dictionary decides where a word ends.
 * It does not know a single one of this kind's Chinese names:
 *
 * ```
 * 字节   → ["字", "节"]        比特   → ["比", "特"]
 * 千字节 → ["千", "字", "节"]   兆字节 → ["兆", "字", "节"]
 * 吉字节 → ["吉", "字", "节"]   太字节 → ["太字", "节"]
 * ```
 *
 * A `forms` entry of 「字节」 would print 「512字节」 and reach the resolver as
 * 字 then 节 — two tokens, neither of which is anybody's unit — so the printed
 * size would not read back. That is the one property a vocabulary must have and
 * the one `assertLocaleContract` cannot check for itself, since it consults the
 * alias index and the alias index never sees the segmenter. 千字节 is the worst of
 * the six: its first character is the numeral 千, so the stranded prefix is not
 * merely unreadable but reads as the *number* 1000. `zh.test.ts` re-runs all six
 * splits, so a dictionary update that learns 字节 surfaces as a failing test
 * rather than as a gap nobody notices.
 *
 * **So the symbols are the Latin ones throughout, and that is Chinese.** A
 * Chinese product page writes 「1.5GB」 and 「512MB」 exactly as an English one
 * does; there is no Han abbreviation for a data size, and R8 forbids inventing
 * one. The IEC binary prefixes keep their `i` — KiB, MiB, GiB, TiB — because the
 * decimal and binary families are separate units and never two names for one
 * (1kB is 1000 bytes, 1KiB is 1024), and the symbol is where that distinction
 * stays visible. Case folds in the alias index, so "GB" and "gb" are one key and
 * the casing costs nothing.
 *
 * **兆 is the one Chinese word this kind can honestly claim**, and it is worth
 * the paragraph. It is the SI prefix *mega* standing on its own with the unit
 * understood — 「这个文件20兆」, "this file is twenty megs" — the same elision
 * English's own "megs" and Ukrainian's "мб" rest on. It survives ICU whole
 * because it is one character, and it is not in `zh-cardinals.ts` (that table
 * stops at 亿), so `foldNumerals` leaves it alone and 「5兆」 reaches the alias
 * index as a word rather than as a number.
 *
 * It is claimed *here* rather than in `@smartput/datarate`, where 「100兆宽带」 is
 * an equally real hundred megabits per second, and the tie is broken by what a
 * *bare* token means: the alias index has no kind in its key, so one of the two
 * kinds gets the standalone reading, and standing alone after a number 兆 is a
 * file size. The broadband sense never stands alone — it is always followed by
 * 宽带 or 光纤, which lex as separate words and end the parse regardless — so
 * `datarate` loses nothing it could have used. `datarate/locale/zh.ts` records
 * the same ruling from its side.
 *
 * 吉 (giga) and 太 (tera) are deliberately not claimed alongside it. Both are
 * live prefixes in written Chinese, but neither is ever elided the way 兆 is, and
 * as bare characters they are among the commonest words in the language — 吉 is
 * "auspicious", 太 is "too, very". An alias that claims 太 would read 「太大」
 * ("too big") as a tebibyte the moment anything typed it.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "datasize",
  units: {
    b: { aliases: alias("b"), symbol: "B" },
    kb: { aliases: alias("kb"), symbol: "kB" },
    // The colloquial "meg", elided down to the bare prefix. One character, so
    // ICU returns it whole; absent from `zh-cardinals.ts`, so it is not folded
    // into a number on the way past.
    mb: { aliases: [...alias("mb"), "兆"], symbol: "MB" },
    gb: { aliases: alias("gb"), symbol: "GB" },
    tb: { aliases: alias("tb"), symbol: "TB" },
    kib: { aliases: alias("kib"), symbol: "KiB" },
    mib: { aliases: alias("mib"), symbol: "MiB" },
    gib: { aliases: alias("gib"), symbol: "GiB" },
    tib: { aliases: alias("tib"), symbol: "TiB" },
  },
});
