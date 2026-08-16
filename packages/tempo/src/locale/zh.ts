import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { TEMPO_UNITS, type TempoUnit } from "../units";

const alias = (unit: TempoUnit) => aliasesFor(TEMPO_UNITS, unit);

/**
 * Chinese words for the tempo units.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions. Shaped exactly like `en.ts` beside it, down to naming
 * `tempo` by **id string** rather than importing the kind: that is what lets this
 * file be imported without linking the ratio table or the reciprocal bridge to
 * `duration`, and it is the seam `composeLocale` closes. `aliases` still derives
 * the Latin set from `units.ts` through `aliasesFor` — a Chinese producer types
 * "120 bpm" as readily as anything — and the Chinese spellings are appended, so a
 * `zh` engine reads both scripts.
 *
 * **`hz` declares one form where `en.ts` needed two identical ones**, and that is
 * the whole `zh` contract in a single row. `chinese.selectForm` returns the
 * constant `"other"` for every count and every slot: Chinese marks number nowhere
 * on a noun — 一赫兹 and 五赫兹 differ in the numeral and nowhere else — and CLDR
 * agrees, `Intl.PluralRules("zh")` declaring the single category `other`. English
 * happened to need two rows holding the same word because "hertz" is its own
 * plural; Chinese needs one row because there is no plural to hold. A one-row
 * table is the correct and finished answer here, not a stub someone should come
 * back and fill in — rule 6 asks for exactly the keys `selectForm` can produce,
 * and that set has one member.
 *
 * 赫兹 is printable as well as readable, which in an unspaced language is a
 * measurement rather than an assumption. Chinese does not space its words, so
 * `chinese.segment` hands every letter run to `Intl.Segmenter` and ICU's
 * dictionary decides where a word breaks; it returns 赫兹 whole, the way it
 * returns 卡路里 and 马力 whole and unlike 字节 or 兆瓦, which it cuts. So
 * 「50赫兹」 prints and reads straight back. `zh.test.ts` re-runs that
 * segmentation rather than trusting this paragraph.
 *
 * The symbol is "Hz" — the SI spelling, which China writes unchanged on every
 * appliance nameplate in the country (市电 220V 50Hz). It never reaches output,
 * since a form outranks a symbol in `renderQuantity`, and it is recorded because
 * R8 wants every unit's written abbreviation on the unit; case folds in the alias
 * index, so "Hz" and "hz" are one key and the casing costs nothing.
 *
 * 赫 alone is left out. It is a real abbreviation *inside* a compound — 千赫 and
 * 兆赫 are kHz and MHz, and ICU returns both whole — but standing on its own after
 * a number it is a surname before it is a unit, and this kind has no kHz or MHz
 * unit for the two compounds to name in any case. That absence is `units.ts`'s
 * business and not this file's: a kind is ratios and unit ids, and rule 2 says to
 * report rather than to reach across.
 *
 * **`bpm` keeps no `forms`, for the reason `en.ts` gives and one of its own.**
 * English refuses them because "beats per minute" is a compound the lexer cannot
 * read back; the Chinese is 「每分钟…拍」 — literally "per-minute … beats" — which
 * is worse than a compound, because it is *discontinuous*: the rate phrase comes
 * before the number and the counter after it, and no vocabulary entry can put a
 * label on both sides of its own quantity. The one continuous spelling, 每分钟拍数,
 * is cut by ICU into four pieces (每 | 分钟 | 拍 | 数), of which 分钟 is
 * `@smartput/duration`'s minute. What Chinese writes instead is "BPM", in Latin,
 * and that is what this file prints.
 *
 * 拍 is listed as an alias, and it is the same elision `datasize`'s 兆 and
 * Ukrainian's уд rest on: the counter standing for the whole rate, with the
 * per-minute understood. It is one character, so the lexer takes it and ICU
 * returns it whole, and 「120拍」 is what a Chinese score or a drummer's forum
 * post writes. Only "bpm" comes back out, because a symbol must be the spelling
 * that is unambiguous with no context around it, and a bare 拍 is a count of beats
 * — or a clap, or a racket — as readily as a tempo.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "tempo",
  units: {
    bpm: { aliases: [...alias("bpm"), "拍"], symbol: "bpm" },
    hz: {
      aliases: [...alias("hz"), "赫兹"],
      symbol: "Hz",
      forms: { other: "赫兹" },
    },
  },
});
