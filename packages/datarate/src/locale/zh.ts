import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Chinese words for the datarate units.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions. The kind next door names no language at all: ratios,
 * unit ids, the magnitude bands `typical` records, and four bridge signatures
 * naming their operand kinds by string. This file names `datarate` by **id
 * string** rather than importing the kind, which is what lets
 * `@smartput/datarate/locale/zh` be imported without linking the ratio table;
 * `composeLocale` is where the two halves meet.
 *
 * **One form key, and no unit declares it.** `chinese.selectForm` returns the
 * constant `"other"` for every count and every slot — Chinese marks number
 * nowhere on a noun, and `Intl.PluralRules("zh")` declares the single category
 * `other` — so a `forms` table in this language is one row per unit, and one row
 * is a finished answer rather than a stub. This kind simply has no row to put in
 * it, for the reason `en.ts` records and two of Chinese's own.
 *
 * English refuses `forms` because a rate is a compound the lexer cannot read
 * back. The Chinese for "megabits per second" is 「兆比特每秒」, and 每秒 ("per
 * second") is a word of its own that a `forms` entry would have to print inside
 * a single unit token; a unit word is a run of letters plus trailing digits
 * (`parse/lex.ts`), so it cannot be.
 *
 * The second reason is measured. Chinese is unspaced, so `chinese.segment` hands
 * every letter run to `Intl.Segmenter`, and ICU's dictionary does not know the
 * head noun at all:
 *
 * ```
 * 比特       → ["比", "特"]              每秒 → ["每秒"]
 * 比特每秒   → ["比", "特", "每秒"]
 * 兆比特每秒 → ["兆", "比", "特", "每秒"]
 * ```
 *
 * 比特 is a phonetic loan — 比 "compare" and 特 "special", two ordinary
 * characters borrowed for their sound — which is exactly the kind of word a
 * frequency-trained dictionary does not hold together. So this is the rare
 * vocabulary in this repo with **no Chinese alias on any unit**: not an
 * oversight, but the honest consequence of a word the lexer could never hand to
 * the index. An alias that can never be reached is dead weight rather than
 * documentation. `zh.test.ts` re-runs the splits, so a dictionary update that
 * learns 比特 surfaces as a failing test and three new aliases.
 *
 * **兆 is the near miss, and it is claimed next door.** 「100兆宽带」 is a
 * hundred-megabit line and is what a Chinese broadband advert says, so the bare
 * prefix is genuinely this kind's word too. It goes to `@smartput/datasize`
 * instead, and the reasoning belongs on both sides: the alias index has no kind
 * in its key, so exactly one kind can own the standalone reading of 兆, and
 * standing alone after a number — 「这个文件20兆」 — it is a file size. The
 * broadband sense never stands alone; it is always followed by 宽带 or 光纤,
 * which lex as separate words and end the parse whichever kind claimed the
 * prefix. So `datasize` takes the character and this kind loses nothing it could
 * have used.
 *
 * **The symbols are Latin, and that is Chinese rather than a fallback.** China
 * writes a network rate exactly as the rest of the world does — 「下行速率最高
 * 1Gbps」 on a fibre contract, 「100Mbps」 on a switch — and has no Han
 * abbreviation for it. Ruling R8 says to use the language's own abbreviation
 * *where the language actually abbreviates* and never to invent one, and coining
 * 「比特每秒」 as a symbol would be exactly that. The SI casing is kept
 * (lowercase kilo, capital mega and up) because it is what a Chinese page prints;
 * the alias index folds case, so "Mbps" and "mbps" are one key and the casing
 * costs nothing.
 *
 * `aliases` derives from `units.ts` through `aliasesFor` rather than being
 * written out a second time, so the micro path (`parseDatarate`) and the engine
 * path agree by construction.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "datarate",
  units: {
    bps: { aliases: alias("bps"), symbol: "bps" },
    kbps: { aliases: alias("kbps"), symbol: "kbps" },
    mbps: { aliases: alias("mbps"), symbol: "Mbps" },
    gbps: { aliases: alias("gbps"), symbol: "Gbps" },
    tbps: { aliases: alias("tbps"), symbol: "Tbps" },
  },
});
