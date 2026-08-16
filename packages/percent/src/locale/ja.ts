import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Japanese words for the percent unit — the same one unit `en` and `uk` name,
 * and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "20 pct" keeps working in a Japanese engine and
 * the micro path (`parsePercent`) cannot drift from it. パーセント is appended on
 * top, and it is the whole of the Japanese half — one word, where Ukrainian
 * needed eighteen. Japanese nouns do not decline, so there is no paradigm to
 * spell out and nothing for a suffix stripper to fall back from; `japanese.analyze`
 * is `[identity()]` for exactly that reason.
 *
 * **Only the katakana loanword, and three near neighbours are deliberately
 * absent.** Each is left out for a different reason, and none of them is taste:
 *
 *   - `％` (U+FF05, fullwidth) is what a Japanese IME produces from the `%` key,
 *     and it is *already* read: `normalize()` runs NFKC before a word reaches any
 *     index, and NFKC folds `％` to `%`. Listing it would be a dead entry that
 *     reads as coverage — the same trap `@smartput/temperature/locale/uk` records
 *     for its Cyrillic `°С`.
 *   - 百分率 ("percentage") is the name of the *concept*, the way English
 *     "percentage" is. Nobody writes 「20百分率」, and an alias is a thing that
 *     follows a number.
 *   - 割 is the real omission and the interesting one. It is the ordinary
 *     Japanese way of saying a proportion — 「3割」 is 30% — but it is a *tenth*,
 *     not a hundredth, and so are 分 (1%) and 厘 (0.1%) below it. They are three
 *     more units of this kind with three more ratios, and a `Vocabulary` may only
 *     name units the kind declares (rule 2: a kind is ratios and unit ids). This
 *     is reported rather than faked: giving 割 the ratio 0.01 would read
 *     「3割」 as 3% instead of 30%, which is a wrong number and not a missing word.
 *
 * **No `forms`, exactly as `en` and `uk` carry none**, and under `ja` that is one
 * row omitted rather than eight — `japanese.selectForm` returns the constant
 * `"other"`. The reason is `en`'s and it survives translation intact: the written
 * form of this unit is the symbol. 「20%」 is what a percentage looks like in a
 * Japanese result line as much as in an English one, and a `forms` table would
 * make every percentage in this engine's output read as 「20パーセント」 — longer,
 * and not what anyone would type back. Reading 「20パーセント」 still works, and
 * answers 20%.
 *
 * `symbol` is explicit all the same (ruling R8), and it carries more weight here
 * than elsewhere: `japanese.renderQuantity` closes the gap on every branch, so a
 * unit that forgot its symbol would degrade to the bare unit key rather than move
 * a space. `%` needs no translation — it is written the same in every script, and
 * Japanese sets it tight against its number the way it sets every unit.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/ja` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "percent",
  units: {
    "%": { aliases: [...alias("%"), "パーセント"], symbol: "%" },
  },
});
