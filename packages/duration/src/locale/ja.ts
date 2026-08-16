import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Japanese words for the duration units.
 *
 * `ja` is the bare tag, modern standard Japanese in its ordinary mixed
 * orthography. The kind next door names no language at all — it is six ratios,
 * six unit ids and the magnitude bands `typical` records — and this file names
 * `duration` by **id string** rather than importing it, so
 * `@smartput/duration/locale/ja` links no ratio table. `composeLocale` is where
 * the two halves meet.
 *
 * **No unit declares `forms`, and for a reason that is the opposite of the usual
 * one.** Everywhere else in this repo a missing `forms` table means the written
 * word is a compound the lexer cannot take back — "kilometres per hour",
 * "мегабіт на секунду". Here it means the written word is *already* the symbol.
 * Japanese names these five units with one character each — 秒, 分, 時間, 日,
 * 週間 — and those characters are what a Japanese sentence prints, what a clock
 * face prints and what a spreadsheet prints. There is no longer form to spell
 * out and nothing to abbreviate, so R8's `symbol` carries both jobs and a
 * `forms` table would be the same string written a second time. The output is
 * identical either way — `japanese.renderQuantity` puts no space between a
 * number and its label on any branch — so the redundant table would be a second
 * place for one word to be edited wrong.
 *
 * That is also why this file has no `forms: { other: … }` row to show even
 * though `ja` needs only one: the language's single key is real (Japanese nouns
 * do not inflect for number, and `Intl.PluralRules("ja")` declares the single
 * category `other`), it simply has nothing to select between here.
 *
 * **`ms` is the exception and the measurement behind it is worth recording.**
 * Japanese does have a word for the millisecond, 「ミリ秒」, and it cannot be
 * used. Japanese is unspaced, so `japanese.segment` hands each letter run to
 * `Intl.Segmenter`, and ICU cuts ミリ秒 into ミリ + 秒 — the SI prefix is not in
 * its dictionary as part of this word. A vocabulary that printed 「5ミリ秒」
 * would have it come back as two tokens, of which 秒 is the *second* and would
 * silently read as five seconds if anything read it at all. So `ms` keeps the
 * Latin symbol, which is what a Japanese datasheet writes anyway, and ミリ秒 is
 * absent from `aliases` rather than listed as dead weight. `ja.test.ts` re-runs
 * that segmentation, so a future ICU dictionary that learns the word surfaces as
 * a failing test rather than as a gap nobody notices.
 *
 * **Aliases.** The Latin set comes from `units.ts` through `aliasesFor` rather
 * than being retyped, so the micro path (`parseDuration`) and the engine path
 * agree by construction — including the "m" that means minutes here and metres
 * in `length`, an ambiguity that is the solver's to rank and not this file's to
 * remove. The Japanese spellings are appended: nobody switches input mode to
 * type a unit, and 「2時間」 and "2 h" are the same sentence.
 *
 * Two of them are genuine second spellings rather than inflections, which
 * Japanese has none of. 「日間」 is 日 with the counter-suffix that marks a
 * *span* rather than a date — 「3日間」 is three days long, where 「3日」 alone
 * can be read as the third of the month — and 「週」 is 週間 with that same
 * suffix taken off, which is what a heading or a table column writes. Both are
 * read; only the unsuffixed 日 and the suffixed 週間 are printed, because those
 * are the spellings that are unambiguous in the position a printer puts them —
 * immediately after a number.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "duration",
  units: {
    ms: { aliases: alias("ms"), symbol: "ms" },
    s: { aliases: [...alias("s"), "秒"], symbol: "秒" },
    min: { aliases: [...alias("min"), "分"], symbol: "分" },
    // 時間 and never the bare 時: 「3時」 is three o'clock, a point on a clock
    // rather than a length of time, and `datetime` is the kind that reads it.
    h: { aliases: [...alias("h"), "時間"], symbol: "時間" },
    d: { aliases: [...alias("d"), "日", "日間"], symbol: "日" },
    wk: { aliases: [...alias("wk"), "週間", "週"], symbol: "週間" },
  },
});
