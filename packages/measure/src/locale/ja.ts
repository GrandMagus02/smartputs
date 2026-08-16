import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Japanese words for the typographic units — the same six `en`, `uk` and `de`
 * name, and all six have words: Japanese writes every one of them out in
 * katakana.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `japanese.selectForm` returns the constant `"other"` for every count and
 * every slot — Japanese has no grammatical number, and CLDR's
 * `Intl.PluralRules("ja")` declares the single category `"other"` — so rule 6's
 * closed key set is one row per unit. This table is `en`'s with the `"one"` row
 * deleted; nothing was renamed.
 *
 * **級 and 歯 are deliberately not listed**, and they are this package's version
 * of the `Cicero` trap `@smartput/measure/locale/de` documents. They are the
 * units Japanese typography actually grew up with — 級 (Q) is a quarter of a
 * millimetre, the phototypesetting body size every Japanese designer over forty
 * still thinks in, and 歯 (H) is the same quarter-millimetre step measured as
 * leading. A quarter of a millimetre is not a point, not a pica and not a
 * pixel; this kind declares no unit for it, so the words stay out rather than
 * being bent onto the nearest one. A `NoCandidateError` says "this engine does
 * not know 級"; a 30 % error says nothing at all.
 *
 * ドット is left out for the opposite reason — it is not wrong, it is
 * *redundant and ambiguous*: ドット is what Japanese calls a printer dot as well
 * as a screen pixel, and the two differ by whatever the device resolution is.
 * ピクセル is the unambiguous half of that pair and is the word a Japanese
 * stylesheet is described with, so it carries the reading alone.
 *
 * `symbol` follows `de`'s split for `de`'s reason. `mm` and `cm` are the SI
 * abbreviations Japanese itself writes; `pt` and `px` are what a Japanese
 * designer types into a stylesheet, unchanged from the Latin, and inventing a
 * kana short form for either would be a word this file made up rather than one
 * anybody uses. The inch and the pica get their spelled katakana nouns instead:
 * Japanese writes 「27インチ」 with no abbreviation at all, and `pc` is not a
 * short form anyone reads as a pica in Japanese prose. R8 wants an explicit
 * symbol on every unit, never an invented one.
 *
 * Every katakana name here survives segmentation, which had to be measured
 * rather than assumed — `japanese.segment` hands each letter run to ICU, and a
 * unit word only reaches the alias index if ICU returns it whole. All six do,
 * and `ja.test.ts` beside this file pins it; ICU cuts ラジアン into ラジ + アン,
 * which is why `@smartput/angle/locale/ja` cannot print the word for a radian.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in a Japanese engine
 * and the micro path (`parseMeasure`) cannot drift from it.
 *
 * Like `en`, this file names `measure` by **id string** and never imports the
 * kind. `composeLocale` is where the two halves meet — and, as there, a caller
 * has to ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS`
 * because its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/ja` for exactly the reason the kind is absent from
 * the roster. In Japanese that collision is wider than in English, not
 * narrower: ミリメートル and センチメートル are the same two words this kind and
 * `length` both need, so an engine that installs both vocabularies has two
 * readings of each and settles them by weight, exactly as it does for `mm`.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "インチ"],
      symbol: "インチ",
      forms: { other: "インチ" },
    },
    mm: {
      aliases: [...alias("mm"), "ミリメートル"],
      symbol: "mm",
      forms: { other: "ミリメートル" },
    },
    cm: {
      aliases: [...alias("cm"), "センチメートル"],
      symbol: "cm",
      forms: { other: "センチメートル" },
    },
    pt: {
      aliases: [...alias("pt"), "ポイント"],
      symbol: "pt",
      forms: { other: "ポイント" },
    },
    pc: {
      aliases: [...alias("pc"), "パイカ"],
      symbol: "パイカ",
      forms: { other: "パイカ" },
    },
    px: {
      aliases: [...alias("px"), "ピクセル"],
      symbol: "px",
      forms: { other: "ピクセル" },
    },
  },
});
