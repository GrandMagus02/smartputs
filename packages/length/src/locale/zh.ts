import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `ja` and the rest of this folder make, kept here
 * for only the second of their two reasons — and that reason is enough on its
 * own.
 *
 * Chinese's own conversion words are 换算, 转换, 到 and 为
 * (`@smartput/core/locale/zh`), so `in` is *not* a keyword token in an engine
 * that speaks only Chinese and the first half of the English argument does not
 * apply. The second half does, and it is locale-blind by construction:
 * `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
 * without consulting a locale, so a Chinese entry for `in` would put the word
 * back in front of `@smartput/datetime`'s accept-gate — which refuses any phrase
 * whose words are *all* unit aliases — for any engine that also speaks English,
 * and make "in 3 days" an all-units phrase again.
 *
 * A Chinese reader types 英寸, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Chinese words for the length units — Simplified, mainland conventions, which
 * is what the bare tag `zh` means throughout this repo. All eight units have
 * Chinese words and all eight print them.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `chinese.selectForm` returns the constant `"other"` for every count and every
 * slot: Chinese marks number nowhere on a noun, 一米 and 五米 and 一百万米 are
 * the same character, and a fraction and a conversion target move it no further.
 * CLDR agrees — `Intl.PluralRules("zh")` declares the single category `"other"`
 * — so rule 6's "exactly the keys `selectForm` can produce" is satisfied by one
 * row. **That one row is the correct answer and not a stub**: this table is
 * `en`'s with the `"one"` row deleted, nothing renamed, and against Ukrainian's
 * eight keys it is the language rather than a translator stopping halfway.
 *
 * **The metric four are compounds, and Chinese builds them out of the same
 * prefixes English does** — 毫, 厘, 千 in front of 米 — so they look like the
 * German compounds `compoundSplitter` exists for and are nothing of the kind.
 * There is no splitter in `chinese.analyze` and no need for one: ICU returns
 * 毫米, 厘米 and 公里 whole, so each reaches the alias index as one token and is
 * claimed by an exact entry at weight 0. Nothing has to outrank a morpheme here,
 * because nothing ever finds one. That is measured rather than assumed, and
 * `zh.test.ts` pins every printed word: ICU cuts 平方厘米 into 平方 + 厘米, which
 * is why `@smartput/area/locale/zh` cannot print the word for a square
 * centimetre at all.
 *
 * **公里 is printed for the kilometre where `@smartput/mass/locale/zh` prints
 * the standard 千克 for the kilogram, and the split is deliberate.** 公里 and
 * 千米 are the same unit, and 公里 is what road signs, athletics and ordinary
 * writing use by a wide margin, while 千米 lives in textbooks; 千克 and 公斤 are
 * far more evenly matched, so mass keeps the standard name that pairs with its
 * own 毫克 and 克. ICU then settles the matter from the other side: it returns
 * 平方公里 whole and cuts 平方千米 into 平方 + 千米, so the square kilometre next
 * door can only be printed as 平方公里 — and a length table printing 千米 beside
 * an area table printing 平方公里 would be two registers describing one
 * dimension. Both names are read; only one is written.
 *
 * The bare prefixes 毫, 厘 and 千 are deliberately **not** listed. They are not
 * words on their own the way English "kilo" is — 千 is the numeral one thousand,
 * declared as such in `@smartput/core/locale/zh-cardinals`, and `foldNumerals`
 * turns a standalone numeral word into a number token before any vocabulary is
 * consulted — so an entry for it could not be reached even if Chinese said it.
 *
 * `symbol` is the SI abbreviation on the four metric units, which is what
 * Chinese itself writes (a Chinese map is labelled 5 km, never with a kana- or
 * hanzi-style short form), and the spelled noun on the four imperial ones.
 * Chinese abbreviates none of those in the Latin script; where a one-character
 * short form exists it is 吋/呎/哩, which are listed below as aliases and not as
 * symbols, because they are the Taiwanese orthography rather than the mainland
 * one this file writes. For the inch the Latin short form would be `in`, which
 * this file has just reserved. R8 wants an explicit symbol on every unit, never
 * an unreadable one.
 *
 * **The traditional market units are absent**, and that is the same judgement
 * `@smartput/mass/locale/zh` makes about 斤. 里 is the market li — 500 m, not a
 * mile — and 尺 and 寸 are the 市尺 and 市寸 of the same system; this kind
 * declares no unit for any of them, so they stay out rather than being bent onto
 * the nearest ratio. 里 is the sharper case, because it is a *substring* of 公里
 * and 英里 rather than an unrelated word: `chinese.analyze` is `identity()`
 * alone precisely so that no stripper can take a character off 公里 and land on
 * a unit this kind never declared.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a Chinese engine and
 * the micro path (`parseLength`) cannot drift from it.
 *
 * Like `en`, this file names `length` by **id string** and never imports the
 * kind, which is what lets `@smartput/length/locale/zh` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "length",
  units: {
    // 公厘 completes the 公- series this table already reads at cm and m. It is
    // the Taiwanese name for the millimetre exactly as 公分 is for the
    // centimetre and 公尺 for the metre, it survives ICU whole, and leaving it
    // out was an omission rather than the decision the two rows below record:
    // a reader who writes 公分 and 公尺 writes 公厘 in the same breath, and the
    // mass and volume tables next door already read the whole of their own
    // series (公克, 公斤, 公吨, 公升). Read, never written, on this file's split.
    mm: {
      aliases: [...alias("mm"), "毫米", "公厘"],
      symbol: "mm",
      forms: { other: "毫米" },
    },
    // 公分 is the Taiwanese name for the same unit and is read, never written,
    // on the split this file's doc comment describes.
    cm: {
      aliases: [...alias("cm"), "厘米", "公分"],
      symbol: "cm",
      forms: { other: "厘米" },
    },
    m: {
      aliases: [...alias("m"), "米", "公尺"],
      symbol: "m",
      forms: { other: "米" },
    },
    km: {
      aliases: [...alias("km"), "公里", "千米"],
      symbol: "km",
      forms: { other: "公里" },
    },
    // The unit whose English abbreviation this file reserved away. 英寸 is both
    // the word and the symbol, which is what Chinese writes for it: a Chinese
    // screen is 27英寸 and never 27 in.
    in: {
      aliases: [...alias("in"), "英寸", "吋"],
      symbol: "英寸",
      forms: { other: "英寸" },
    },
    ft: {
      aliases: [...alias("ft"), "英尺", "呎"],
      symbol: "英尺",
      forms: { other: "英尺" },
    },
    // 码 is one character and is the whole word, unlike its three imperial
    // neighbours, which all carry the 英- ("English") prefix that marks a
    // foreign unit. It is kept as the printed form anyway: 码 after a number is
    // a yard in every register Chinese has, and the compound 英码 is not a word
    // anybody writes.
    yd: {
      aliases: [...alias("yd"), "码"],
      symbol: "码",
      forms: { other: "码" },
    },
    mi: {
      aliases: [...alias("mi"), "英里", "哩"],
      symbol: "英里",
      forms: { other: "英里" },
    },
  },
});
