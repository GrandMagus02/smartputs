import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ANGLE_UNITS, type AngleUnit } from "../units";

const alias = (unit: AngleUnit) => aliasesFor(ANGLE_UNITS, unit);

/**
 * Chinese words for the angle units — Simplified, mainland conventions, which is
 * what the bare tag `zh` means throughout this repo. Three of the four print a
 * Chinese word, and the fourth is refused twice over.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `chinese.selectForm` returns the constant `"other"` for every count and every
 * slot: Chinese marks number nowhere on a noun, so 一度 and 五度 differ in the
 * numeral and nowhere else, and neither a fraction nor a conversion target moves
 * it. CLDR agrees — `Intl.PluralRules("zh")` declares the single category
 * `"other"` — so rule 6's closed key set is one row. **A one-row table is the
 * correct answer and not a stub**: it is `en`'s with the `"one"` row deleted,
 * nothing renamed, and against Ukrainian's eight keys it is the language rather
 * than a translator stopping halfway.
 *
 * **The radian prints its Chinese word here, where `@smartput/angle/locale/ja`
 * cannot.** Japanese for a radian is ラジアン and ICU cuts it into ラジ + アン;
 * Chinese is 弧度 — the same two characters Japanese keeps as a formal
 * alternative — and ICU returns it whole. Measured, and pinned in `zh.test.ts`,
 * because segmentation is the *only* thing between a letter run and the alias
 * index in a language that writes no spaces: a word ICU's dictionary does not
 * know reaches `lex` as two word tokens and can never be read back however well
 * it is spelled.
 *
 * **The gradian is the unit that pays for that check, and it is refused for two
 * independent reasons rather than one.** Chinese names it 百分度 or 新度, and ICU
 * cuts both — 百分 + 度 and 新 + 度 — so neither can be printed or usefully
 * listed, on the rule `@smartput/angle/locale/ja` states for ラジアン: an alias
 * `lex` can never produce is dead weight in the index, and completion would
 * happily offer it and hand the user text that fails to evaluate. And 梯度, the
 * word that *does* come back whole and is the one a search would surface first,
 * is not this unit at all: it is the mathematical gradient — the vector of
 * partial derivatives — and printing it would be a confident wrong answer where
 * an unprintable one is merely a quiet gap. So `grad` carries no `forms` and
 * renders through its symbol, `200grad`, which round-trips because a Latin run
 * has no character of a declared script and `scriptSegmenter` returns it whole.
 *
 * `symbol` is what Chinese itself writes. 度 is a genuine abbreviation and a
 * genuine word at once — Chinese writes 90度 and reads it as the full noun — so
 * the symbol and the form are one string here rather than two registers of one
 * unit the way kg and 千克 are in `@smartput/mass/locale/zh`. The degree sign °
 * is what a Chinese page sets for an angle as readily as an English one, and it
 * is deliberately **not** the symbol: ° is not a letter, so `lex` skips it as
 * unrecognised punctuation and 90° would read as a bare 90.
 * `@smartput/angle/locale/uk` chose it anyway; a language whose own word is a
 * single character does not have to. R8 wants an explicit symbol on every unit,
 * never an unreadable one.
 *
 * 周 is left out of `turn`, and this is a judgement about collision rather than
 * about meaning. It is a correct word for a full revolution (地球公转一周), and
 * it is also the ordinary word for a *week*, which a Chinese duration vocabulary
 * will want and which `@smartput/datetime` would then have to separate from an
 * angle with nothing but weight. 圈 and 转 are unambiguous after a number and
 * carry the reading between them.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 rad" keeps working in a Chinese engine and
 * the micro path (`parseAngle`) cannot drift from it.
 *
 * Like `en`, this file names `angle` by **id string** and never imports the
 * kind, which is what lets `@smartput/angle/locale/zh` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "angle",
  units: {
    rad: {
      aliases: [...alias("rad"), "弧度"],
      symbol: "弧度",
      forms: { other: "弧度" },
    },
    deg: {
      aliases: [...alias("deg"), "度"],
      symbol: "度",
      forms: { other: "度" },
    },
    // The one unit in this package with no `forms` at all. See the doc comment
    // above: both Chinese names are cut in two by ICU, and the word that
    // survives segmentation means something else.
    grad: {
      aliases: alias("grad"),
      symbol: "grad",
    },
    // 转 is the word a tachometer is calibrated in (转/分, rpm) and is read here
    // but not written: it is also the first character of the conversion keyword
    // 转换, and printing 3转 beside an input that says 转换为 would put the same
    // character in two roles in one line. 圈 has no such second job.
    turn: {
      aliases: [...alias("turn"), "圈", "转"],
      symbol: "圈",
      forms: { other: "圈" },
    },
  },
});
