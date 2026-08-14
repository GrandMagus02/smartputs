import { aliasesFor, defineVocabulary } from "@smartput/core";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Chinese words for the percent unit — the same one unit `en`, `uk` and `ja`
 * name, and the only one of the four vocabularies that ends up adding no word at
 * all.
 *
 * `zh` is the bare tag and means what CLDR means by it: Simplified Chinese,
 * mainland conventions.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Chinese engine and
 * the micro path (`parsePercent`) cannot drift from it. Nothing is appended on
 * top, and that is the finding rather than an unfinished file — every Chinese way
 * of saying a percentage is unreachable, each for a different and measured
 * reason.
 *
 * **百分之 is the word, and it goes in front of the number.** 20% is read and
 * written 百分之二十 — literally "of a hundred parts, twenty" — so the unit
 * *precedes* its count. An `alias` is a token that follows a number, and a
 * `forms` entry is a string `renderQuantity` appends after one, so there is no
 * seam in this engine a prefix unit fits through: listing 百分之 would only ever
 * be reachable as 「20百分之」, which is not Chinese. It is unreachable twice over
 * besides — ICU cuts it into 百分 | 之, so `chinese.segment` could never produce
 * it as a lookup key, and `zh.test.ts` pins the cut so the day ICU changes its
 * mind this is a failing assertion rather than a stale comment. This is the same
 * shape `@smartput/temperature/locale/ja` records for 摂氏 and the same one
 * `zh.ts` records next door for 摄氏, and it is why the Chinese half of this
 * package is empty where the Japanese half had one katakana loanword.
 *
 * **百分比 and 百分点 are the concept and the neighbouring unit.** 百分比
 * ("percentage") survives ICU whole and is still not an alias, for `ja`'s reason
 * about 百分率: it is the name of the *ratio*, the way English "percentage" is,
 * and nobody writes 「20百分比」. 百分点 is the percentage *point* — a difference
 * between two percentages rather than a percentage — and ICU cuts it into
 * 百分 | 点 anyway.
 *
 * **成 and 折 are two more units, not two more spellings.** 三成 is 30% and 八折
 * is 80%: both are counted in *tenths*, so each is a unit of this kind with a
 * ratio this kind does not declare, and a `Vocabulary` may only name units the
 * kind declares (rule 2 — a kind is ratios and unit ids). This is reported rather
 * than faked, exactly as `@smartput/percent/locale/ja` reports 割: giving 成 the
 * ratio 0.01 would read 三成 as 3% instead of 30%, which is a wrong number and
 * not a missing word. 折 is worse still and `core/locale/zh.ts` already declines
 * it as the `off` keyword for the same reason — 八折 names the price that
 * *remains*, so the eight is 80 where a discount operator wants 20.
 *
 * **趴 is Taiwanese and this file is not.** It is the one genuinely post-numeral
 * Chinese word for a percentage — 「20趴」, borrowed through Japanese パーセント —
 * and it belongs to Taiwan Mandarin. Under the bare `zh` tag, which is mainland
 * Simplified, 趴 is the ordinary verb "to lie face down", and claiming it would
 * buy a regional reading with a common word. A `zh-TW` vocabulary is where it
 * belongs, and adding one is a file rather than a code change.
 *
 * **No `forms`, exactly as all three siblings carry none**, and under `zh` that
 * is one row omitted rather than eight — `chinese.selectForm` returns the
 * constant `"other"`, because Chinese marks number nowhere on a noun. `en`'s
 * reason survives translation intact and is joined by the word-order one above:
 * the written form of this unit is the symbol. 「20%」 is what a percentage looks
 * like in a Chinese result line as much as in an English one, and the only word
 * a `forms` table could hold would print on the wrong side of the number.
 *
 * `symbol` is explicit all the same (ruling R8), and it carries more weight here
 * than under `en`: `chinese.renderQuantity` closes the gap on every branch, so a
 * unit that forgot its symbol would degrade to the bare unit key rather than move
 * a space. `%` needs no translation — it is written the same in every script, and
 * Chinese sets it tight against its number the way it sets every unit.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/zh` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "percent",
  units: {
    "%": { aliases: alias("%"), symbol: "%" },
  },
});
