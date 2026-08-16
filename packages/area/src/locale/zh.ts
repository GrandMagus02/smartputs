import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Chinese words for the area units — Simplified, mainland conventions, which is
 * what the bare tag `zh` means throughout this repo. Four of the five print a
 * Chinese word; the fifth is the interesting one, and it is not the unit `en`
 * and `uk` had trouble with.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `chinese.selectForm` returns the constant `"other"` for every count and every
 * slot — Chinese marks number nowhere on a noun, and CLDR's
 * `Intl.PluralRules("zh")` declares the single category `"other"` — so rule 6's
 * closed key set is one row per unit. **A one-row table is the correct answer
 * and not a stub**: it is `en`'s table with the `"one"` row deleted and nothing
 * renamed, and it is the language rather than a translator stopping halfway.
 *
 * **The squared units are speakable here, where `en` and `uk` refuse them — but
 * only two of the three are printable, and ICU decides which.** The English
 * reason was never that the unit is unspeakable; it was that the spoken name is
 * a *phrase* ("square metres"), and `lex` ends a word token at a space, so no
 * single analyzer is ever handed the whole thing. Chinese writes 平方米 with no
 * space in it, so that reason does not apply. What applies instead is
 * segmentation: Chinese puts no space between words either, so `chinese.segment`
 * — `Intl.Segmenter` scoped to Han — is the only thing between a letter run and
 * the alias index, and ICU's dictionary is an approximation with holes in it.
 * Measured, and pinned in `zh.test.ts`:
 *
 * - 平方米 comes back whole. Printable.
 * - 平方公里 comes back whole. Printable.
 * - 平方厘米 comes back as 平方 + 厘米 — and so does 平方公分, its Taiwanese
 *   synonym. **Not printable, in any spelling Chinese has for it.**
 *
 * So `cm2` carries no `forms` at all and renders through its symbol, `5cm²`,
 * which is what a Chinese page sets anyway and which round-trips: a Latin run
 * has no character of a declared script, so `scriptSegmenter` returns it whole.
 * 平方厘米 is not listed even as an alias, on the rule
 * `@smartput/angle/locale/ja` states for ラジアン: an alias `lex` can never
 * produce is dead weight in the index, and completion would happily offer it and
 * hand the user text that fails to evaluate.
 *
 * **公里 rather than 千米 in the square kilometre, and it is ICU's choice rather
 * than this file's.** 平方千米 is cut the same way 平方厘米 is, so 平方公里 is
 * the only spelling of the unit that survives — and `@smartput/length/locale/zh`
 * prints 公里 for the metre's thousandfold for the same reason plus a second
 * one, so the two tables describe one dimension in one register.
 *
 * `symbol` is what Chinese itself writes. The three squared units keep the SI
 * superscripts, which a Chinese page sets exactly as an English one does; `ha`
 * is the hectare's international abbreviation and is what Chinese agricultural
 * and cadastral writing uses; and the acre gets its spelled noun, because
 * Chinese has no short form for a unit it only ever meets in translation. R8
 * wants an explicit symbol on every unit, never an invented one.
 *
 * **The Chinese land units are deliberately absent**, on the reasoning
 * `@smartput/area/locale/ja` gives for 坪. 亩 (the mu, 666.67 m²) and 公亩 (the
 * are, 100 m²) are the measures Chinese farmland is actually bought and sold in,
 * and this kind declares no unit for either — so claiming them would mean
 * bending a real unit onto the nearest ratio and answering a question about land
 * with a 50 % error. A `NoCandidateError` says "this engine does not know 亩"; a
 * silent hectare says nothing at all. 公亩 is the trap worth naming twice: it is
 * one character away from 公顷 and means a hundredth of it.
 *
 * 平米 is a different case and is here. It is not another unit but the
 * colloquial *reading* of the square metre — what an estate agent writes where
 * an engineer writes 平方米 — so it is listed as an alias and never printed, on
 * the same split `@smartput/area/locale/ja` makes for the identically-shaped
 * Japanese 平米.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Chinese engine and
 * the micro path (`parseArea`) cannot drift from it. That map already carries
 * the superscript spellings m², cm² and km², which Chinese writes unchanged.
 *
 * Like `en`, this file names `area` by **id string** and never imports the kind,
 * which is what lets `@smartput/area/locale/zh` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "zh",
  kind: "area",
  units: {
    // 平方公尺 is the Taiwanese spelling of the same unit and comes back whole
    // too, so it costs nothing to read; like 平米 it is never printed.
    m2: {
      aliases: [...alias("m2"), "平方米", "平米", "平方公尺"],
      symbol: "m²",
      forms: { other: "平方米" },
    },
    // The one unit in this package with no `forms` at all, and the reason is the
    // segmentation test below the table rather than anything about Chinese.
    // Both spellings of the word are cut in two by ICU, so a printed 平方厘米
    // would be text this engine emits and cannot read back — the same failure
    // `assertLocaleContract` names for a printed phrase in a spaced language,
    // arriving through a different door, and one a check on shape alone cannot
    // see.
    cm2: {
      aliases: alias("cm2"),
      symbol: "cm²",
    },
    km2: {
      aliases: [...alias("km2"), "平方公里"],
      symbol: "km²",
      forms: { other: "平方公里" },
    },
    hectare: {
      aliases: [...alias("hectare"), "公顷"],
      symbol: "ha",
      forms: { other: "公顷" },
    },
    acre: {
      aliases: [...alias("acre"), "英亩"],
      symbol: "英亩",
      forms: { other: "英亩" },
    },
  },
});
