import { aliasesFor, defineVocabulary } from "@smartput/core";
import { DATARATE_UNITS, type DatarateUnit } from "../units";

const alias = (unit: DatarateUnit) => aliasesFor(DATARATE_UNITS, unit);

/**
 * Japanese words for the datarate units.
 *
 * `ja` is the bare tag and means what CLDR means by it — modern standard
 * Japanese in its ordinary mixed orthography. The kind next door names no
 * language at all: it is ratios, unit ids, the magnitude bands `typical`
 * records, and four bridge signatures naming their operand kinds by string.
 * This file names `datarate` by **id string** rather than importing the kind,
 * which is what lets `@smartput/datarate/locale/ja` be imported without linking
 * the ratio table; `composeLocale` is where the two halves meet.
 *
 * **No `forms` on any unit**, which is the ruling `en.ts` records and which
 * Japanese arrives at by two independent roads.
 *
 * The first is the one English and Ukrainian give: a rate is a compound. The
 * Japanese for "megabits per second" is 「メガビット毎秒」, and 毎秒 ("per
 * second") is a word of its own that a `forms` table would have to print and
 * the lexer would have to read back as part of one unit token. It cannot.
 *
 * The second is measured rather than argued, and it is the fact that shapes
 * every `ja` vocabulary in this repo. `japanese.segment` hands a letter run to
 * `Intl.Segmenter`, and ICU's Japanese dictionary decides where a katakana
 * compound breaks. It does not break them consistently:
 *
 * ```
 * ビット        → ["ビット"]            one word
 * キロビット     → ["キロ", "ビット"]     two
 * メガビット     → ["メガビット"]         one word
 * ギガビット     → ["ギガ", "ビット"]     two
 * テラビット     → ["テラ", "ビット"]     two
 * メガビット毎秒 → ["メガビット", "毎秒"] two
 * ```
 *
 * So even a vocabulary willing to print 「5キロビット」 could not read it back:
 * the run reaches the resolver as キロ then ビット, and キロ is nobody's unit.
 * A printed form recovered by nothing is worse than an abbreviation that
 * round-trips, which is the whole of ruling §9, so the printer stays on the
 * symbol here and a Japanese rate prints "2000Mbps" — the tight shape
 * `japanese.renderQuantity` gives every quantity, with no space between the
 * number and the label.
 *
 * **The symbols are Latin, and that is Japanese rather than a fallback.**
 * Japan writes a network rate exactly as the rest of the world does —
 * 「下り最大1Gbps」 on a fibre contract, 「100Mbps」 on a switch — and has no
 * native abbreviation for it at all. Ruling R8 says to use the language's own
 * abbreviation *where the language actually abbreviates* and never to invent
 * one, and inventing 「ビット毎秒」 as a symbol would be exactly that. The SI
 * casing is kept (lowercase kilo, capital mega and up) because it is what a
 * Japanese page prints; the alias index folds case, so "Mbps" and "mbps" are one
 * key and the casing costs nothing.
 *
 * **The two katakana aliases, and why the other three are missing.** ビット and
 * メガビット are the two spellings ICU returns whole, so they are the two this
 * file can honestly claim. Both are the colloquial elision a Japanese speaker
 * already makes — 「うちは100メガ」 for a hundred megabits per second, the same
 * elision Ukrainian's "мбіт" and English's own "mbps" rest on, where the
 * per-second is understood rather than said. キロビット, ギガビット and
 * テラビット are absent not because nobody writes them but because the engine
 * could not read them if it did; the row above is the measurement, and
 * `ja.test.ts` re-runs it so that an ICU dictionary update which learns
 * ギガビット shows up as a failing test rather than as a silent gap.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "datarate",
  units: {
    bps: { aliases: [...alias("bps"), "ビット"], symbol: "bps" },
    kbps: { aliases: alias("kbps"), symbol: "kbps" },
    mbps: { aliases: [...alias("mbps"), "メガビット"], symbol: "Mbps" },
    gbps: { aliases: alias("gbps"), symbol: "Gbps" },
    tbps: { aliases: alias("tbps"), symbol: "Tbps" },
  },
});
