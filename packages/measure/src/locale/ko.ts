import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * Korean words for the typographic units — the same six `en`, `uk` and `ja`
 * name, and all six have words: Korean writes every one of them out in Hangul.
 *
 * **One `forms` key per unit, and that is the whole grammar.**
 * `korean.selectForm` returns the constant `"other"` for every count and every
 * slot, because a Korean noun marks number nowhere: 일 포인트 and 오 포인트
 * differ in the numeral and nowhere else, and neither a fraction nor a
 * conversion target moves the noun. The suffix 들 is pragmatic rather than
 * grammatical and is never attached to a measured quantity — 픽셀들 is not
 * Korean — and CLDR agrees, `Intl.PluralRules("ko")` declaring the single
 * category `"other"`. So rule 6's closed key set is one row per unit. This
 * table is `en`'s with the `"one"` row deleted; nothing was renamed.
 *
 * **Korean is spaced, so nothing here depends on a segmenter — the assumption a
 * reader arriving from `ja.ts` or `zh.ts` will wrongly carry over.** Those two
 * had to measure every name against `Intl.Segmenter`, because their languages
 * put no space between words and the segmenter is the only thing between a
 * letter run and the alias index; the measurement cost
 * `@smartput/angle/locale/ja` a printed word outright. Korean has had 띄어쓰기
 * since the 1896 독립신문, `lex` has already cut at every space, and `korean`
 * declares no `segment` for that reason. ICU still runs over each letter run as
 * the lexer's default and has no Korean dictionary behind it, so it never cuts
 * inside a Hangul run: 밀리미터 and 밀리미터를 alike come back whole.
 * `ko.test.ts` beside this file pins both.
 *
 * **급 and 호 are deliberately not listed**, and they are this package's version
 * of the `Cicero` trap `@smartput/measure/locale/de` documents — the same trap
 * `ja` names for 級 and 歯. 급 (Q) is a quarter of a millimetre, the
 * phototypesetting body size Korean 급수 measurement is built on and the one
 * every designer over forty still thinks in; 호 is the traditional East Asian
 * type-size series (1호, 2호 …), which is a *scale of named sizes* rather than a
 * unit with a ratio at all. A quarter of a millimetre is not a point, not a pica
 * and not a pixel, and a named size is not a magnitude; this kind declares no
 * unit for either, so the words stay out rather than being bent onto the
 * nearest one. A `NoCandidateError` says "this engine does not know 급"; a 30 %
 * error says nothing at all. 호 has a second reason on top, being one of the
 * commonest syllables in the language.
 *
 * 도트 is left out for the opposite reason — it is not wrong, it is *redundant
 * and ambiguous*: 도트 is what Korean calls a printer dot as well as a screen
 * pixel, and the two differ by whatever the device resolution is. 픽셀 is the
 * unambiguous half of that pair and is the word a Korean stylesheet is
 * described with, so it carries the reading alone.
 *
 * `symbol` follows `de`'s and `ja`'s split, for their reason. `mm` and `cm` are
 * the SI abbreviations Korean itself writes; `pt` and `px` are what a Korean
 * designer types into a stylesheet, unchanged from the Latin, and inventing a
 * Hangul short form for either would be a word this file made up rather than
 * one anybody uses. The inch and the pica get their spelled Hangul nouns
 * instead: Korean writes 27인치 with no abbreviation at all, and `pc` is not a
 * short form anyone reads as a pica in Korean prose. The typographic variants
 * ㎜ and ㎝ are not listed either, for a mechanical reason: `normalize()` runs
 * NFKC before anything else sees the input and NFKC maps ㎝ to "cm", so an entry
 * here would be a key the lexer can never deliver. R8 wants an explicit symbol
 * on every unit, never an invented or unreachable one.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in a Korean engine and
 * the micro path (`parseMeasure`) cannot drift from it.
 *
 * Like `en`, this file names `measure` by **id string** and never imports the
 * kind. `composeLocale` is where the two halves meet — and, as there, a caller
 * has to ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS`
 * because its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/ko` for exactly the reason the kind is absent from
 * the roster. In Korean that collision is wider than in English, not narrower:
 * 밀리미터 and 센티미터 are the same two words this kind and `length` both need,
 * so an engine that installs both vocabularies has two readings of each and
 * settles them by weight, exactly as it does for `mm`.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "measure",
  units: {
    inch: {
      aliases: [...alias("inch"), "인치"],
      symbol: "인치",
      forms: { other: "인치" },
    },
    mm: {
      aliases: [...alias("mm"), "밀리미터"],
      symbol: "mm",
      forms: { other: "밀리미터" },
    },
    cm: {
      aliases: [...alias("cm"), "센티미터"],
      symbol: "cm",
      forms: { other: "센티미터" },
    },
    pt: {
      aliases: [...alias("pt"), "포인트"],
      symbol: "pt",
      forms: { other: "포인트" },
    },
    pc: {
      aliases: [...alias("pc"), "파이카"],
      symbol: "파이카",
      forms: { other: "파이카" },
    },
    px: {
      aliases: [...alias("px"), "픽셀"],
      symbol: "px",
      forms: { other: "픽셀" },
    },
  },
});
