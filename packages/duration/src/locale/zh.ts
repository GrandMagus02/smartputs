import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Chinese words for the duration units.
 *
 * `zh` is the bare tag and means what CLDR means by it — Simplified Chinese,
 * mainland conventions. Traditional orthography would be `zh-Hant` and a file of
 * its own if anyone ever wants one; four of the six words below are written
 * identically in both scripts, and only 时 (Traditional 時) and 钟 (鐘) differ.
 *
 * The kind next door names no language at all: six ratios, six unit ids and the
 * magnitude bands `typical` records. This file names `duration` by **id string**
 * rather than importing the kind, so `@smartput/duration/locale/zh` links no
 * ratio table; `composeLocale` is where the two halves meet.
 *
 * **Every unit declares a one-row `forms` table, and one row is the finished
 * answer rather than a stub someone should come back and fill in.**
 * `chinese.selectForm` returns the constant `"other"` for every count and every
 * slot — Chinese marks number nowhere on a noun, 一秒 and 五秒 and 一百万秒
 * differ in the numeral and nowhere else, and CLDR agrees
 * (`Intl.PluralRules("zh").resolvedOptions().pluralCategories` is the
 * single-element `["other"]`). A table translated from `en.ts` needs no key
 * renamed; it needs its `"one"` row deleted. Rule 6 wants the key set to be
 * exactly what `selectForm` can produce, and here that set has one member.
 *
 * **This kind is the one that gets to declare that row on every unit, and it is
 * a measurement rather than a preference.** Chinese is unspaced, so
 * `chinese.segment` hands every letter run to `Intl.Segmenter` and ICU's
 * dictionary decides where a word ends. It cuts most of this repo's Chinese unit
 * names — 字节 into 字 + 节, 千焦 into 千 + 焦 — but it returns all six of these
 * whole:
 *
 * ```
 * 毫秒 → ["毫秒"]   秒 → ["秒"]   分钟 → ["分钟"]
 * 小时 → ["小时"]   天 → ["天"]   周   → ["周"]
 * ```
 *
 * So every one of them can be printed *and* read back, which is the property
 * ruling §9 is about and the one `assertLocaleContract` cannot check for itself:
 * it consults the alias index, and the alias index never sees the segmenter.
 * `zh.test.ts` re-runs the six splits so an ICU dictionary update that changes
 * one surfaces as a failing test.
 *
 * **The symbols are the Latin SI ones**, and that is Chinese rather than a
 * fallback. A Chinese datasheet, lab report or spreadsheet writes "5 s", "30
 * min", "24 h" exactly as an English one does — the SI symbols are the national
 * standard (GB 3100) and are not translated — while running prose writes 秒,
 * 分钟, 小时. Both registers are real, so the word goes in `forms` (where it is
 * printed) and the symbol stays on `symbol` (where R8 wants every unit's written
 * abbreviation). The symbol never reaches output, since a form outranks a symbol
 * in `renderQuantity`, and it stays readable because `aliasesFor` already lists
 * it.
 *
 * The one place a *Chinese* abbreviation exists is 分钟 → 分 and 小时 → 时, and
 * neither is promoted to `symbol`. 分 is read but not printed: standing after a
 * number it is a minute here and a *mark* in a school report and a fraction
 * elsewhere, and 时 alone is the hour of a clock rather than a length of one —
 * the same call `ja.ts` makes when it leaves 時 to `datetime` and prints the
 * suffixed 時間. Printing the unambiguous long form and reading the short one
 * costs nothing and can never be misread.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, so the micro path (`parseDuration`) and the engine
 * path agree by construction — including the "m" that means minutes here and
 * metres in `length`, an ambiguity that is the solver's to rank and not this
 * file's to remove. The Chinese spellings are appended: nobody switches input
 * mode to type a unit, and 「2小时」 and "2 h" are the same sentence.
 *
 * Three of the appended spellings are genuine second words rather than
 * inflections, which Chinese has none of. 日 is the formal/written day beside the
 * colloquial 天 (3日 on a form, 3天 in speech); 星期 is the full word for the week
 * that 周 abbreviates; and 分 is the short minute described above. All are read;
 * only 天 and 周 are printed, because those are the two an ordinary sentence
 * uses. 礼拜 — the third Chinese word for a week — is left out: it is spoken
 * rather than written, and 拜 is `tempo`'s neighbour 拍 close enough in a
 * fuzzy-matched index to be worth not adding for a register nobody types.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "duration",
  units: {
    ms: { aliases: [...alias("ms"), "毫秒"], symbol: "ms", forms: { other: "毫秒" } },
    s: { aliases: [...alias("s"), "秒"], symbol: "s", forms: { other: "秒" } },
    // 分 is read and never printed — after a number it is a minute here, a mark
    // on a test elsewhere, and a fraction in 三分之一. 分钟 is unambiguous.
    min: {
      aliases: [...alias("min"), "分钟", "分"],
      symbol: "min",
      forms: { other: "分钟" },
    },
    // 小时 and never the bare 时: 「3时」 is three o'clock, a point on a clock
    // rather than a length of time, and `datetime` is the kind that reads it.
    h: { aliases: [...alias("h"), "小时"], symbol: "h", forms: { other: "小时" } },
    d: { aliases: [...alias("d"), "天", "日"], symbol: "d", forms: { other: "天" } },
    wk: {
      aliases: [...alias("wk"), "周", "星期"],
      symbol: "wk",
      forms: { other: "周" },
    },
  },
});
