import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { PERCENT_UNITS, type PercentUnit } from "../units";

const alias = (unit: PercentUnit) => aliasesFor(PERCENT_UNITS, unit);

/**
 * Korean words for the percent unit — the same one unit `en`, `uk` and `ja` name,
 * and the same decision about whether it has word forms at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the one
 * alias map in `units.ts`, so "20 pct" keeps working in a Korean engine and the
 * micro path (`parsePercent`) cannot drift from it. Two Hangul words are appended
 * on top, and two is the whole of the Korean half where Ukrainian needed eighteen.
 * A Korean noun does not decline — 퍼센트 is 퍼센트 in every position, singular and
 * plural, subject and object alike — so there is no paradigm to spell out. What
 * looks like an ending in Korean is a *particle*, a separate morpheme that happens
 * to be written closed up, and `korean.analyze` peels those off with
 * `particleStripper` rather than with a suffix list.
 *
 * **퍼센트 and 프로, and the difference between them is register rather than
 * meaning.** 퍼센트 is the transcription of "percent" and what a written text uses.
 * 프로 is the same unit borrowed a second time by a different road — from
 * Dutch *procent* through Japanese プロ — and it is what Korean *speech* uses:
 * 「이십 프로」 is as ordinary spoken as 「이십 퍼센트」 is written, and both get
 * typed into a converter. Neither is printed (see below), so listing both costs
 * one line on the read side and claims nothing about output.
 *
 * **Three near neighbours are deliberately absent**, each for its own reason and
 * none of them taste:
 *
 *   - `％` (U+FF05, fullwidth) is what a Korean IME produces from the `%` key in
 *     a fullwidth mode, and it is *already* read: `normalize()` runs NFKC before a
 *     word reaches any index, and NFKC folds `％` to `%`. Listing it would be a
 *     dead entry that reads as coverage — the same trap
 *     `@smartput/temperature/locale/uk` records for its Cyrillic `°С`.
 *   - 백분율 ("percentage") is the name of the *concept*, the way English
 *     "percentage" is. Nobody writes 「20백분율」, and an alias is a thing that
 *     follows a number.
 *   - 할 is the real omission and the interesting one, and it is Korean's own
 *     copy of the problem `ja` records for 割: it is the ordinary way of saying a
 *     proportion in sport and in commerce — 「3할」 is 30% — but it is a *tenth*,
 *     not a hundredth, and so are 푼 (1%) and 리 (0.1%) below it. They are three
 *     more units of this kind with three more ratios, and a `Vocabulary` may only
 *     name units the kind declares (rule 2: a kind is ratios and unit ids). This
 *     is reported rather than faked: giving 할 the ratio 0.01 would read 「3할」 as
 *     3% instead of 30%, which is a wrong number and not a missing word.
 *
 * **No `forms`, exactly as `en`, `uk` and `ja` carry none**, and under `ko` that
 * is one row omitted rather than eight — `korean.selectForm` returns the constant
 * `"other"`. The reason is `en`'s and it survives translation intact: the written
 * form of this unit is the symbol. 「20%」 is what a percentage looks like in a
 * Korean result line as much as in an English one, and a `forms` table would make
 * every percentage in this engine's output read as 「20퍼센트」 — longer, and not
 * what anyone would type back. Reading 「20퍼센트」 still works, and answers 20%.
 *
 * `symbol` is explicit all the same (ruling R8), and it carries more weight here
 * than under `en`: `korean.renderQuantity` closes the gap on every branch, so a
 * unit that forgot its symbol would degrade to the bare unit key rather than move
 * a space. `%` needs no translation — it is written the same in every script, and
 * Korean sets it tight against its number the way it sets every unit.
 *
 * One Korean-only detail worth recording, because it is the thing that makes the
 * word usable in a real sentence: the directional particle 로 arrives *glued* to
 * the unit — 「퍼센트로」, "into percent" — and it is `particleStripper` that
 * recovers 퍼센트 from it, on the euphonic condition 트 is an open syllable so 로
 * (and not 으로) is the right shape. Nothing in this file has to say so; it is
 * listed here because a translator adding a word to a Korean vocabulary needs to
 * know that the particles are already handled and must not be baked into aliases.
 *
 * Like `en`, this file names `percent` by **id string** and never imports the
 * kind, which is what lets `@smartput/percent/locale/ko` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "percent",
  units: {
    "%": { aliases: [...alias("%"), "퍼센트", "프로"], symbol: "%", tight: true },
  },
});
